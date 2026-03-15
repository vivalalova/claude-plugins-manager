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

export type ControlType = 'boolean' | 'enum' | 'text' | 'number' | 'tagInput' | 'custom';

export interface SettingFieldSchema {
  /** TypeScript 型別字串（對應 ClaudeSettings interface 中的型別） */
  type: string;
  /** 預設值（undefined 表示無預設） */
  default?: unknown;
  /** 欄位說明 */
  description: string;
  /** 所屬 UI section */
  section: SettingsSection;
  /** UI 控制元件類型 */
  controlType: ControlType;
  /** enum 的選項陣列 */
  options?: readonly string[];
  /** number 欄位最小值 */
  min?: number;
  /** number 欄位最大值 */
  max?: number;
  /** number 欄位步進值 */
  step?: number;
}

/**
 * Settings schema — key 對應 ClaudeSettings interface 的欄位名稱。
 * 順序依 section 分群，同 section 內依邏輯相關性排列。
 */
export const CLAUDE_SETTINGS_SCHEMA: Record<string, SettingFieldSchema> = {
  // ── General ──
  // model 不列入 GENERAL_FIELD_ORDER — 由 CLI 自動管理，UI 不直接暴露
  model: {
    type: 'string',
    description: '使用的 Claude 模型 ID',
    section: 'general',
    controlType: 'text',
  },
  effortLevel: {
    type: "'high' | 'medium' | 'low'",
    default: 'high',
    description: '思考深度，影響 token 用量',
    section: 'general',
    controlType: 'enum',
    options: ['high', 'medium', 'low'] as const,
  },
  language: {
    type: 'string',
    description: 'Claude 回應語言（如 "zh-TW"、"ja"）',
    section: 'general',
    controlType: 'text',
  },
  availableModels: {
    type: 'string[]',
    description: '限制可選用的模型清單',
    section: 'general',
    controlType: 'tagInput',
  },
  outputStyle: {
    type: 'string',
    description: '輸出風格（自由字串）',
    section: 'general',
    controlType: 'text',
  },
  fastMode: {
    type: 'boolean',
    default: false,
    description: '啟用快速模式',
    section: 'general',
    controlType: 'boolean',
  },
  fastModePerSessionOptIn: {
    type: 'boolean',
    default: false,
    description: '允許每個 session 個別 opt-in 快速模式',
    section: 'general',
    controlType: 'boolean',
  },
  autoMemoryEnabled: {
    type: 'boolean',
    default: true,
    description: '自動寫入 memory（CLAUDE.md）功能開關',
    section: 'general',
    controlType: 'boolean',
  },
  autoUpdatesChannel: {
    type: "'stable' | 'latest'",
    default: 'latest',
    description: '自動更新頻道',
    section: 'general',
    controlType: 'enum',
    options: ['stable', 'latest'] as const,
  },
  cleanupPeriodDays: {
    type: 'number',
    default: 30,
    description: '自動清理暫存檔案的週期（天數）',
    section: 'general',
    controlType: 'number',
    min: 0,
    step: 1,
  },
  alwaysThinkingEnabled: {
    type: 'boolean',
    default: false,
    description: '強制每次回應都啟用 extended thinking',
    section: 'general',
    controlType: 'boolean',
  },
  includeGitInstructions: {
    type: 'boolean',
    default: true,
    description: '是否在 system prompt 加入 git context',
    section: 'general',
    controlType: 'boolean',
  },
  respectGitignore: {
    type: 'boolean',
    default: true,
    description: '是否遵守 .gitignore 過濾檔案建議',
    section: 'general',
    controlType: 'boolean',
  },
  enableAllProjectMcpServers: {
    type: 'boolean',
    default: false,
    description: '自動啟用 .mcp.json 中所有 project MCP server',
    section: 'general',
    controlType: 'boolean',
  },
  enabledMcpjsonServers: {
    type: 'string[]',
    description: '允許自動啟用的 .mcp.json server 名稱清單',
    section: 'permissions',
    controlType: 'tagInput',
  },
  disabledMcpjsonServers: {
    type: 'string[]',
    description: '禁止自動啟用的 .mcp.json server 名稱清單',
    section: 'permissions',
    controlType: 'tagInput',
  },

  // ── Display ──
  teammateMode: {
    type: "'auto' | 'in-process' | 'tmux'",
    default: 'auto',
    description: 'Claude Code 的 UI 呈現模式',
    section: 'display',
    controlType: 'enum',
    options: ['auto', 'in-process', 'tmux'] as const,
  },
  showTurnDuration: {
    type: 'boolean',
    default: true,
    description: '顯示每次 turn 的耗時',
    section: 'display',
    controlType: 'boolean',
  },
  spinnerTipsEnabled: {
    type: 'boolean',
    default: true,
    description: '載入 spinner 時顯示 tips 提示',
    section: 'display',
    controlType: 'boolean',
  },
  spinnerVerbs: {
    type: "{ mode?: 'append' | 'replace'; verbs: string[] }",
    description: 'Spinner 動詞設定',
    section: 'display',
    controlType: 'custom',
  },
  spinnerTipsOverride: {
    type: '{ tips: string[]; excludeDefault?: boolean }',
    description: '覆蓋預設 spinner tips',
    section: 'display',
    controlType: 'custom',
  },
  terminalProgressBarEnabled: {
    type: 'boolean',
    default: true,
    description: '顯示終端機進度條',
    section: 'display',
    controlType: 'boolean',
  },
  prefersReducedMotion: {
    type: 'boolean',
    default: false,
    description: '減少動畫',
    section: 'display',
    controlType: 'boolean',
  },

  // ── Advanced ──
  forceLoginMethod: {
    type: "'claudeai' | 'console'",
    description: '強制指定登入方式',
    section: 'advanced',
    controlType: 'enum',
    options: ['claudeai', 'console'] as const,
  },
  forceLoginOrgUUID: {
    type: 'string',
    description: '強制使用特定組織 UUID 登入',
    section: 'advanced',
    controlType: 'text',
  },
  attribution: {
    type: '{ commit?: string; pr?: string }',
    description: 'commit/PR 的 attribution 格式設定',
    section: 'advanced',
    controlType: 'custom',
  },
  plansDirectory: {
    type: 'string',
    default: '~/.claude/plans',
    description: 'TodoWrite plans 的儲存目錄路徑',
    section: 'advanced',
    controlType: 'text',
  },
  apiKeyHelper: {
    type: 'string',
    description: '取得 API key 的 shell 指令',
    section: 'advanced',
    controlType: 'text',
  },
  otelHeadersHelper: {
    type: 'string',
    description: '取得 OpenTelemetry headers 的 shell 指令',
    section: 'advanced',
    controlType: 'text',
  },
  awsCredentialExport: {
    type: 'string',
    description: '匯出 AWS 認證的 shell 指令',
    section: 'advanced',
    controlType: 'text',
  },
  awsAuthRefresh: {
    type: 'string',
    description: '刷新 AWS 認證的 shell 指令',
    section: 'advanced',
    controlType: 'text',
  },
  statusLine: {
    type: "{ type: 'command'; command: string; padding?: number }",
    description: '終端機狀態列設定',
    section: 'advanced',
    controlType: 'custom',
  },
  fileSuggestion: {
    type: "{ type: 'command'; command: string }",
    description: '自訂檔案建議來源',
    section: 'advanced',
    controlType: 'custom',
  },
  sandbox: {
    type: 'object',
    description: '沙箱設定',
    section: 'advanced',
    controlType: 'custom',
  },
  companyAnnouncements: {
    type: 'string[]',
    description: '公司公告字串清單',
    section: 'advanced',
    controlType: 'custom',
  },
  skipWebFetchPreflight: {
    type: 'boolean',
    default: false,
    description: '跳過 WebFetch 的 preflight 安全檢查',
    section: 'advanced',
    controlType: 'boolean',
  },

  // ── Permissions ──
  permissions: {
    type: 'object',
    description: '工具呼叫的 allow/deny/ask 規則',
    section: 'permissions',
    controlType: 'custom',
  },

  // ── Env ──
  env: {
    type: 'Record<string, string>',
    description: '注入每次 session 的環境變數 key-value map',
    section: 'env',
    controlType: 'custom',
  },

  // ── Hooks ──
  hooks: {
    type: 'object',
    description: 'lifecycle hooks',
    section: 'hooks',
    controlType: 'custom',
  },
  disableAllHooks: {
    type: 'boolean',
    default: false,
    description: '全域停用所有 hooks',
    section: 'hooks',
    controlType: 'boolean',
  },
};

/**
 * 從 schema 取得欄位的預設值。
 * 若 key 不存在，拋出 Error（fail-fast）；無預設則回傳 undefined。
 */
export function getSchemaDefault<T = unknown>(key: string): T | undefined {
  const field = CLAUDE_SETTINGS_SCHEMA[key];
  if (!field) throw new Error(`Schema key "${key}" not found`);
  return field.default as T | undefined;
}

/**
 * 從 schema 取得 enum 欄位的 options 陣列。
 * 若 key 不存在或非 enum，拋出 Error（fail-fast）。
 */
export function getSchemaEnumOptions(key: string): readonly string[] {
  const field = CLAUDE_SETTINGS_SCHEMA[key];
  if (!field) throw new Error(`Schema key "${key}" not found`);
  if (field.controlType !== 'enum' || !field.options) {
    throw new Error(`Schema key "${key}" is not an enum with options`);
  }
  return field.options;
}
