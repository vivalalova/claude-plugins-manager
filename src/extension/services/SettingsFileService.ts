import * as vscode from 'vscode';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
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
const USER_SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');

/**
 * 直接讀寫 Claude Code 設定檔的共用 service。
 * 取代 CLI 呼叫，實現真正的 per-scope enable/disable。
 */
export class SettingsFileService {
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

  /**
   * 掃描所有 marketplace 的 marketplace.json，回傳 available plugins。
   * 從 known_marketplaces.json 取得 marketplace 清單和實際路徑。
   */
  async scanAvailablePlugins(): Promise<AvailablePlugin[]> {
    const result: AvailablePlugin[] = [];

    let knownMarketplaces: Record<string, { installLocation?: string }>;
    try {
      knownMarketplaces = await this.readJson<Record<string, { installLocation?: string }>>(
        KNOWN_MARKETPLACES_PATH,
      );
    } catch {
      return result;
    }

    for (const [mpName, mpEntry] of Object.entries(knownMarketplaces)) {
      // 使用 installLocation，fallback 為預設路徑
      const mpDir = mpEntry.installLocation ?? join(MARKETPLACES_DIR, mpName);
      const manifestPath = join(mpDir, '.claude-plugin', 'marketplace.json');
      try {
        const manifest = await this.readJson<MarketplaceManifest>(manifestPath);
        for (const p of manifest.plugins ?? []) {
          const pluginDir = resolve(mpDir, p.source ?? '.');
          const contents = await this.scanPluginContents(pluginDir);
          result.push({
            pluginId: `${p.name}@${mpName}`,
            name: p.name,
            description: p.description ?? '',
            marketplaceName: mpName,
            version: p.version,
            contents,
            sourceDir: typeof p.source === 'string' ? p.source : undefined,
          });
        }
      } catch {
        // marketplace 目錄可能不存在或格式錯誤，跳過
      }
    }

    return result;
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

    // commands/*.md
    contents.commands = await this.scanMdDir(join(pluginDir, 'commands'));

    // skills/*/SKILL.md or skills/skill-name/SKILL.md
    contents.skills = await this.scanSkillsDir(join(pluginDir, 'skills'));

    // agents/*.md
    contents.agents = await this.scanMdDir(join(pluginDir, 'agents'));

    // .mcp.json
    try {
      const mcp = await this.readJson<Record<string, unknown>>(
        join(pluginDir, '.mcp.json'),
      );
      contents.mcpServers = Object.keys(mcp);
    } catch {
      // no .mcp.json
    }

    // hooks/hooks.json
    try {
      await stat(join(pluginDir, 'hooks', 'hooks.json'));
      contents.hooks = true;
    } catch {
      // no hooks
    }

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

    const items: PluginContentItem[] = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const fallbackName = file.replace(/\.md$/, '');
      const fm = await this.parseFrontmatter(join(dir, file));
      items.push({
        name: fm.name || fm.description ? (fm.name || fallbackName) : fallbackName,
        description: fm.description ?? '',
      });
    }
    return items;
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

    const items: PluginContentItem[] = [];
    for (const entry of entries) {
      const skillMd = join(dir, entry, 'SKILL.md');
      try {
        await stat(skillMd);
        const fm = await this.parseFrontmatter(skillMd);
        items.push({
          name: fm.name || entry,
          description: fm.description ?? '',
        });
      } catch {
        // 非目錄或無 SKILL.md，跳過
      }
    }
    return items;
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

  /** 讀取 JSON 檔，不存在時回傳預設值 */
  private async readJson<T>(filePath: string, defaultValue?: T): Promise<T> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      if (defaultValue !== undefined) return defaultValue;
      return {} as T;
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
