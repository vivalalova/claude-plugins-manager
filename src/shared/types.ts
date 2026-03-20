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

/** Hook command discriminated union（四種 hook type） */
export type HookCommand =
  | { type: 'command'; command: string; timeout?: number; async?: boolean; statusMessage?: string }
  | { type: 'prompt'; prompt: string; model?: string; timeout?: number; statusMessage?: string }
  | { type: 'agent'; prompt: string; model?: string; timeout?: number; statusMessage?: string }
  | { type: 'http'; url: string; headers?: Record<string, string>; timeout?: number; statusMessage?: string; allowedEnvVars?: string[] };

/**
 * Claude Code settings.json 結構。
 * enabledPlugins 由 PluginService 專屬管理，不在此列。
 */
export interface ClaudeSettings {
  /** 使用的 Claude 模型 ID。對應 docs: model */
  model?: string;
  /** 工具呼叫的 allow/deny/ask 規則 + defaultMode + additionalDirectories。對應 docs: permissions */
  permissions?: { allow?: string[]; deny?: string[]; ask?: string[]; defaultMode?: string; disableBypassPermissionsMode?: 'disable'; additionalDirectories?: string[] };
  /** 注入每次 session 的環境變數 key-value map。對應 docs: env */
  env?: Record<string, string>;
  /** lifecycle hooks（PreToolUse/PostToolUse/Stop 等）→ matcher + hook command array。對應 docs: hooks */
  hooks?: Record<string, Array<{ matcher?: string; hooks: HookCommand[] }>>;
  /** 思考深度，影響 token 用量。high=最多思考、medium=預設、low=最快。對應 docs: effortLevel */
  effortLevel?: 'high' | 'medium' | 'low';
  /** Claude 回應語言（如 "zh-TW"、"ja"）。對應 docs: language */
  language?: string;
  /** 限制可選用的模型清單；設定後 model 選項僅限此清單。對應 docs: availableModels */
  availableModels?: string[];
  /** 自動啟用 .mcp.json 中所有 project MCP server，不逐一詢問。對應 docs: enableAllProjectMcpServers */
  enableAllProjectMcpServers?: boolean;
  /** 允許自動啟用的 .mcp.json server 名稱清單（白名單）。對應 docs: enabledMcpjsonServers */
  enabledMcpjsonServers?: string[];
  /** 禁止自動啟用的 .mcp.json server 名稱清單（黑名單）。對應 docs: disabledMcpjsonServers */
  disabledMcpjsonServers?: string[];
  /** 是否在 system prompt 加入 git context（branch、diff 等）。對應 docs: includeGitInstructions */
  includeGitInstructions?: boolean;
  /** 是否遵守 .gitignore 過濾檔案建議。對應 docs: respectGitignore */
  respectGitignore?: boolean;
  /** 輸出風格（自由字串，如 "default"、"Explanatory"、"Learning"）。對應 docs: outputStyle */
  outputStyle?: string;
  /** 啟用快速模式（使用相同模型加速輸出速度）。對應 docs: fastMode */
  fastMode?: boolean;
  /** 允許每個 session 個別 opt-in 快速模式。對應 docs: fastModePerSessionOptIn */
  fastModePerSessionOptIn?: boolean;
  /** 自動寫入 memory（CLAUDE.md）功能開關。對應 docs: autoMemoryEnabled */
  autoMemoryEnabled?: boolean;
  /** stable = 穩定版更新；latest = 最新版即時更新。對應 docs: autoUpdatesChannel */
  autoUpdatesChannel?: 'stable' | 'latest';
  /** 自動清理暫存檔案的週期（天數）。對應 docs: cleanupPeriodDays */
  cleanupPeriodDays?: number;
  /** 強制每次回應都啟用 extended thinking。對應 docs: alwaysThinkingEnabled */
  alwaysThinkingEnabled?: boolean;
  /** 強制指定登入方式：claudeai = Claude.ai 登入；console = Anthropic Console 登入。對應 docs: forceLoginMethod */
  forceLoginMethod?: 'claudeai' | 'console';
  /** 強制使用特定組織 UUID 登入（企業用途）。對應 docs: forceLoginOrgUUID */
  forceLoginOrgUUID?: string;
  /** commit/PR 的 attribution 格式設定（commit 訊息 footer、PR body template）。對應 docs: attribution */
  attribution?: { commit?: string; pr?: string };
  /** TodoWrite plans 的儲存目錄路徑。對應 docs: plansDirectory */
  plansDirectory?: string;
  /** 取得 API key 的 shell 指令（stdout 輸出即 API key）。對應 docs: apiKeyHelper */
  apiKeyHelper?: string;
  /** 取得 OpenTelemetry headers 的 shell 指令。對應 docs: otelHeadersHelper */
  otelHeadersHelper?: string;
  /** 匯出 AWS 認證的 shell 指令。對應 docs: awsCredentialExport */
  awsCredentialExport?: string;
  /** 刷新 AWS 認證的 shell 指令。對應 docs: awsAuthRefresh */
  awsAuthRefresh?: string;
  /** 終端機狀態列設定：type: 'command' + 自訂 shell 指令（輸出顯示在提示符旁）+ padding 字元數。對應 docs: statusLine */
  statusLine?: { type: 'command'; command: string; padding?: number };
  /** 自訂檔案建議來源：type: 'command' + shell 指令（stdout 為可選路徑清單）。對應 docs: fileSuggestion */
  fileSuggestion?: { type: 'command'; command: string };
  /** 沙箱設定：enabled/autoAllowBashIfSandboxed/excludedCommands + filesystem allow/deny + network 白名單。對應 docs: sandbox */
  sandbox?: {
    enabled?: boolean;
    autoAllowBashIfSandboxed?: boolean;
    excludedCommands?: string[];
    enableWeakerNetworkIsolation?: boolean;
    enableWeakerNestedSandbox?: boolean;
    allowUnsandboxedCommands?: boolean;
    ignoreViolations?: Record<string, string[]>;
    filesystem?: {
      allowWrite?: string[];
      denyWrite?: string[];
      denyRead?: string[];
    };
    network?: {
      allowedDomains?: string[];
      allowUnixSockets?: string[];
      allowAllUnixSockets?: boolean;
      allowLocalBinding?: boolean;
      httpProxyPort?: number;
      socksProxyPort?: number;
      allowManagedDomainsOnly?: boolean;
    };
  };
  /** 公司公告字串清單，顯示在 Claude Code 啟動時。對應 docs: companyAnnouncements */
  companyAnnouncements?: string[];
  /** 跳過 WebFetch 的 preflight 安全檢查（企業用途）。對應 docs: skipWebFetchPreflight */
  skipWebFetchPreflight?: boolean;
  /** 全域停用所有 hooks。對應 docs: disableAllHooks */
  disableAllHooks?: boolean;
  /** 顯示每次 turn 的耗時。對應 docs: showTurnDuration */
  showTurnDuration?: boolean;
  /** 載入 spinner 時顯示 tips 提示。對應 docs: spinnerTipsEnabled */
  spinnerTipsEnabled?: boolean;
  /** Spinner 動詞設定：mode = append（追加）或 replace（取代）+ verbs 清單。對應 docs: spinnerVerbs */
  spinnerVerbs?: { mode?: 'append' | 'replace'; verbs: string[] };
  /** 覆蓋預設 spinner tips：自訂 tips 清單 + excludeDefault 是否排除內建 tips。對應 docs: spinnerTipsOverride */
  spinnerTipsOverride?: { tips: string[]; excludeDefault?: boolean };
  /** 顯示終端機進度條（file operations 等）。對應 docs: terminalProgressBarEnabled */
  terminalProgressBarEnabled?: boolean;
  /** 減少動畫（尊重系統 prefers-reduced-motion 設定）。對應 docs: prefersReducedMotion */
  prefersReducedMotion?: boolean;
  /** Claude Code 的 UI 呈現模式：auto/in-process/tmux。對應 docs: teammateMode */
  teammateMode?: 'auto' | 'in-process' | 'tmux';
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
