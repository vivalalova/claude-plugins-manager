import * as vscode from 'vscode';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { MCP_POLL_INTERVAL_MS } from '../constants';
import type { McpAddParams, McpServer, McpServerConfig, McpScope, McpStatus } from '../types';
import type { CliService } from './CliService';
import { getWorkspacePath } from '../utils/workspace';

/**
 * MCP Server 管理 + 即時狀態輪詢。
 * MCP 有 scope：local（預設）/ user / project。
 */
export class McpService {
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private statusCache: McpServer[] = [];
  private consecutiveErrors = 0;
  private readonly MAX_ERRORS_BEFORE_BACKOFF = 3;

  /** buildServerMetadata() 快取，避免每次 poll 都重讀 disk */
  private metadataCache: Map<string, { scope: McpScope; config?: McpServerConfig }> | null = null;
  private metadataCacheDirty = true;

  /** 狀態變更事件，EditorPanelManager 訂閱後推送給 webview */
  readonly onStatusChange = new vscode.EventEmitter<McpServer[]>();

  /** 連續 polling 失敗達上限，通知 UI 顯示 warning */
  readonly onPollUnavailable = new vscode.EventEmitter<void>();

  constructor(private readonly cli: CliService) {}

  /** 使 metadata cache 失效，下次 buildServerMetadata() 將重新從 disk 讀取 */
  invalidateMetadataCache(): void {
    this.metadataCache = null;
    this.metadataCacheDirty = true;
  }

  /**
   * 快速列出 MCP server（從設定檔 + 已安裝 plugin，不做 health check）。
   * status 一律為 'pending'，由 polling 非同步更新真實狀態。
   */
  async listFromFiles(): Promise<McpServer[]> {
    const metaMap = await this.buildServerMetadata();
    const servers: McpServer[] = [];
    for (const [fullName, meta] of metaMap) {
      const nameParts = fullName.split(':');
      const name = nameParts[nameParts.length - 1];
      const command = meta.config
        ? [meta.config.command, ...(meta.config.args ?? [])].join(' ')
        : name;
      servers.push({
        name,
        fullName,
        command,
        status: 'pending',
        scope: meta.scope,
        config: meta.config,
      });
    }
    if (this.statusCache.length === 0) {
      this.statusCache = servers;
    }
    return servers;
  }

  /**
   * 列出 MCP server 並解析連線狀態 + scope + 結構化設定。
   * `claude mcp list` 無 --json，需解析文字輸出。
   * scope 與 config 從設定檔反查：.claude.json + .mcp.json。
   */
  async list(): Promise<McpServer[]> {
    const cwd = this.getWorkspaceCwd();
    const [output, metaMap] = await Promise.all([
      this.cli.exec(['mcp', 'list'], { cwd }),
      this.buildServerMetadata(),
    ]);
    const servers = this.parseMcpList(output);
    for (const server of servers) {
      const meta = metaMap.get(server.name) ?? metaMap.get(server.fullName);
      if (meta) {
        server.scope = meta.scope;
        server.config = meta.config;
      }
    }
    this.statusCache = servers;
    return servers;
  }

  /** 新增 MCP server */
  async add(params: McpAddParams): Promise<void> {
    const args = ['mcp', 'add'];

    if (params.transport) {
      args.push('--transport', params.transport);
    }
    if (params.scope) {
      args.push('--scope', params.scope);
    }
    if (params.env) {
      for (const [key, value] of Object.entries(params.env)) {
        args.push('-e', `${key}=${value}`);
      }
    }
    if (params.headers) {
      for (const header of params.headers) {
        args.push('-H', header);
      }
    }

    args.push(params.name, params.commandOrUrl);

    if (params.args?.length) {
      args.push('--', ...params.args);
    }

    const cwd = this.getCwdForScope(params.scope);
    await this.cli.exec(args, { cwd });
    this.invalidateMetadataCache();
  }

  /** 移除 MCP server */
  async remove(name: string, scope?: McpScope): Promise<void> {
    const args = ['mcp', 'remove', name];
    if (scope) {
      args.push('--scope', scope);
    }
    const cwd = this.getWorkspaceCwd();
    await this.cli.exec(args, { cwd });
    this.invalidateMetadataCache();
  }

  /**
   * 查看 MCP server 詳情。
   * 從設定檔 + 快取組裝（即時），plugin 來源從檔案系統讀取。
   * 不呼叫 CLI（`claude mcp get` 要 2-3 秒做 health check）。
   */
  async getDetail(name: string): Promise<string> {
    if (name.startsWith('plugin:')) {
      return this.getPluginMcpDetail(name);
    }

    const shortName = name.includes(':') ? name.split(':').pop()! : name;

    // 從設定檔讀取結構化 config + scope
    const metaMap = await this.buildServerMetadata();
    const meta = metaMap.get(name) ?? metaMap.get(shortName);

    // 從快取讀取即時狀態
    const cached = this.statusCache.find((s) => s.fullName === name || s.name === name);

    const detail: Record<string, unknown> = { name: shortName };
    if (cached) detail.status = cached.status;
    if (meta) {
      detail.scope = meta.scope;
      if (meta.config) {
        detail.command = meta.config.command;
        if (meta.config.args?.length) detail.args = meta.config.args;
        if (meta.config.env && Object.keys(meta.config.env).length > 0) detail.env = meta.config.env;
      }
    }
    if (!meta?.config && cached) {
      detail.command = cached.command;
    }

    return JSON.stringify(detail, null, 2);
  }

  /** 重置 project MCP 選擇 */
  async resetProjectChoices(): Promise<void> {
    const cwd = this.getCwdForScope('project');
    await this.cli.exec(['mcp', 'reset-project-choices'], { cwd });
  }

  /** 啟動定期輪詢 MCP 狀態（多次呼叫安全，不會重複啟動） */
  startPolling(): void {
    if (this.pollTimer) {
      return;
    }
    this.pollOnce();
    this.pollTimer = setInterval(
      () => this.pollOnce(),
      MCP_POLL_INTERVAL_MS,
    );
  }

  /** 停止輪詢 */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  /** 重啟 polling（重置錯誤計數 + 啟動 timer） */
  restartPolling(): void {
    this.stopPolling();
    this.consecutiveErrors = 0;
    this.startPolling();
  }

  /** 檔案變更後觸發立即 poll（debounce 由 FileWatcherService 處理） */
  triggerPoll(): void {
    this.pollOnce();
  }

  /** 手動觸發一次完整狀態刷新（CLI health check），回傳最新 servers */
  async refreshStatus(): Promise<McpServer[]> {
    const servers = await this.list();
    this.consecutiveErrors = 0;
    this.onStatusChange.fire(servers);
    return servers;
  }

  /** 釋放事件資源（extension deactivate 時呼叫） */
  dispose(): void {
    this.stopPolling();
    this.onStatusChange.dispose();
    this.onPollUnavailable.dispose();
  }

  /** 取得最近一次快取的狀態 */
  getCachedStatus(): McpServer[] {
    return this.statusCache;
  }

  /** 輕量 fingerprint：fullName + status 串接，取代 JSON.stringify 全序列化 */
  private makeStatusFingerprint(servers: McpServer[]): string {
    return servers.map((s) => `${s.fullName}:${s.status}`).join('|');
  }

  /** 單次輪詢，比對快取，有變更時觸發事件 */
  private async pollOnce(): Promise<void> {
    try {
      const prev = this.makeStatusFingerprint(this.statusCache);
      const servers = await this.list();
      if (this.makeStatusFingerprint(servers) !== prev) {
        this.onStatusChange.fire(servers);
      }
      this.consecutiveErrors = 0;
    } catch (err) {
      this.consecutiveErrors++;
      console.error(`[McpService] pollOnce failed (${this.consecutiveErrors}/${this.MAX_ERRORS_BEFORE_BACKOFF}):`, err);
      if (this.consecutiveErrors >= this.MAX_ERRORS_BEFORE_BACKOFF) {
        this.stopPolling();
        this.onPollUnavailable.fire();
        console.warn('[McpService] Polling stopped after consecutive failures');
      }
    }
  }

  /**
   * 從檔案系統讀取 plugin 來源 MCP server 的詳情。
   * fullName 格式：`plugin:<pluginName>:<mcpServerName>`
   */
  private async getPluginMcpDetail(fullName: string): Promise<string> {
    const [, pluginName, mcpServerName] = fullName.split(':');
    const installedPath = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
    const installed = JSON.parse(await readFile(installedPath, 'utf-8'));

    // key 格式: <pluginName>@<marketplace>
    const pluginKey = Object.keys(installed.plugins)
      .find((k: string) => k.startsWith(`${pluginName}@`));
    if (!pluginKey) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    const entries = installed.plugins[pluginKey] as Array<{
      installPath: string;
      scope: string;
      installedAt: string;
      lastUpdated: string;
    }>;
    const entry = entries[0];

    const [mcpRaw, metaRaw] = await Promise.all([
      readFile(join(entry.installPath, '.mcp.json'), 'utf-8').catch(() => '{}'),
      readFile(join(entry.installPath, '.claude-plugin', 'plugin.json'), 'utf-8').catch(() => '{}'),
    ]);

    const mcpConfig = JSON.parse(mcpRaw);
    const pluginMeta = JSON.parse(metaRaw);

    const detail = {
      name: mcpServerName,
      plugin: pluginKey,
      description: pluginMeta.description,
      author: pluginMeta.author,
      config: mcpConfig[mcpServerName] ?? mcpConfig,
      installPath: entry.installPath,
      scope: entry.scope,
      installedAt: entry.installedAt,
      lastUpdated: entry.lastUpdated,
    };

    return JSON.stringify(detail, null, 2);
  }

  /**
   * 從設定檔建構 MCP server name → { scope, config } 對應表。
   * - user scope: ~/.claude.json → mcpServers
   * - local scope: ~/.claude.json → projects[workspacePath].mcpServers
   * - project scope: {workspace}/.mcp.json → mcpServers
   */
  private async buildServerMetadata(): Promise<Map<string, { scope: McpScope; config?: McpServerConfig }>> {
    if (!this.metadataCacheDirty && this.metadataCache) {
      return this.metadataCache;
    }

    const map = new Map<string, { scope: McpScope; config?: McpServerConfig }>();

    const workspacePath = this.getWorkspaceCwd();

    // ~/.claude.json: user scope + local scope
    try {
      const raw = await readFile(join(homedir(), '.claude.json'), 'utf-8');
      const claudeJson = JSON.parse(raw) as {
        mcpServers?: Record<string, McpServerConfig>;
        projects?: Record<string, { mcpServers?: Record<string, McpServerConfig> }>;
      };

      // user scope
      for (const [name, config] of Object.entries(claudeJson.mcpServers ?? {})) {
        map.set(name, { scope: 'user', config });
      }

      // local scope（預設 scope）：先查當前 workspace，再查 "/" fallback
      const projectPaths = workspacePath ? [workspacePath, '/'] : ['/'];
      for (const pp of projectPaths) {
        const projectData = claudeJson.projects?.[pp];
        for (const [name, config] of Object.entries(projectData?.mcpServers ?? {})) {
          if (!map.has(name)) {
            map.set(name, { scope: 'local', config });
          }
        }
      }
    } catch { /* .claude.json 不存在或格式錯誤 */ }

    // .mcp.json: project scope
    if (workspacePath) {
      try {
        const raw = await readFile(join(workspacePath, '.mcp.json'), 'utf-8');
        const mcpJson = JSON.parse(raw) as Record<string, unknown>;
        const servers = (mcpJson.mcpServers ?? mcpJson) as Record<string, McpServerConfig>;
        for (const [name, config] of Object.entries(servers)) {
          map.set(name, { scope: 'project', config });
        }
      } catch { /* no .mcp.json */ }
    }

    // Plugin-provided MCP servers: installed_plugins.json → each plugin's .mcp.json
    try {
      const installedRaw = await readFile(
        join(homedir(), '.claude', 'plugins', 'installed_plugins.json'),
        'utf-8',
      );
      const installed = JSON.parse(installedRaw) as {
        plugins: Record<string, Array<{ scope: string; installPath: string }>>;
      };

      await Promise.all(
        Object.entries(installed.plugins).map(async ([pluginKey, entries]) => {
          const entry = entries[0];
          if (!entry) return;
          const pluginBaseName = pluginKey.split('@')[0];

          try {
            const mcpRaw = await readFile(join(entry.installPath, '.mcp.json'), 'utf-8');
            const mcpJson = JSON.parse(mcpRaw) as Record<string, unknown>;
            const pluginServers = (mcpJson.mcpServers ?? mcpJson) as Record<string, McpServerConfig>;
            for (const [serverName, config] of Object.entries(pluginServers)) {
              if (typeof config === 'object' && config && 'command' in config) {
                map.set(`plugin:${pluginBaseName}:${serverName}`, {
                  scope: entry.scope as McpScope,
                  config,
                });
              }
            }
          } catch { /* plugin has no .mcp.json */ }
        }),
      );
    } catch { /* installed_plugins.json not found */ }

    this.metadataCache = map;
    this.metadataCacheDirty = false;
    return map;
  }

  /** 取得 workspace cwd（MCP CLI 需要 cwd 來定位 project/local scope） */
  private getWorkspaceCwd(): string | undefined {
    try { return getWorkspacePath(); } catch { return undefined; }
  }

  /** project scope 操作需 workspace folder 作為 cwd */
  private getCwdForScope(scope?: McpScope): string | undefined {
    if (scope !== 'project') {
      return undefined;
    }
    return getWorkspacePath();
  }

  /**
   * 解析 `claude mcp list` 的文字輸出。
   *
   * 格式範例：
   * ```text
   * Checking MCP server health...
   *
   * plugin:context7:context7: npx -y @upstash/context7-mcp - ✓ Connected
   * my-server: node server.js - ✗ Failed
   * ```
   */
  private parseMcpList(output: string): McpServer[] {
    const servers: McpServer[] = [];
    // 去除 ANSI escape codes
    const cleaned = output.replace(/\x1b\[[0-9;]*m/g, '');
    const lines = cleaned.split('\n');

    for (const line of lines) {
      // 跳過空行和 header
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('Checking')) {
        continue;
      }

      // 格式：<fullName>: <command> - <icon> <Status>
      const match = trimmed.match(/^(.+?):\s+(.+?)\s+-\s+(.+)$/);
      if (!match) {
        continue;
      }

      const [, fullName, command, statusPart] = match;
      const status = this.parseStatus(statusPart);
      const nameParts = fullName.split(':');
      const name = nameParts[nameParts.length - 1];

      servers.push({ name, fullName, command, status });
    }

    return servers;
  }

  /** 從狀態文字解析 McpStatus */
  private parseStatus(raw: string): McpStatus {
    const lower = raw.toLowerCase().trim();
    if (lower.includes('connected')) {
      return 'connected';
    }
    if (lower.includes('failed')) {
      return 'failed';
    }
    if (lower.includes('needs') && lower.includes('auth')) {
      return 'needs-auth';
    }
    if (lower.includes('pending')) {
      return 'pending';
    }
    return 'unknown';
  }
}
