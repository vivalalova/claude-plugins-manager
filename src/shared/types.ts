/**
 * Extension Host 和 Webview 共用的型別定義。
 * Settings 相關型別由 claude-settings-schema.ts 產生 generated types，再從這裡轉匯出。
 */

export type { ClaudeSettings, HookCommand } from './claude-settings-schema';

/** Marketplace 來源類型 */
export type MarketplaceSourceType = 'git' | 'github' | 'directory';

/** marketplace.json plugin source 欄位的 6 種格式 */
export type SourceFormatType =
  | 'local-internal'
  | 'local-external'
  | 'url'
  | 'url-subdir'
  | 'git-subdir'
  | 'github';

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

export type MarketplaceReinstallPhase =
  | 'clearingCache'
  | 'removingMarketplaces'
  | 'addingMarketplaces'
  | 'restoringSettings'
  | 'restoringPlugins'
  | 'completed';

export interface MarketplaceReinstallProgress {
  phase: MarketplaceReinstallPhase;
  current: number;
  total: number;
  detail?: string;
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
  contents?: PluginContents;
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
  /** 本地相對路徑（string）或遠端 URL 來源（object，如 { source: 'url', url: '...' }） */
  source: string | Record<string, unknown>;
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
  /** .md 檔案的絕對路徑（供詳情面板讀取） */
  path: string;
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
  /** 外部 plugin 的可瀏覽 GitHub URL（從 object-type source 提取） */
  sourceUrl?: string;
  /** marketplace.json source 欄位的格式分類（6 種） */
  sourceFormat?: SourceFormatType;
  /** plugin 來源目錄的最後修改時間（ISO 8601），用於偵測更新 */
  lastUpdated?: string;
}

/** installed_plugins.json 中 installPath 不存在的孤立 entry */
export interface OrphanedPlugin {
  id: string;
  scope: PluginScope;
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
  projectPath?: string;
}

/** Plugin listAvailable 的回傳結構 */
export interface PluginListResponse {
  installed: InstalledPlugin[];
  available: AvailablePlugin[];
  /** marketplace name → source URL（repo/path） */
  marketplaceSources: Record<string, string>;
  /** 各 scope 的 enabledPlugins（settings.json source of truth） */
  enabledByScope?: Record<PluginScope, EnabledPluginsMap>;
  /** installPath 不存在的孤立 entries */
  orphaned: OrphanedPlugin[];
}

/** MCP Server 連線狀態 */
export type McpStatus = 'connected' | 'failed' | 'needs-auth' | 'pending' | 'unknown';

/** MCP Server scope */
export type McpScope = 'local' | 'user' | 'project';

/** MCP Server 配置（plugin 自帶的 .mcp.json 格式） */
export interface McpServerConfig {
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  transport?: 'stdio' | 'sse' | 'http';
}

/** plugin 自帶的 MCP 來源資訊 */
export interface McpPluginSource {
  id: string;
  enabled: boolean;
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
  /** plugin 自帶的 MCP（如 context7） */
  plugin?: McpPluginSource;
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
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  it: 'Italiano',
  ru: 'Русский',
  ar: 'العربية',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  tr: 'Türkçe',
  pl: 'Polski',
  nl: 'Nederlands',
  uk: 'Українська',
  hi: 'हिन्दी',
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
  /** 外部 plugin 的可瀏覽 GitHub URL（從 object-type source 提取） */
  sourceUrl?: string;
  /** marketplace.json source 欄位的格式分類（6 種） */
  sourceFormat?: SourceFormatType;
  /** marketplace 上可用版本的最後修改時間（ISO 8601），用於偵測更新 */
  availableLastUpdated?: string;
  /** 所有已安裝 scope 中最新的 lastUpdated（mergePlugins 預計算，PluginCard 直接讀取） */
  lastUpdated?: string;
  /**
   * settings.json enabledPlugins 的 source of truth。
   * 涵蓋 installed_plugins.json 不存在 entry 的情況（如外部 repo plugin 由 CLI 啟用）。
   * undefined = enabledByScope 未提供（向後相容）。
   */
  settingsEnabledScopes?: PluginScope[];
  /** user scope 安裝（null = 未安裝） */
  userInstall: InstalledPlugin | null;
  /** project scope 安裝（可能多個 project） */
  projectInstalls: InstalledPlugin[];
  /** local scope 安裝（null = 未安裝） */
  localInstall: InstalledPlugin | null;
}

/** 路徑 + 存在性 */
export interface PathInfo {
  path: string;
  exists: boolean;
}

/** Extension Info 頁面資料 */
export interface ExtensionInfo {
  extensionVersion: string;
  extensionName: string;
  publisher: string;
  repoUrl: string | null;
  cliPath: string | null;
  cliVersion: string | null;
  cacheDirPath: PathInfo;
  pluginsDirPath: PathInfo;
  dataDirPath: PathInfo;
  installedPluginsPath: PathInfo;
  knownMarketplacesPath: PathInfo;
  extensionPath: PathInfo;
  preferencesPath: PathInfo;
  /** home dir 前綴（用於 UI 顯示 ~/ 縮寫） */
  homeDirPrefix: string;
}

// ---------------------------------------------------------------------------
// Agent Skills
// ---------------------------------------------------------------------------

/** Skill scope（CLI 僅支援 global + project，無 local） */
export type SkillScope = 'global' | 'project';

/** 對應 npx skills list --json 的結構 + SKILL.md frontmatter */
export interface AgentSkill {
  name: string;
  path: string;
  scope: SkillScope;
  agents: string[];
  description?: string;
  model?: string;
  context?: string;
  allowedTools?: string[];
}

/** skills.sh registry 列表項目 */
export interface RegistrySkill {
  rank: number;
  name: string;
  repo: string;
  installs: string;
  url: string;
}

/** skills.sh registry 排序方式 */
export type RegistrySort = 'all-time' | 'trending' | 'hot';

/** npx skills find 文字解析結果 */
export interface SkillSearchResult {
  fullId: string;
  name: string;
  repo: string;
  installs?: string;
  url?: string;
}
