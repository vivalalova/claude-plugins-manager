import * as vscode from 'vscode';
import { readFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { parseFrontmatter } from '../utils/frontmatter';
import { NoWorkspaceError } from '../utils/workspace';
import type {
  EnabledPluginsMap,
  InstalledPluginsFile,
  PluginScope,
  AvailablePlugin,
  PluginInstallEntry,
  PluginContents,
} from '../../shared/types';
import { KeyedWriteQueue } from '../utils/WriteQueue';
import { readJsonFile, readJsonFileStrict, writeJsonFileAtomic } from '../utils/jsonFile';
import { PluginCatalogScanner, type PluginCatalogSnapshot } from './PluginCatalogScanner';
import { getFlatFieldSchema, getGlobalConfigSettingKeys } from '../../shared/claude-settings-schema';
import {
  CLAUDE_JSON_PATH,
  INSTALLED_PLUGINS_PATH,
  MARKETPLACES_DIR,
  KNOWN_MARKETPLACES_PATH,
  USER_SETTINGS_PATH,
} from '../paths';

/**
 * 直接讀寫 Claude Code 設定檔的共用 service。
 * 取代 CLI 呼叫，實現真正的 per-scope enable/disable。
 */
export class SettingsFileService {
  private scanInflight: Promise<PluginCatalogSnapshot> | null = null;
  private readonly settingsWriteQueues = new KeyedWriteQueue();
  private readonly pluginCatalogScanner = new PluginCatalogScanner({
    knownMarketplacesPath: KNOWN_MARKETPLACES_PATH,
    marketplacesDir: MARKETPLACES_DIR,
  });

  private async updateScopedSettingsFile(
    scope: PluginScope,
    mutate: (settings: Record<string, unknown>) => boolean,
  ): Promise<void> {
    const path = this.getSettingsPath(scope);
    return this.settingsWriteQueues.enqueue(path, async () => {
      const settings = await readJsonFile<Record<string, unknown>>(path, {});
      const shouldWrite = mutate(settings);
      if (!shouldWrite) {
        return;
      }
      if (scope !== 'user') {
        await mkdir(dirname(path), { recursive: true });
      }
      await writeJsonFileAtomic(path, settings);
    });
  }

  /** 清除掃描快取，下次 scanAvailablePlugins 將重新掃描 */
  invalidateScanCache(): void {
    this.scanInflight = null;
  }

  /** 取得 scope 對應的 settings.json 路徑 */
  getSettingsPath(scope: PluginScope): string {
    switch (scope) {
      case 'user':
        return USER_SETTINGS_PATH;
      case 'project': {
        const folder = this.getWorkspacePath();
        return join(folder, '.claude', 'settings.json');
      }
      case 'local': {
        const folder = this.getWorkspacePath();
        return join(folder, '.claude', 'settings.local.json');
      }
    }
  }

  /**
   * 讀取指定 scope 的 settings.json，回傳 raw JSON object。
   * 不做跨 scope 合併；檔案不存在回傳 {}。
   * scope='user' 時額外以 ~/.claude.json（globalConfig）覆蓋 storageFile='globalConfig' 的 key：
   * 存在則覆蓋、不存在則刪除（避免 settings.json 殘留舊值誤導 UI）。
   */
  async getSettings(scope: PluginScope): Promise<Record<string, unknown>> {
    const settings = await readJsonFile<Record<string, unknown>>(this.getSettingsPath(scope), {});
    if (scope !== 'user') {
      return settings;
    }
    const globalConfig = await readJsonFile<Record<string, unknown>>(CLAUDE_JSON_PATH, {});
    for (const key of getGlobalConfigSettingKeys()) {
      if (key in globalConfig) {
        settings[key] = globalConfig[key];
      } else {
        delete settings[key];
      }
    }
    return settings;
  }

  /**
   * 設定指定 scope 的單一 key（read-modify-write）。
   * 使用 raw object 保留 $schema 等額外欄位；project/local scope 自動 mkdir。
   * scope='user' 且 key 為 storageFile='globalConfig' 時改寫 ~/.claude.json。
   */
  async setSetting(scope: PluginScope, key: string, value: unknown): Promise<void> {
    if (scope === 'user' && getFlatFieldSchema(key)?.storageFile === 'globalConfig') {
      return this.setGlobalConfigSetting(key, value);
    }
    return this.updateScopedSettingsFile(scope, (settings) => {
      settings[key] = value;
      return true;
    });
  }

  /**
   * 刪除指定 scope 的頂層 key（read-modify-write）。
   * 檔案不存在（ENOENT）則 no-op；readJsonFile 已處理 ENOENT 回傳 {}。
   * scope='user' 且 key 為 storageFile='globalConfig' 時改動 ~/.claude.json。
   */
  async deleteSetting(scope: PluginScope, key: string): Promise<void> {
    if (scope === 'user' && getFlatFieldSchema(key)?.storageFile === 'globalConfig') {
      return this.deleteGlobalConfigSetting(key);
    }
    return this.updateScopedSettingsFile(scope, (settings) => {
      if (!(key in settings)) {
        return false;
      }
      delete settings[key];
      return true;
    });
  }

  /**
   * read-merge-write ~/.claude.json（globalConfig）的共用 helper。
   * mutate 回傳 false 時略過寫入；tolerateMissing=true 時缺檔（ENOENT）視為 no-op 而非拋錯。
   *
   * 已知限制：行程內寫入以 KeyedWriteQueue 序列化，但對「跨行程」（live claude CLI session
   * 也會寫 ~/.claude.json）是 lock-free 的 read-merge-write——極端時序下（read 與 rename 之間
   * 對方寫入）會以舊快照覆蓋對方的變更（lost update，非半寫壞檔；寫入本身 temp+rename 原子）。
   * claude CLI 多 session 之間同為 lock-free 寫者，故不另實作跨行程檔鎖。
   */
  private async updateGlobalConfigFile(
    mutate: (config: Record<string, unknown>) => boolean,
    options: { tolerateMissing?: boolean } = {},
  ): Promise<void> {
    return this.settingsWriteQueues.enqueue(CLAUDE_JSON_PATH, async () => {
      let config: Record<string, unknown>;
      try {
        config = await readJsonFileStrict<Record<string, unknown>>(CLAUDE_JSON_PATH);
      } catch (err) {
        if (options.tolerateMissing && (err as NodeJS.ErrnoException).code === 'ENOENT') {
          return;
        }
        throw err;
      }
      const shouldWrite = mutate(config);
      if (!shouldWrite) return;
      await writeJsonFileAtomic(CLAUDE_JSON_PATH, config);
    });
  }

  /** 寫入單一 global config key（~/.claude.json，read-merge-write）。缺檔/parse 失敗 fail-fast。 */
  async setGlobalConfigSetting(key: string, value: unknown): Promise<void> {
    return this.updateGlobalConfigFile((config) => {
      config[key] = value;
      return true;
    });
  }

  /** 刪除單一 global config key（~/.claude.json）。缺檔 → no-op；key 不存在 → no-op；parse 失敗 → fail-fast。 */
  async deleteGlobalConfigSetting(key: string): Promise<void> {
    return this.updateGlobalConfigFile(
      (config) => {
        if (!(key in config)) return false;
        delete config[key];
        return true;
      },
      { tolerateMissing: true },
    );
  }

  /**
   * 讀取 plugin content item 的 .md 檔並解析 frontmatter + body。
   * 供 plugin.getContentDetail 請求使用。
   */
  async getContentDetail(filePath: string): Promise<{ frontmatter: Record<string, string>; body: string }> {
    const content = await readFile(filePath, 'utf-8');
    return parseFrontmatter(content);
  }

  /** 讀取指定 settings 檔的 enabledPlugins */
  async readEnabledPlugins(scope: PluginScope): Promise<EnabledPluginsMap> {
    const settings = await readJsonFile<Record<string, unknown>>(
      this.getSettingsPath(scope),
      {},
    );
    return (settings.enabledPlugins ?? {}) as EnabledPluginsMap;
  }

  /**
   * 讀取三個 scope 的 enabledPlugins。
   * project/local scope 無 workspace 時回傳 `{}`，不拋錯。
   */
  async readAllEnabledPlugins(): Promise<Record<PluginScope, EnabledPluginsMap>> {
    const [user, project, local] = await Promise.all([
      this.readEnabledPlugins('user'),
      this.readScopedEnabledPlugins('project'),
      this.readScopedEnabledPlugins('local'),
    ]);
    return { user, project, local };
  }

  /** 讀取 project/local scope 的 enabledPlugins，無 workspace 時回傳 `{}` */
  private async readScopedEnabledPlugins(scope: Extract<PluginScope, 'project' | 'local'>): Promise<EnabledPluginsMap> {
    try {
      return await this.readEnabledPlugins(scope);
    } catch (error) {
      if (error instanceof NoWorkspaceError) {
        return {};
      }
      throw error;
    }
  }

  /** 清除指定 scope 的所有 enabledPlugins（單次 read-write） */
  async clearAllEnabledPlugins(scope: PluginScope): Promise<void> {
    return this.updateScopedSettingsFile(scope, (settings) => {
      settings.enabledPlugins = {};
      return true;
    });
  }

  /** 以快照完整覆蓋指定 scope 的 enabledPlugins，保留其他 settings 欄位 */
  async replaceEnabledPlugins(scope: PluginScope, enabledPlugins: EnabledPluginsMap): Promise<void> {
    return this.updateScopedSettingsFile(scope, (settings) => {
      settings.enabledPlugins = { ...enabledPlugins };
      return true;
    });
  }

  /** 寫入單一 plugin 的 enabled 狀態到指定 scope 的 settings 檔 */
  async setPluginEnabled(
    pluginId: string,
    scope: PluginScope,
    enabled: boolean,
  ): Promise<void> {
    return this.updateScopedSettingsFile(scope, (settings) => {
      const plugins = (settings.enabledPlugins ?? {}) as EnabledPluginsMap;

      if (enabled) {
        plugins[pluginId] = true;
      } else {
        delete plugins[pluginId];
      }

      settings.enabledPlugins = plugins;
      return true;
    });
  }

  /** 讀取 installed_plugins.json */
  async readInstalledPlugins(): Promise<InstalledPluginsFile> {
    return readJsonFile<InstalledPluginsFile>(INSTALLED_PLUGINS_PATH, {
      version: 2,
      plugins: {},
    });
  }

  /** 寫入 installed_plugins.json */
  async writeInstalledPlugins(data: InstalledPluginsFile): Promise<void> {
    await writeJsonFileAtomic(INSTALLED_PLUGINS_PATH, data);
  }

  /** 新增一筆安裝 entry */
  async addInstallEntry(
    pluginId: string,
    entry: PluginInstallEntry,
  ): Promise<void> {
    return this.settingsWriteQueues.enqueue(INSTALLED_PLUGINS_PATH, async () => {
      const data = await this.readInstalledPlugins();
      const entries = data.plugins[pluginId] ?? [];
      // 避免重複（同 scope + 同 projectPath）
      const exists = entries.some(
        (e) => e.scope === entry.scope && e.projectPath === entry.projectPath,
      );
      if (!exists) {
        entries.push(entry);
        data.plugins[pluginId] = entries;
        await this.writeInstalledPlugins(data);
      }
    });
  }

  /** 移除一筆安裝 entry（by scope + projectPath） */
  async removeInstallEntry(
    pluginId: string,
    scope: PluginScope,
    projectPath?: string,
  ): Promise<void> {
    return this.settingsWriteQueues.enqueue(INSTALLED_PLUGINS_PATH, async () => {
      const data = await this.readInstalledPlugins();
      const entries = data.plugins[pluginId];
      if (!entries) return;

      data.plugins[pluginId] = entries.filter(
        (e) => !(e.scope === scope && e.projectPath === projectPath),
      );
      if (data.plugins[pluginId].length === 0) {
        delete data.plugins[pluginId];
      }
      await this.writeInstalledPlugins(data);
    });
  }

  /** 更新指定 plugin 的 installed entries 的 lastUpdated 時間戳 */
  async updateInstallEntryTimestamp(
    pluginId: string,
    scope?: PluginScope,
  ): Promise<void> {
    return this.settingsWriteQueues.enqueue(INSTALLED_PLUGINS_PATH, async () => {
      const data = await this.readInstalledPlugins();
      const entries = data.plugins[pluginId];
      if (!entries) return;

      const now = new Date().toISOString();
      for (const entry of entries) {
        if (!scope || entry.scope === scope) {
          entry.lastUpdated = now;
        }
      }
      await this.writeInstalledPlugins(data);
    });
  }

  /**
   * 掃描所有 marketplace 的 marketplace.json，回傳 available plugins。
   * 從 known_marketplaces.json 取得 marketplace 清單和實際路徑。
   */
  async scanAvailablePlugins(): Promise<AvailablePlugin[]> {
    const snapshot = await this.scanPluginCatalog();
    return snapshot.availablePlugins;
  }

  /** 實際掃描邏輯（快取同一份 plugin catalog snapshot） */
  private async scanPluginCatalog(): Promise<PluginCatalogSnapshot> {
    if (this.scanInflight) {
      return this.scanInflight;
    }
    this.scanInflight = this.doScan().catch((err) => {
      this.scanInflight = null;
      throw err;
    });
    return this.scanInflight;
  }

  private async doScan(): Promise<PluginCatalogSnapshot> {
    return this.pluginCatalogScanner.scanCatalog();
  }

  /** 回傳 manifest 可讀的 marketplace 名稱集合（用於 stale entry pruning） */
  async readScannableMarketplaceNames(): Promise<Set<string>> {
    const snapshot = await this.scanPluginCatalog();
    return snapshot.scannableMarketplaceNames;
  }

  /**
   * 讀取各 marketplace 的 source URL（repo/path）。
   * 回傳 Record<marketplace name, source URL string>。
   */
  async readMarketplaceSources(): Promise<Record<string, string>> {
    return this.pluginCatalogScanner.readMarketplaceSources();
  }

  /** 掃描指定目錄的 plugin contents（commands/skills/agents/mcp/hooks） */
  async scanPluginContentsAt(dir: string): Promise<PluginContents> {
    return this.pluginCatalogScanner.scanPluginContents(dir);
  }

  /** 取得當前 workspace 根路徑 */
  private getWorkspacePath(): string {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new NoWorkspaceError();
    }
    return folder.uri.fsPath;
  }
}
