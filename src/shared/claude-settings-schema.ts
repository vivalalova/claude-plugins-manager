/**
 * Claude Code settings 的 schema 定義。
 * 單一來源：新增 key 先加到這裡，再同步 ClaudeSettings interface。
 * 用 scripts/check-settings-schema.ts 驗證一致性。
 */

export type SettingsSection =
  | 'general'
  | 'display'
  | 'advanced'
  | 'permissions'
  | 'env'
  | 'hooks';

export interface SettingFieldSchema {
  /** TypeScript 型別字串（對應 ClaudeSettings interface 中的型別） */
  type: string;
  /** 預設值（undefined 表示無預設） */
  default?: unknown;
  /** 欄位說明 */
  description: string;
  /** 所屬 UI section */
  section: SettingsSection;
}

/**
 * Settings schema — key 對應 ClaudeSettings interface 的欄位名稱。
 * 順序依 section 分群，同 section 內依邏輯相關性排列。
 */
export const CLAUDE_SETTINGS_SCHEMA: Record<string, SettingFieldSchema> = {
  // ── General ──
  model: {
    type: 'string',
    description: '使用的 Claude 模型 ID',
    section: 'general',
  },
  effortLevel: {
    type: "'high' | 'medium' | 'low'",
    description: '思考深度，影響 token 用量',
    section: 'general',
  },
  language: {
    type: 'string',
    description: 'Claude 回應語言（如 "zh-TW"、"ja"）',
    section: 'general',
  },
  availableModels: {
    type: 'string[]',
    description: '限制可選用的模型清單',
    section: 'general',
  },
  outputStyle: {
    type: 'string',
    description: '輸出風格（自由字串）',
    section: 'general',
  },
  fastMode: {
    type: 'boolean',
    description: '啟用快速模式',
    section: 'general',
  },
  fastModePerSessionOptIn: {
    type: 'boolean',
    description: '允許每個 session 個別 opt-in 快速模式',
    section: 'general',
  },
  autoMemoryEnabled: {
    type: 'boolean',
    description: '自動寫入 memory（CLAUDE.md）功能開關',
    section: 'general',
  },
  autoUpdatesChannel: {
    type: "'stable' | 'latest'",
    description: '自動更新頻道',
    section: 'general',
  },
  cleanupPeriodDays: {
    type: 'number',
    description: '自動清理暫存檔案的週期（天數）',
    section: 'general',
  },
  alwaysThinkingEnabled: {
    type: 'boolean',
    description: '強制每次回應都啟用 extended thinking',
    section: 'general',
  },
  includeGitInstructions: {
    type: 'boolean',
    description: '是否在 system prompt 加入 git context',
    section: 'general',
  },
  respectGitignore: {
    type: 'boolean',
    description: '是否遵守 .gitignore 過濾檔案建議',
    section: 'general',
  },
  enableAllProjectMcpServers: {
    type: 'boolean',
    description: '自動啟用 .mcp.json 中所有 project MCP server',
    section: 'general',
  },
  enabledMcpjsonServers: {
    type: 'string[]',
    description: '允許自動啟用的 .mcp.json server 名稱清單',
    section: 'general',
  },
  disabledMcpjsonServers: {
    type: 'string[]',
    description: '禁止自動啟用的 .mcp.json server 名稱清單',
    section: 'general',
  },

  // ── Display ──
  teammateMode: {
    type: "'auto' | 'in-process' | 'tmux'",
    description: 'Claude Code 的 UI 呈現模式',
    section: 'display',
  },
  showTurnDuration: {
    type: 'boolean',
    description: '顯示每次 turn 的耗時',
    section: 'display',
  },
  spinnerTipsEnabled: {
    type: 'boolean',
    description: '載入 spinner 時顯示 tips 提示',
    section: 'display',
  },
  spinnerVerbs: {
    type: "{ mode?: 'append' | 'replace'; verbs: string[] }",
    description: 'Spinner 動詞設定',
    section: 'display',
  },
  spinnerTipsOverride: {
    type: '{ tips: string[]; excludeDefault?: boolean }',
    description: '覆蓋預設 spinner tips',
    section: 'display',
  },
  terminalProgressBarEnabled: {
    type: 'boolean',
    description: '顯示終端機進度條',
    section: 'display',
  },
  prefersReducedMotion: {
    type: 'boolean',
    description: '減少動畫',
    section: 'display',
  },

  // ── Advanced ──
  forceLoginMethod: {
    type: "'claudeai' | 'console'",
    description: '強制指定登入方式',
    section: 'advanced',
  },
  forceLoginOrgUUID: {
    type: 'string',
    description: '強制使用特定組織 UUID 登入',
    section: 'advanced',
  },
  attribution: {
    type: '{ commit?: string; pr?: string }',
    description: 'commit/PR 的 attribution 格式設定',
    section: 'advanced',
  },
  plansDirectory: {
    type: 'string',
    default: '~/.claude/plans',
    description: 'TodoWrite plans 的儲存目錄路徑',
    section: 'advanced',
  },
  apiKeyHelper: {
    type: 'string',
    description: '取得 API key 的 shell 指令',
    section: 'advanced',
  },
  otelHeadersHelper: {
    type: 'string',
    description: '取得 OpenTelemetry headers 的 shell 指令',
    section: 'advanced',
  },
  awsCredentialExport: {
    type: 'string',
    description: '匯出 AWS 認證的 shell 指令',
    section: 'advanced',
  },
  awsAuthRefresh: {
    type: 'string',
    description: '刷新 AWS 認證的 shell 指令',
    section: 'advanced',
  },
  statusLine: {
    type: "{ type: 'command'; command: string; padding?: number }",
    description: '終端機狀態列設定',
    section: 'advanced',
  },
  fileSuggestion: {
    type: "{ type: 'command'; command: string }",
    description: '自訂檔案建議來源',
    section: 'advanced',
  },
  sandbox: {
    type: 'object',
    description: '沙箱設定',
    section: 'advanced',
  },
  companyAnnouncements: {
    type: 'string[]',
    description: '公司公告字串清單',
    section: 'advanced',
  },
  skipWebFetchPreflight: {
    type: 'boolean',
    description: '跳過 WebFetch 的 preflight 安全檢查',
    section: 'advanced',
  },

  // ── Permissions ──
  permissions: {
    type: 'object',
    description: '工具呼叫的 allow/deny/ask 規則',
    section: 'permissions',
  },

  // ── Env ──
  env: {
    type: 'Record<string, string>',
    description: '注入每次 session 的環境變數 key-value map',
    section: 'env',
  },

  // ── Hooks ──
  hooks: {
    type: 'object',
    description: 'lifecycle hooks',
    section: 'hooks',
  },
  disableAllHooks: {
    type: 'boolean',
    description: '全域停用所有 hooks',
    section: 'hooks',
  },
};
