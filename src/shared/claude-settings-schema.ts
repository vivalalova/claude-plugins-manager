/**
 * Claude Code settings schema。
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

export type ControlType = StringConstructor | NumberConstructor | BooleanConstructor | ArrayConstructor | ObjectConstructor;

export interface SettingFieldSchema {
  /** 預設值（undefined 表示無預設） */
  default?: unknown;
  /** 所屬 UI section */
  section: SettingsSection;
  /** UI 控制元件類型 */
  controlType: ControlType;
  /** enum 的選項陣列（controlType 為 String 時有效） */
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
    section: 'general',
    controlType: String,
  },
  effortLevel: {
    default: 'high',
    section: 'general',
    controlType: String,
    options: ['high', 'medium', 'low'] as const,
  },
  language: {
    section: 'general',
    controlType: String,
  },
  availableModels: {
    section: 'general',
    controlType: Array,
  },
  outputStyle: {
    section: 'general',
    controlType: String,
  },
  fastMode: {
    default: false,
    section: 'general',
    controlType: Boolean,
  },
  fastModePerSessionOptIn: {
    default: false,
    section: 'general',
    controlType: Boolean,
  },
  autoMemoryEnabled: {
    default: true,
    section: 'general',
    controlType: Boolean,
  },
  autoUpdatesChannel: {
    default: 'latest',
    section: 'general',
    controlType: String,
    options: ['stable', 'latest'] as const,
  },
  cleanupPeriodDays: {
    default: 30,
    section: 'general',
    controlType: Number,
    min: 0,
    step: 1,
  },
  alwaysThinkingEnabled: {
    default: false,
    section: 'general',
    controlType: Boolean,
  },
  includeGitInstructions: {
    default: true,
    section: 'general',
    controlType: Boolean,
  },
  respectGitignore: {
    default: true,
    section: 'general',
    controlType: Boolean,
  },
  enableAllProjectMcpServers: {
    default: false,
    section: 'general',
    controlType: Boolean,
  },
  enabledMcpjsonServers: {
    section: 'permissions',
    controlType: Array,
  },
  disabledMcpjsonServers: {
    section: 'permissions',
    controlType: Array,
  },

  // ── Display ──
  teammateMode: {
    default: 'auto',
    section: 'display',
    controlType: String,
    options: ['auto', 'in-process', 'tmux'] as const,
  },
  showTurnDuration: {
    default: true,
    section: 'display',
    controlType: Boolean,
  },
  spinnerTipsEnabled: {
    default: true,
    section: 'display',
    controlType: Boolean,
  },
  spinnerVerbs: {
    section: 'display',
    controlType: Object,
  },
  spinnerTipsOverride: {
    section: 'display',
    controlType: Object,
  },
  terminalProgressBarEnabled: {
    default: true,
    section: 'display',
    controlType: Boolean,
  },
  prefersReducedMotion: {
    default: false,
    section: 'display',
    controlType: Boolean,
  },

  // ── Advanced ──
  forceLoginMethod: {
    section: 'advanced',
    controlType: String,
    options: ['claudeai', 'console'] as const,
  },
  forceLoginOrgUUID: {
    section: 'advanced',
    controlType: String,
  },
  attribution: {
    section: 'advanced',
    controlType: Object,
  },
  plansDirectory: {
    default: '~/.claude/plans',
    section: 'advanced',
    controlType: String,
  },
  apiKeyHelper: {
    section: 'advanced',
    controlType: String,
  },
  otelHeadersHelper: {
    section: 'advanced',
    controlType: String,
  },
  awsCredentialExport: {
    section: 'advanced',
    controlType: String,
  },
  awsAuthRefresh: {
    section: 'advanced',
    controlType: String,
  },
  statusLine: {
    section: 'advanced',
    controlType: Object,
  },
  fileSuggestion: {
    section: 'advanced',
    controlType: Object,
  },
  sandbox: {
    section: 'advanced',
    controlType: Object,
  },
  companyAnnouncements: {
    section: 'advanced',
    controlType: Object,
  },
  skipWebFetchPreflight: {
    default: false,
    section: 'advanced',
    controlType: Boolean,
  },

  // ── Permissions ──
  permissions: {
    section: 'permissions',
    controlType: Object,
  },

  // ── Env ──
  env: {
    section: 'env',
    controlType: Object,
  },

  // ── Hooks ──
  hooks: {
    section: 'hooks',
    controlType: Object,
  },
  disableAllHooks: {
    default: false,
    section: 'hooks',
    controlType: Boolean,
  },
};

/**
 * Model dropdown 的 fallback 選項。
 * 當 availableModels 未設定時，UI 使用此清單作為建議值。
 */
export const KNOWN_MODEL_OPTIONS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const;

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
 * 若 key 不存在或無 options，拋出 Error（fail-fast）。
 */
export function getSchemaEnumOptions(key: string): readonly string[] {
  const field = CLAUDE_SETTINGS_SCHEMA[key];
  if (!field) throw new Error(`Schema key "${key}" not found`);
  if (field.controlType !== String || !field.options) {
    throw new Error(`Schema key "${key}" is not an enum with options`);
  }
  return field.options;
}
