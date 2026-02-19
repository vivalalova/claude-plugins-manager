import { readFile } from 'fs/promises';
import { join } from 'path';
import { CLI_LONG_TIMEOUT_MS } from '../constants';
import type {
  InstalledPlugin,
  PluginListResponse,
  PluginScope,
  PluginInstallEntry,
} from '../types';
import type { CliService } from './CliService';
import type { SettingsFileService } from './SettingsFileService';
import { getWorkspacePath } from '../utils/workspace';

/**
 * Plugin CRUD。
 * 讀取 / enable / disable / install / uninstall 直接操作設定檔。
 * update 保留 CLI（需 git pull + re-cache）。
 */
export class PluginService {
  constructor(
    private readonly cli: CliService,
    private readonly settings: SettingsFileService,
  ) {}

  /** 列出已安裝的 plugin（從 installed_plugins.json + settings 合併） */
  async listInstalled(): Promise<InstalledPlugin[]> {
    const [data, enabledByScope, available] = await Promise.all([
      this.settings.readInstalledPlugins(),
      this.readAllEnabledPlugins(),
      this.settings.scanAvailablePlugins(),
    ]);

    const descMap = new Map(
      available.map((a) => [a.pluginId, a.description]),
    );

    // 取得當前 workspace path（如果有的話）
    const currentWorkspacePath = this.getCurrentWorkspacePath();

    // 收集所有 entries 和對應的 metadata
    const entries: Array<{
      pluginId: string;
      entry: typeof data.plugins[string][number];
      scopeEnabled: Record<string, boolean>;
      description: string | undefined;
    }> = [];

    for (const [pluginId, pluginEntries] of Object.entries(data.plugins)) {
      for (const entry of pluginEntries) {
        // 過濾：只保留 user scope 或當前 workspace 的 project/local entries
        if (entry.scope !== 'user' && currentWorkspacePath !== null) {
          if (entry.projectPath !== currentWorkspacePath) {
            continue;
          }
        } else if (entry.scope !== 'user' && currentWorkspacePath === null) {
          // 沒有開啟 workspace 時，跳過所有 project/local entries
          continue;
        }

        const scopeEnabled = enabledByScope[entry.scope] ?? {};
        entries.push({
          pluginId,
          entry,
          scopeEnabled,
          description: descMap.get(pluginId),
        });
      }
    }

    // 並行讀取所有 mcpServers
    const mcpServersResults = await Promise.all(
      entries.map(({ entry }) => this.readMcpServers(entry.installPath)),
    );

    // 組裝結果
    return entries.map(({ pluginId, entry, scopeEnabled, description }, i) => ({
      id: pluginId,
      version: entry.version,
      scope: entry.scope,
      enabled: scopeEnabled[pluginId] === true,
      installPath: entry.installPath,
      installedAt: entry.installedAt,
      lastUpdated: entry.lastUpdated,
      projectPath: entry.projectPath,
      description,
      mcpServers: mcpServersResults[i],
    }));
  }

  /** 列出已安裝 + marketplace 可用的 plugin + marketplace source URLs */
  async listAvailable(): Promise<PluginListResponse> {
    const [installed, available, marketplaceSources] = await Promise.all([
      this.listInstalled(),
      this.settings.scanAvailablePlugins(),
      this.settings.readMarketplaceSources(),
    ]);
    return { installed, available, marketplaceSources };
  }

  /** 安裝 plugin（寫入 installed_plugins.json + enable） */
  async install(plugin: string, scope: PluginScope): Promise<void> {
    // 優先檢查是否已有其他 scope 安裝（可複用 installPath，不需 marketplace scan）
    const data = await this.settings.readInstalledPlugins();
    const existing = data.plugins[plugin];
    let installPath: string;
    let version: string;

    if (existing?.length) {
      // 已有其他 scope 安裝，複用同一個 cache path
      installPath = existing[0].installPath;
      version = existing[0].version;
    } else {
      // 尚未安裝：用 CLI 安裝（下載 cache + 寫 installed_plugins.json + enable）
      const cwd = scope !== 'user' ? this.getProjectPath(scope) : undefined;
      await this.cli.exec(
        ['plugin', 'install', plugin, '--scope', scope],
        { timeout: CLI_LONG_TIMEOUT_MS, cwd },
      );
      return;
    }

    const entry: PluginInstallEntry = {
      scope,
      installPath,
      version,
      installedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      ...(scope !== 'user' ? { projectPath: this.getProjectPath(scope) } : {}),
    };

    await this.settings.addInstallEntry(plugin, entry);
    await this.settings.setPluginEnabled(plugin, scope, true);
  }

  /** 移除 plugin（從 installed_plugins.json 移除 entry + disable） */
  async uninstall(plugin: string, scope: PluginScope): Promise<void> {
    const projectPath = scope !== 'user'
      ? this.getProjectPath(scope)
      : undefined;

    await this.settings.removeInstallEntry(plugin, scope, projectPath);
    await this.settings.setPluginEnabled(plugin, scope, false);
  }

  /** 啟用 plugin（寫入對應 scope 的 settings.json） */
  async enable(plugin: string, scope?: PluginScope): Promise<void> {
    await this.settings.setPluginEnabled(plugin, scope ?? 'user', true);
  }

  /** 停用 plugin（從對應 scope 的 settings.json 移除） */
  async disable(plugin: string, scope?: PluginScope): Promise<void> {
    await this.settings.setPluginEnabled(plugin, scope ?? 'user', false);
  }

  /** 停用所有 plugin（三個 scope 的 settings 都清） */
  async disableAll(): Promise<void> {
    const scopes: PluginScope[] = ['user', 'project', 'local'];
    for (const scope of scopes) {
      try {
        const enabled = await this.settings.readEnabledPlugins(scope);
        for (const pluginId of Object.keys(enabled)) {
          await this.settings.setPluginEnabled(pluginId, scope, false);
        }
      } catch (error: unknown) {
        // project/local scope 需要 workspace，沒開 workspace 時會拋錯，其他錯誤應拋出
        if (error instanceof Error && !error.message.includes('No workspace')) {
          throw error;
        }
      }
    }
  }

  /** 更新 plugin（保留 CLI — 需 git pull + re-cache） */
  async update(plugin: string, scope?: PluginScope): Promise<void> {
    const args = ['plugin', 'update', plugin];
    if (scope) {
      args.push('--scope', scope);
    }
    const cwd = scope && scope !== 'user' ? this.getProjectPath(scope) : undefined;
    await this.cli.exec(args, { timeout: CLI_LONG_TIMEOUT_MS, cwd });
  }

  /** 讀取三個 scope 的 enabledPlugins */
  private async readAllEnabledPlugins(): Promise<
    Record<PluginScope, Record<string, boolean>>
  > {
    const [user, project, local] = await Promise.all([
      this.settings.readEnabledPlugins('user'),
      this.settings.readEnabledPlugins('project').catch(() => ({})),
      this.settings.readEnabledPlugins('local').catch(() => ({})),
    ]);
    return { user, project, local };
  }

  /** 讀取 plugin 目錄中的 .mcp.json（如果有） */
  private async readMcpServers(
    installPath: string,
  ): Promise<Record<string, { command: string; args?: string[] }> | undefined> {
    try {
      const content = await readFile(join(installPath, '.mcp.json'), 'utf-8');
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  }

  /** 取得 project/local scope 的 projectPath */
  private getProjectPath(scope: PluginScope): string {
    if (scope === 'user') return '';
    return getWorkspacePath();
  }

  /** 取得當前 workspace 路徑，沒有則回傳 null */
  private getCurrentWorkspacePath(): string | null {
    try {
      return getWorkspacePath();
    } catch {
      return null;
    }
  }
}
