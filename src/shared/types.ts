/**
 * Extension Host 和 Webview 共用的型別定義。
 * 唯一的型別來源，禁止在其他檔案重複定義。
 */

/** Marketplace 來源類型 */
export type MarketplaceSourceType = 'git' | 'github' | 'directory';

/**
 * Marketplace 完整資訊。
 * 資料來源：~/.claude/plugins/known_marketplaces.json
 * （CLI `list --json` 是精簡版，缺 lastUpdated / autoUpdate）
 */
export interface Marketplace {
  name: string;
  source: MarketplaceSourceType;
  url?: string;
  repo?: string;
  path?: string;
  installLocation: string;
  lastUpdated?: string;
  autoUpdate: boolean;
}

/** Plugin 安裝 scope */
export type PluginScope = 'user' | 'project' | 'local';

/**
 * installed_plugins.json 中的單一安裝 entry。
 * 一個 plugin 可有多個 entry（不同 scope）。
 */
export interface PluginInstallEntry {
  scope: PluginScope;
  projectPath?: string;
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
  gitCommitSha?: string;
}

/** ~/.claude/plugins/installed_plugins.json 完整結構 */
export interface InstalledPluginsFile {
  version: number;
  plugins: Record<string, PluginInstallEntry[]>;
}

/** settings.json 中的 enabledPlugins 區塊 */
export type EnabledPluginsMap = Record<string, boolean>;

/** Webview 用的已安裝 plugin（合併 install entry + enabled 狀態） */
export interface InstalledPlugin {
  id: string;
  version: string;
  scope: PluginScope;
  enabled: boolean;
  installPath: string;
  installedAt: string;
  lastUpdated: string;
  projectPath?: string;
  description?: string;
  mcpServers?: Record<string, McpServerConfig>;
}

/** Marketplace preview 的 plugin 摘要（加入前預覽） */
export interface PreviewPlugin {
  name: string;
  description: string;
  version?: string;
}

/** marketplace.json 內的單一 plugin entry */
export interface MarketplacePluginEntry {
  name: string;
  description?: string;
  version?: string;
  source: string;
}

/** marketplace 目錄的 .claude-plugin/marketplace.json */
export interface MarketplaceManifest {
  name: string;
  description?: string;
  plugins: MarketplacePluginEntry[];
}

/** Plugin 內含元件的名稱 + 描述 */
export interface PluginContentItem {
  name: string;
  description: string;
}

/** Plugin 內部包含的元件 */
export interface PluginContents {
  commands: PluginContentItem[];
  skills: PluginContentItem[];
  agents: PluginContentItem[];
  mcpServers: string[];
  hooks: boolean;
}

/** Webview 用的可安裝 plugin */
export interface AvailablePlugin {
  pluginId: string;
  name: string;
  description: string;
  marketplaceName: string;
  version?: string;
  // /** plugin.json 的 author（string 或 { name } → 正規化為 string）。目前 UI 未使用（同 section 同作者）。 */
  // author?: string;
  contents?: PluginContents;
  /** marketplace.json 中的 source 欄位（相對路徑，如 ./plugins/foo） */
  sourceDir?: string;
  /** plugin 來源目錄的最後修改時間（ISO 8601），用於偵測更新 */
  lastUpdated?: string;
}

/** Plugin listAvailable 的回傳結構 */
export interface PluginListResponse {
  installed: InstalledPlugin[];
  available: AvailablePlugin[];
  /** marketplace name → source URL（repo/path） */
  marketplaceSources: Record<string, string>;
}

/** MCP Server 連線狀態 */
export type McpStatus = 'connected' | 'failed' | 'needs-auth' | 'pending' | 'unknown';

/** MCP Server scope */
export type McpScope = 'local' | 'user' | 'project';

/** MCP Server 配置（plugin 自帶的 .mcp.json 格式） */
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** 從 `claude mcp list` 解析的 MCP server 資訊 */
export interface McpServer {
  name: string;
  fullName: string;
  /** 顯示用的完整指令字串（如 "npx -y foo"） */
  command: string;
  status: McpStatus;
  scope?: McpScope;
  /** 結構化設定（從設定檔讀取的 command/args/env） */
  config?: McpServerConfig;
}

/** MCP add 操作參數 */
export interface McpAddParams {
  name: string;
  commandOrUrl: string;
  args?: string[];
  transport?: 'stdio' | 'sse' | 'http';
  scope?: McpScope;
  env?: Record<string, string>;
  headers?: string[];
}

/** 翻譯目標語言 allowlist（前後端共用） */
export const TRANSLATE_LANGS: Record<string, string> = {
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
};

/**
 * Webview 用的合併 plugin 結構。
 * 一個 plugin 一張卡片，每個 scope 各自有安裝狀態和 enabled 狀態。
 */
export interface MergedPlugin {
  id: string;
  name: string;
  marketplaceName?: string;
  description?: string;
  version?: string;
  // /** plugin.json 的 author。目前 UI 未使用（同 section 同作者）。 */
  // author?: string;
  contents?: PluginContents;
  /** marketplace.json 中的 source 欄位（相對路徑，如 ./plugins/foo） */
  sourceDir?: string;
  /** marketplace 上可用版本的最後修改時間（ISO 8601），用於偵測更新 */
  availableLastUpdated?: string;
  /** 所有已安裝 scope 中最新的 lastUpdated（mergePlugins 預計算，PluginCard 直接讀取） */
  lastUpdated?: string;
  /** user scope 安裝（null = 未安裝） */
  userInstall: InstalledPlugin | null;
  /** project scope 安裝（可能多個 project） */
  projectInstalls: InstalledPlugin[];
  /** local scope 安裝（null = 未安裝） */
  localInstall: InstalledPlugin | null;
}
