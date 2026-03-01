import * as vscode from 'vscode';
import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';
import type {
  EnabledPluginsMap,
  InstalledPluginsFile,
  PluginScope,
  MarketplaceManifest,
  AvailablePlugin,
  PluginContents,
  PluginContentItem,
  PluginInstallEntry,
} from '../../shared/types';

const CLAUDE_DIR = join(homedir(), '.claude');
const PLUGINS_DIR = join(CLAUDE_DIR, 'plugins');
const INSTALLED_PLUGINS_PATH = join(PLUGINS_DIR, 'installed_plugins.json');
const MARKETPLACES_DIR = join(PLUGINS_DIR, 'marketplaces');
const KNOWN_MARKETPLACES_PATH = join(PLUGINS_DIR, 'known_marketplaces.json');
const EXTENSION_DIR = join(CLAUDE_DIR, 'claude-plugins-manager');
const PREFERENCES_PATH = join(EXTENSION_DIR, 'preferences.json');
const USER_SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');

/**
 * 直接讀寫 Claude Code 設定檔的共用 service。
 * 取代 CLI 呼叫，實現真正的 per-scope enable/disable。
 */
export class SettingsFileService {
  private scanInflight: Promise<AvailablePlugin[]> | null = null;

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

  /** 讀取指定 settings 檔的 enabledPlugins */
  async readEnabledPlugins(scope: PluginScope): Promise<EnabledPluginsMap> {
    const settings = await this.readJson<Record<string, unknown>>(
      this.getSettingsPath(scope),
    );
    return (settings.enabledPlugins ?? {}) as EnabledPluginsMap;
  }

  /** 清除指定 scope 的所有 enabledPlugins（單次 read-write） */
  async clearAllEnabledPlugins(scope: PluginScope): Promise<void> {
    const path = this.getSettingsPath(scope);
    const settings = await this.readJson<Record<string, unknown>>(path);
    settings.enabledPlugins = {};
    await writeFile(path, JSON.stringify(settings, null, 2) + '\n');
  }

  /** 寫入單一 plugin 的 enabled 狀態到指定 scope 的 settings 檔 */
  async setPluginEnabled(
    pluginId: string,
    scope: PluginScope,
    enabled: boolean,
  ): Promise<void> {
    const path = this.getSettingsPath(scope);
    const settings = await this.readJson<Record<string, unknown>>(path);
    const plugins = (settings.enabledPlugins ?? {}) as EnabledPluginsMap;

    if (enabled) {
      plugins[pluginId] = true;
    } else {
      delete plugins[pluginId];
    }

    settings.enabledPlugins = plugins;

    // project/local scope 可能尚未建立 .claude/ 目錄
    if (scope !== 'user') {
      await mkdir(dirname(path), { recursive: true });
    }

    await writeFile(path, JSON.stringify(settings, null, 2) + '\n');
  }

  /** 讀取 installed_plugins.json */
  async readInstalledPlugins(): Promise<InstalledPluginsFile> {
    return this.readJson<InstalledPluginsFile>(INSTALLED_PLUGINS_PATH, {
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
  }

  /** 移除一筆安裝 entry（by scope + projectPath） */
  async removeInstallEntry(
    pluginId: string,
    scope: PluginScope,
    projectPath?: string,
  ): Promise<void> {
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
  }

  /** 更新指定 plugin 的 installed entries 的 lastUpdated 時間戳 */
  async updateInstallEntryTimestamp(
    pluginId: string,
    scope?: PluginScope,
  ): Promise<void> {
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
  }

  /**
   * 掃描所有 marketplace 的 marketplace.json，回傳 available plugins。
   * 從 known_marketplaces.json 取得 marketplace 清單和實際路徑。
   */
  async scanAvailablePlugins(): Promise<AvailablePlugin[]> {
    if (this.scanInflight) {
      return this.scanInflight;
    }
    this.scanInflight = this.doScan();
    return this.scanInflight;
  }

  /** 實際掃描邏輯（by scanAvailablePlugins 快取驅動） */
  private async doScan(): Promise<AvailablePlugin[]> {
    let knownMarketplaces: Record<string, { installLocation?: string }>;
    try {
      knownMarketplaces = await this.readJson<Record<string, { installLocation?: string }>>(
        KNOWN_MARKETPLACES_PATH,
      );
    } catch {
      return [];
    }

    // 並行掃描所有 marketplace
    const perMarketplace = await Promise.all(
      Object.entries(knownMarketplaces).map(async ([mpName, mpEntry]) => {
        const mpDir = mpEntry.installLocation ?? join(MARKETPLACES_DIR, mpName);
        const manifestPath = join(mpDir, '.claude-plugin', 'marketplace.json');
        try {
          const manifest = await this.readJson<MarketplaceManifest>(manifestPath);
          return Promise.all(
            (manifest.plugins ?? []).map(async (p) => {
              // source 可能是 object（遠端 URL 型 plugin），此時本地無目錄
              const localSource = typeof p.source === 'string' ? p.source : null;
              const pluginDir = localSource ? resolve(mpDir, localSource) : null;
              let contents: AvailablePlugin['contents'];
              let pluginMeta: { description?: string; version?: string } = {};
              let lastUpdated: string | undefined;

              if (pluginDir) {
                [contents, pluginMeta] = await Promise.all([
                  this.scanPluginContents(pluginDir),
                  this.readJson<{ description?: string; version?: string }>(
                    join(pluginDir, '.claude-plugin', 'plugin.json'),
                  ).catch(() => ({} as { description?: string; version?: string })),
                ]);
                try {
                  const entries = await readdir(pluginDir);
                  const stats = await Promise.all(
                    entries.map((entry) =>
                      stat(join(pluginDir, entry)).catch((err: unknown) => {
                        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
                        return null;
                      }),
                    ),
                  );
                  const latestMtime = Math.max(0, ...stats.map((s) => s?.mtimeMs ?? 0));
                  if (latestMtime > 0) lastUpdated = new Date(latestMtime).toISOString();
                } catch (err: unknown) {
                  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
                }
              }

              return {
                pluginId: `${p.name}@${mpName}`,
                name: p.name,
                description: pluginMeta.description ?? p.description ?? '',
                marketplaceName: mpName,
                version: pluginMeta.version ?? p.version,
                contents,
                sourceDir: localSource ?? undefined,
                lastUpdated,
              } satisfies AvailablePlugin;
            }),
          );
        } catch {
          // marketplace 目錄可能不存在或格式錯誤，跳過
          return [] as AvailablePlugin[];
        }
      }),
    );

    return perMarketplace.flat();
  }

  /** 讀取所有 UI 偏好（檔案持久化） */
  async readPreferences(): Promise<Record<string, unknown>> {
    return this.readJson<Record<string, unknown>>(PREFERENCES_PATH, {});
  }

  /** 序列化 preferences 寫入，避免併發 read-modify-write 互相覆蓋 */
  private prefWriteQueue: Promise<void> = Promise.resolve();

  /** 寫入單一 UI 偏好 key（檔案持久化） */
  async writePreference(key: string, value: unknown): Promise<void> {
    const task = this.prefWriteQueue.then(async () => {
      const prefs = await this.readPreferences();
      prefs[key] = value;
      await mkdir(EXTENSION_DIR, { recursive: true });
      await writeFile(PREFERENCES_PATH, JSON.stringify(prefs, null, 2) + '\n');
    });
    this.prefWriteQueue = task.catch(() => {});
    return task;
  }

  /**
   * 讀取各 marketplace 的 source URL（repo/path）。
   * 回傳 Record<marketplace name, source URL string>。
   */
  async readMarketplaceSources(): Promise<Record<string, string>> {
    const known = await this.readJson<
      Record<string, { source: { url?: string; repo?: string; path?: string } }>
    >(KNOWN_MARKETPLACES_PATH);

    const result: Record<string, string> = {};
    for (const [name, entry] of Object.entries(known)) {
      const src = entry?.source;
      if (src) {
        result[name] = src.url ?? src.repo ?? src.path ?? '';
      }
    }
    return result;
  }

  /**
   * 掃描 plugin 目錄，回傳其包含的 commands/skills/agents/mcpServers/hooks。
   * 從 .md frontmatter 解析 name + description，fallback 為檔案名稱。
   */
  async scanPluginContents(pluginDir: string): Promise<PluginContents> {
    const contents: PluginContents = {
      commands: [],
      skills: [],
      agents: [],
      mcpServers: [],
      hooks: false,
    };

    const [commands, skills, agents, mcpKeys, hasHooks] = await Promise.all([
      this.scanMdDir(join(pluginDir, 'commands')),
      this.scanSkillsDir(join(pluginDir, 'skills')),
      this.scanMdDir(join(pluginDir, 'agents')),
      this.readJson<Record<string, unknown>>(join(pluginDir, '.mcp.json'))
        .then((mcp) => Object.keys(mcp))
        .catch(() => [] as string[]),
      stat(join(pluginDir, 'hooks', 'hooks.json'))
        .then(() => true)
        .catch(() => false),
    ]);

    contents.commands = commands;
    contents.skills = skills;
    contents.agents = agents;
    contents.mcpServers = mcpKeys;
    contents.hooks = hasHooks;

    return contents;
  }

  /**
   * 掃描目錄下所有 .md 檔，從 frontmatter 解析 name + description。
   * Fallback: name = 檔名（去 .md），description = ''。
   */
  private async scanMdDir(dir: string): Promise<PluginContentItem[]> {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return [];
    }

    const mdFiles = files.filter((f) => f.endsWith('.md'));
    const fmResults = await Promise.all(
      mdFiles.map((file) => this.parseFrontmatter(join(dir, file))),
    );

    return mdFiles.map((file, i) => {
      const fallbackName = file.replace(/\.md$/, '');
      const fm = fmResults[i];
      return {
        name: fm.name || fm.description ? (fm.name || fallbackName) : fallbackName,
        description: fm.description ?? '',
      };
    });
  }

  /**
   * 掃描 skills 目錄：每個子目錄有 SKILL.md，或者根目錄有 SKILL.md。
   */
  private async scanSkillsDir(dir: string): Promise<PluginContentItem[]> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }

    const results = await Promise.all(
      entries.map(async (entry) => {
        const skillMd = join(dir, entry, 'SKILL.md');
        try {
          await stat(skillMd);
          const fm = await this.parseFrontmatter(skillMd);
          return {
            name: fm.name || entry,
            description: fm.description ?? '',
          };
        } catch {
          return null;
        }
      }),
    );
    return results.filter((r): r is PluginContentItem => r !== null);
  }

  /** 從 .md 檔案解析 YAML frontmatter 的 name 和 description */
  private async parseFrontmatter(
    filePath: string,
  ): Promise<{ name?: string; description?: string }> {
    try {
      const raw = await readFile(filePath, 'utf-8');
      if (!raw.startsWith('---')) return {};

      const endIdx = raw.indexOf('---', 3);
      if (endIdx === -1) return {};

      const yaml = raw.slice(3, endIdx);
      const result: Record<string, string> = {};
      for (const line of yaml.split('\n')) {
        const match = line.match(/^(\w[\w-]*):\s*"?(.*?)"?\s*$/);
        if (match) {
          result[match[1]] = match[2];
        }
      }
      return { name: result.name, description: result.description };
    } catch {
      return {};
    }
  }

  /** 讀取 JSON 檔，ENOENT 時回傳預設值，JSON parse error 時 throw（fail-fast） */
  private async readJson<T>(filePath: string, defaultValue?: T): Promise<T> {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        if (defaultValue !== undefined) return defaultValue;
        return {} as T;
      }
      throw err;
    }
    try {
      return JSON.parse(content) as T;
    } catch (err: unknown) {
      throw new Error(
        `Invalid JSON in ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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
