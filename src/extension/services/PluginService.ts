import { readFile, readdir, rm, stat } from 'fs/promises';
import { join } from 'path';
import { PLUGINS_CACHE_DIR } from '../paths';
import { CLI_LONG_TIMEOUT_MS } from '../constants';
import type {
  AvailablePlugin,
  InstalledPlugin,
  InstalledPluginsFile,
  OrphanedPlugin,
  PluginListResponse,
  PluginScope,
  PluginInstallEntry,
} from '../../shared/types';
import type { CliService } from './CliService';
import type { SettingsFileService } from './SettingsFileService';
import { getWorkspacePath, NoWorkspaceError } from '../utils/workspace';
import { fixScriptPermissions } from '../utils/fixScriptPermissions';

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

  private getScopedProjectPath(scope?: PluginScope): string | undefined {
    return scope && scope !== 'user'
      ? this.getProjectPath(scope)
      : undefined;
  }

  /** 列出已安裝的 plugin（從 installed_plugins.json + settings 合併） */
  async listInstalled(): Promise<InstalledPlugin[]> {
    const [data, enabledByScope, available] = await Promise.all([
      this.settings.readInstalledPlugins(),
      this.settings.readAllEnabledPlugins(),
      this.settings.scanAvailablePlugins(),
    ]);
    return this.buildInstalledList(data, enabledByScope, available);
  }

  /** 列出已安裝 + marketplace 可用的 plugin + marketplace source URLs */
  async listAvailable(): Promise<PluginListResponse> {
    const [data, enabledByScope, available, marketplaceSources] = await Promise.all([
      this.settings.readInstalledPlugins(),
      this.settings.readAllEnabledPlugins(),
      this.settings.scanAvailablePlugins(),
      this.settings.readMarketplaceSources(),
    ]);

    // Marketplace manifest 可讀但 plugin 已不在其中 → 自動清理 installed 殘留
    const pruned = await this.pruneStaleEntries(data, available);
    for (const pluginId of pruned) {
      delete data.plugins[pluginId];
    }

    const [allInstalled, orphaned] = await Promise.all([
      this.buildInstalledList(data, enabledByScope, available),
      this.detectOrphaned(data),
    ]);
    // orphaned entries 不應出現在 installed
    const orphanKeys = new Set(orphaned.map((o) => `${o.id}:${o.scope}:${o.projectPath ?? ''}`));
    const installed = allInstalled.filter(
      (p) => !orphanKeys.has(`${p.id}:${p.scope}:${p.projectPath ?? ''}`),
    );
    return { installed, available, marketplaceSources, enabledByScope, orphaned };
  }

  /** 從已取得的資料組裝 InstalledPlugin 列表（避免重複 IO） */
  private async buildInstalledList(
    data: InstalledPluginsFile,
    enabledByScope: Record<PluginScope, Record<string, boolean>>,
    available: AvailablePlugin[],
  ): Promise<InstalledPlugin[]> {
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

    // 並行讀取 mcpServers + contents（已安裝 plugin 從 installPath 掃描）
    const [mcpServersResults, contentsResults] = await Promise.all([
      Promise.all(entries.map(({ entry }) => this.readMcpServers(entry.installPath))),
      Promise.all(entries.map(({ entry }) =>
        this.settings.scanPluginContentsAt(entry.installPath).catch(() => undefined),
      )),
    ]);

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
      contents: contentsResults[i],
    }));
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
      const cwd = this.getScopedProjectPath(scope);
      try {
        await this.cli.exec(
          ['plugin', 'install', plugin, '--scope', scope],
          { timeout: CLI_LONG_TIMEOUT_MS, cwd },
        );
      } catch (err) {
        // source path 不存在 → marketplace 可能未同步，先 update 再重試一次
        if (isSourcePathMissing(err)) {
          const lastAt = plugin.lastIndexOf('@');
          const marketplaceName = lastAt > 0 ? plugin.slice(lastAt + 1) : undefined;
          if (marketplaceName) {
            await this.cli.exec(
              ['plugin', 'marketplace', 'update', marketplaceName],
              { timeout: CLI_LONG_TIMEOUT_MS },
            );
            await this.cli.exec(
              ['plugin', 'install', plugin, '--scope', scope],
              { timeout: CLI_LONG_TIMEOUT_MS, cwd },
            );
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
      await this.fixPluginPermissions(plugin);
      return;
    }
    const projectPath = this.getScopedProjectPath(scope);

    const entry: PluginInstallEntry = {
      scope,
      installPath,
      version,
      installedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      ...(projectPath ? { projectPath } : {}),
    };

    await this.settings.addInstallEntry(plugin, entry);
    await this.settings.setPluginEnabled(plugin, scope, true);
    await this.fixPluginPermissions(plugin);
  }

  /** 移除 plugin（從 installed_plugins.json 移除 entry + disable） */
  async uninstall(plugin: string, scope: PluginScope): Promise<void> {
    const projectPath = this.getScopedProjectPath(scope);

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

  /** 停用所有 plugin（三個 scope 並行，各寫不同設定檔互不依賴） */
  async disableAll(): Promise<void> {
    const scopes: PluginScope[] = ['user', 'project', 'local'];
    const results = await Promise.allSettled(
      scopes.map((scope) => this.settings.clearAllEnabledPlugins(scope)),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        const error = result.reason;
        // project/local scope 需要 workspace，沒開 workspace 時會拋錯，其他錯誤應拋出
        if (!(error instanceof NoWorkspaceError)) {
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
    const cwd = this.getScopedProjectPath(scope);
    try {
      await this.cli.exec(args, { timeout: CLI_LONG_TIMEOUT_MS, cwd });
    } catch (error) {
      // 只有「already up to date」類錯誤才更新 timestamp，避免隱藏真正需要重試的失敗
      const msg = error instanceof Error ? error.message : '';
      if (/already up[\s-]to[\s-]date|up-to-date|no updates available/i.test(msg)) {
        await this.settings.updateInstallEntryTimestamp(plugin, scope);
      }
      throw error;
    }
    await Promise.all([
      this.fixPluginPermissions(plugin),
      this.settings.updateInstallEntryTimestamp(plugin, scope),
    ]);
  }

  /** 移除單一 orphaned entry（從 installed_plugins.json） */
  async removeOrphaned(pluginId: string, scope: PluginScope, projectPath?: string): Promise<void> {
    await this.settings.removeInstallEntry(pluginId, scope, projectPath);
    // 同步清除 settings 中的 enabled 狀態
    await this.settings.setPluginEnabled(pluginId, scope, false);
  }

  /** 移除所有 orphaned entries */
  async removeAllOrphaned(): Promise<void> {
    const data = await this.settings.readInstalledPlugins();
    const orphaned = await this.detectOrphaned(data);
    await Promise.all(
      orphaned.map((o) => this.removeOrphaned(o.id, o.scope, o.projectPath)),
    );
  }

  /**
   * 清除 PLUGINS_CACHE_DIR 下未被任何 installed entry 引用的目錄。
   * 三層結構：marketplace/plugin/hash — 比對所有 installPath，刪除未引用的 hash 目錄，
   * 再清空變空的 plugin/marketplace 父目錄。
   */
  async pruneUnusedCache(): Promise<{ removedDirs: number; freedBytes: number }> {
    // 收集所有 installPath（跨所有 scope/project）
    const data = await this.settings.readInstalledPlugins();
    const referencedPaths = new Set<string>();
    for (const entries of Object.values(data.plugins)) {
      for (const entry of entries) {
        referencedPaths.add(entry.installPath);
      }
    }

    // 列舉 cache 下所有 hash-level 目錄
    let mpDirents: import('fs').Dirent[];
    try {
      mpDirents = await readdir(PLUGINS_CACHE_DIR, { withFileTypes: true });
    } catch {
      return { removedDirs: 0, freedBytes: 0 };
    }

    const unreferenced: string[] = [];
    for (const mpDirent of mpDirents) {
      if (!mpDirent.isDirectory() || mpDirent.name.startsWith('temp_subdir_')) continue;
      const mpPath = join(PLUGINS_CACHE_DIR, mpDirent.name);

      let pluginDirents: import('fs').Dirent[];
      try { pluginDirents = await readdir(mpPath, { withFileTypes: true }); } catch { continue; }

      for (const pluginDirent of pluginDirents) {
        if (!pluginDirent.isDirectory()) continue;
        const pluginPath = join(mpPath, pluginDirent.name);

        let hashDirents: import('fs').Dirent[];
        try { hashDirents = await readdir(pluginPath, { withFileTypes: true }); } catch { continue; }

        for (const hashDirent of hashDirents) {
          if (!hashDirent.isDirectory()) continue;
          const hashPath = join(pluginPath, hashDirent.name);
          if (!referencedPaths.has(hashPath)) {
            unreferenced.push(hashPath);
          }
        }
      }
    }

    if (unreferenced.length === 0) return { removedDirs: 0, freedBytes: 0 };

    // 計算大小 + 刪除
    const sizes = await Promise.all(
      unreferenced.map((p) => this.calcDirSize(p)),
    );
    const freedBytes = sizes.reduce((sum, s) => sum + s, 0);

    await Promise.all(
      unreferenced.map((p) => rm(p, { recursive: true, force: true })),
    );

    // 清空變空的父目錄（plugin level → marketplace level）
    await this.cleanEmptyParents(PLUGINS_CACHE_DIR);

    return { removedDirs: unreferenced.length, freedBytes };
  }

  /** 遞迴計算目錄大小（bytes） */
  private async calcDirSize(dirPath: string): Promise<number> {
    let total = 0;
    let entries: import('fs').Dirent[];
    try { entries = await readdir(dirPath, { withFileTypes: true }); } catch { return 0; }
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await this.calcDirSize(fullPath);
      } else {
        try { total += (await stat(fullPath)).size; } catch { /* skip */ }
      }
    }
    return total;
  }

  /** 清除 cacheDir 下兩層空目錄（plugin dir → marketplace dir） */
  private async cleanEmptyParents(cacheDir: string): Promise<void> {
    let mpDirents: import('fs').Dirent[];
    try { mpDirents = await readdir(cacheDir, { withFileTypes: true }); } catch { return; }
    for (const mpDirent of mpDirents) {
      if (!mpDirent.isDirectory()) continue;
      const mpPath = join(cacheDir, mpDirent.name);
      let pluginDirents: import('fs').Dirent[];
      try { pluginDirents = await readdir(mpPath, { withFileTypes: true }); } catch { continue; }

      for (const pluginDirent of pluginDirents) {
        if (!pluginDirent.isDirectory()) continue;
        const pluginPath = join(mpPath, pluginDirent.name);
        const children = await readdir(pluginPath).catch(() => ['_']);
        if (children.length === 0) {
          await rm(pluginPath, { recursive: true, force: true }).catch(() => {});
        }
      }

      // 重新檢查 marketplace dir 是否也空了
      const remaining = await readdir(mpPath).catch(() => ['_']);
      if (remaining.length === 0) {
        await rm(mpPath, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  /**
   * Marketplace manifest 可讀但 plugin 已不在其中 → 移除 installed 記錄 + enabled 狀態。
   * 回傳被清除的 pluginId 列表。
   */
  private async pruneStaleEntries(
    data: InstalledPluginsFile,
    available: AvailablePlugin[],
  ): Promise<string[]> {
    const scannableMpNames = await this.settings.readScannableMarketplaceNames();
    if (scannableMpNames.size === 0) return [];

    const availableIds = new Set(available.map((a) => a.pluginId));
    const staleIds: string[] = [];

    for (const pluginId of Object.keys(data.plugins)) {
      const lastAt = pluginId.lastIndexOf('@');
      const mpName = lastAt > 0 ? pluginId.slice(lastAt + 1) : undefined;
      if (!mpName || !scannableMpNames.has(mpName)) continue;
      if (availableIds.has(pluginId)) continue;
      staleIds.push(pluginId);
    }

    if (staleIds.length === 0) return [];

    const cleanups: Array<{ pluginId: string; entry: PluginInstallEntry }> = [];
    for (const pluginId of staleIds) {
      for (const entry of data.plugins[pluginId] ?? []) {
        cleanups.push({ pluginId, entry });
      }
    }

    await Promise.all(
      cleanups.map(({ pluginId, entry }) =>
        Promise.all([
          this.settings.removeInstallEntry(pluginId, entry.scope, entry.projectPath),
          this.settings.setPluginEnabled(pluginId, entry.scope, false),
        ]),
      ),
    );

    return staleIds;
  }

  /** 偵測 installPath 不存在的 entries */
  private async detectOrphaned(data: InstalledPluginsFile): Promise<OrphanedPlugin[]> {
    const currentWorkspacePath = this.getCurrentWorkspacePath();
    const checks: Array<{ pluginId: string; entry: PluginInstallEntry }> = [];

    for (const [pluginId, entries] of Object.entries(data.plugins)) {
      for (const entry of entries) {
        // 同 buildInstalledList 的 workspace 過濾邏輯
        if (entry.scope !== 'user') {
          if (currentWorkspacePath === null) continue;
          if (entry.projectPath !== currentWorkspacePath) continue;
        }
        checks.push({ pluginId, entry });
      }
    }

    const existResults = await Promise.all(
      checks.map(({ entry }) => stat(entry.installPath).then(() => true, () => false)),
    );

    return checks
      .filter((_, i) => !existResults[i])
      .map(({ pluginId, entry }) => ({
        id: pluginId,
        scope: entry.scope,
        installPath: entry.installPath,
        version: entry.version,
        installedAt: entry.installedAt,
        lastUpdated: entry.lastUpdated,
        projectPath: entry.projectPath,
      }));
  }

  /** 修正 plugin cache 目錄中 .sh 檔案的執行權限 */
  private async fixPluginPermissions(plugin: string): Promise<void> {
    const data = await this.settings.readInstalledPlugins();
    const entries = data.plugins[plugin];
    if (entries?.length) {
      await fixScriptPermissions(entries[0].installPath);
    }
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

/** CLI 的 "Source path does not exist" 錯誤 — marketplace 本地檔案未同步 */
function isSourcePathMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /source path does not exist/i.test(msg);
}
