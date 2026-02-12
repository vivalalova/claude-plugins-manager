import * as vscode from 'vscode';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { MCP_POLL_INTERVAL_MS } from '../constants';
import type { McpAddParams, McpServer, McpScope, McpStatus } from '../types';
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

  /** 狀態變更事件，EditorPanelManager 訂閱後推送給 webview */
  readonly onStatusChange = new vscode.EventEmitter<McpServer[]>();

  constructor(private readonly cli: CliService) {}

  /**
   * 列出 MCP server 並解析連線狀態 + scope。
   * `claude mcp list` 無 --json，需解析文字輸出。
   * scope 從設定檔反查：.claude.json + .mcp.json。
   */
  async list(): Promise<McpServer[]> {
    const [output, scopeMap] = await Promise.all([
      this.cli.exec(['mcp', 'list']),
      this.buildScopeMap(),
    ]);
    const servers = this.parseMcpList(output);
    for (const server of servers) {
      server.scope = scopeMap.get(server.name) ?? scopeMap.get(server.fullName);
    }
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
  }

  /** 移除 MCP server */
  async remove(name: string, scope?: McpScope): Promise<void> {
    const args = ['mcp', 'remove', name];
    if (scope) {
      args.push('--scope', scope);
    }
    await this.cli.exec(args);
  }

  /** 查看 MCP server 詳情（plugin 來源從檔案系統讀取） */
  async getDetail(name: string): Promise<string> {
    if (name.startsWith('plugin:')) {
      return this.getPluginMcpDetail(name);
    }
    return this.cli.exec(['mcp', 'get', name]);
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
    this.onStatusChange.dispose();
  }

  /** 取得最近一次快取的狀態 */
  getCachedStatus(): McpServer[] {
    return this.statusCache;
  }

  /** 單次輪詢，比對快取，有變更時觸發事件 */
  private async pollOnce(): Promise<void> {
    // 如果連續錯誤次數過多，跳過本次輪詢
    if (this.consecutiveErrors >= this.MAX_ERRORS_BEFORE_BACKOFF) {
      this.consecutiveErrors = 0; // 重置計數，下次會重試
      console.warn('[McpService] Too many consecutive errors, skipping this poll cycle');
      return;
    }

    try {
      const servers = await this.list();
      const changed = JSON.stringify(servers) !== JSON.stringify(this.statusCache);
      this.statusCache = servers;
      if (changed) {
        this.onStatusChange.fire(servers);
      }
      this.consecutiveErrors = 0; // 成功後重置錯誤計數
    } catch (err) {
      this.consecutiveErrors++;
      console.error(`[McpService] pollOnce failed (${this.consecutiveErrors}/${this.MAX_ERRORS_BEFORE_BACKOFF}):`, err);
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
   * 從設定檔建構 MCP server name → scope 的對應表。
   * - user scope: ~/.claude.json → mcpServers
   * - local scope: ~/.claude.json → projects[workspacePath].mcpServers
   * - project scope: {workspace}/.mcp.json → mcpServers
   */
  private async buildScopeMap(): Promise<Map<string, McpScope>> {
    const map = new Map<string, McpScope>();

    let workspacePath: string | undefined;
    try { workspacePath = getWorkspacePath(); } catch { /* no workspace */ }

    // ~/.claude.json: user scope + local scope
    try {
      const raw = await readFile(join(homedir(), '.claude.json'), 'utf-8');
      const claudeJson = JSON.parse(raw) as {
        mcpServers?: Record<string, unknown>;
        projects?: Record<string, { mcpServers?: Record<string, unknown> }>;
      };

      // user scope
      for (const name of Object.keys(claudeJson.mcpServers ?? {})) {
        map.set(name, 'user');
      }

      // local scope（預設 scope）：先查當前 workspace，再查 "/" fallback
      const projectPaths = workspacePath ? [workspacePath, '/'] : ['/'];
      for (const pp of projectPaths) {
        const projectData = claudeJson.projects?.[pp];
        for (const name of Object.keys(projectData?.mcpServers ?? {})) {
          if (!map.has(name)) {
            map.set(name, 'local');
          }
        }
      }
    } catch { /* .claude.json 不存在或格式錯誤 */ }

    // .mcp.json: project scope
    if (workspacePath) {
      try {
        const raw = await readFile(join(workspacePath, '.mcp.json'), 'utf-8');
        const mcpJson = JSON.parse(raw) as Record<string, unknown>;
        const servers = (mcpJson.mcpServers ?? mcpJson) as Record<string, unknown>;
        for (const name of Object.keys(servers)) {
          map.set(name, 'project');
        }
      } catch { /* no .mcp.json */ }
    }

    return map;
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
