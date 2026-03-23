import * as vscode from 'vscode';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type {
  EnabledPluginsMap,
  InstalledPluginsFile,
  PluginScope,
  AvailablePlugin,
  PluginInstallEntry,
} from '../../shared/types';
import { KeyedWriteQueue } from '../utils/WriteQueue';
import { readJsonFile } from '../utils/jsonFile';
import { PluginCatalogScanner } from './PluginCatalogScanner';

const CLAUDE_DIR = join(homedir(), '.claude');
const PLUGINS_DIR = join(CLAUDE_DIR, 'plugins');
const INSTALLED_PLUGINS_PATH = join(PLUGINS_DIR, 'installed_plugins.json');
const MARKETPLACES_DIR = join(PLUGINS_DIR, 'marketplaces');
const KNOWN_MARKETPLACES_PATH = join(PLUGINS_DIR, 'known_marketplaces.json');
const USER_SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');

/**
 * 直接讀寫 Claude Code 設定檔的共用 service。
 * 取代 CLI 呼叫，實現真正的 per-scope enable/disable。
 */
export class SettingsFileService {
  private scanInflight: Promise<AvailablePlugin[]> | null = null;
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
      await writeFile(path, JSON.stringify(settings, null, 2) + '\n');
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
   */
  async getSettings(scope: PluginScope): Promise<Record<string, unknown>> {
    return readJsonFile<Record<string, unknown>>(this.getSettingsPath(scope), {});
  }

  /**
   * 設定指定 scope 的單一 key（read-modify-write）。
   * 使用 raw object 保留 $schema 等額外欄位；project/local scope 自動 mkdir。
   */
  async setSetting(scope: PluginScope, key: string, value: unknown): Promise<void> {
    return this.updateScopedSettingsFile(scope, (settings) => {
      settings[key] = value;
      return true;
    });
  }

  /**
   * 刪除指定 scope 的頂層 key（read-modify-write）。
   * 檔案不存在（ENOENT）則 no-op；readJsonFile 已處理 ENOENT 回傳 {}。
   */
  async deleteSetting(scope: PluginScope, key: string): Promise<void> {
    return this.updateScopedSettingsFile(scope, (settings) => {
      if (!(key in settings)) {
        return false;
      }
      delete settings[key];
      return true;
    });
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
      if (error instanceof Error && error.message.includes('No workspace')) {
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
    await writeFile(
      INSTALLED_PLUGINS_PATH,
      JSON.stringify(data, null, 2) + '\n',
    );
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
    if (this.scanInflight) {
      return this.scanInflight;
    }
    this.scanInflight = this.doScan().catch((err) => {
      this.scanInflight = null;
      throw err;
    });
    return this.scanInflight;
  }

  /** 實際掃描邏輯（by scanAvailablePlugins 快取驅動） */
  private async doScan(): Promise<AvailablePlugin[]> {
    return this.pluginCatalogScanner.scanAvailablePlugins();
  }

  /**
   * 讀取各 marketplace 的 source URL（repo/path）。
   * 回傳 Record<marketplace name, source URL string>。
   */
  async readMarketplaceSources(): Promise<Record<string, string>> {
    return this.pluginCatalogScanner.readMarketplaceSources();
  }

  /** 取得當前 workspace 根路徑 */
  private getWorkspacePath(): string {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error(
        'No workspace folder open. Project/local scope requires an open workspace.',
      );
    }
    return folder.uri.fsPath;
  }
}
