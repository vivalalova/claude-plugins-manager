/**
 * Claude Code settings schema.
 * 單一來源：新增 key 先加到這裡，再同步 ClaudeSettings interface。
 * 巢狀結構：section → fields[]，陣列順序即 UI 渲染順序。
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
  /** true = 不渲染於 schema-driven loop（CLI 管理或手動渲染） */
  hidden?: boolean;
  /** 巢狀欄位：該 key 實際位於 settings[nestedUnder][key]（例：defaultMode 在 permissions.defaultMode） */
  nestedUnder?: string;
  /** 需要確認對話框的危險值（選擇這些值前需使用者確認） */
  dangerValues?: readonly string[];
}

/** Schema 陣列元素 — SettingFieldSchema + key 識別 */
export type SettingFieldEntry = { key: string } & SettingFieldSchema;

/** 含衍生 section 的扁平 field schema（供需要 section 資訊的消費者使用） */
export type FlatFieldSchema = SettingFieldSchema & { readonly section: SettingsSection };

/**
 * Settings schema — 巢狀結構，section 分群。
 * 陣列順序即 UI 渲染順序。
 * hidden 的 entry 不參與 schema-driven loop。
 */
export const CLAUDE_SETTINGS_SCHEMA: Record<SettingsSection, SettingFieldEntry[]> = {
  // ── General ──
  general: [
    { key: 'model', controlType: String },
    { key: 'defaultMode', controlType: String, nestedUnder: 'permissions',
      options: ['default', 'acceptEdits', 'plan', 'dontAsk', 'auto', 'bypassPermissions', 'delegate'] as const,
      dangerValues: ['bypassPermissions'] as const },
    { key: 'effortLevel', default: 'high', controlType: String, options: ['high', 'medium', 'low'] as const },
    { key: 'language', controlType: String },
    { key: 'availableModels', controlType: Array },
    { key: 'includeGitInstructions', default: true, controlType: Boolean },
    { key: 'respectGitignore', default: true, controlType: Boolean },
    { key: 'fastMode', default: false, controlType: Boolean },
    { key: 'fastModePerSessionOptIn', default: false, controlType: Boolean },
    { key: 'autoMemoryEnabled', default: true, controlType: Boolean },
    { key: 'outputStyle', controlType: String },
    { key: 'autoUpdatesChannel', default: 'latest', controlType: String, options: ['stable', 'latest'] as const },
    { key: 'cleanupPeriodDays', default: 30, controlType: Number, min: 0, step: 1 },
  ],

  // ── Display ──
  display: [
    { key: 'teammateMode', default: 'auto', controlType: String, options: ['auto', 'in-process', 'tmux'] as const },
    { key: 'showTurnDuration', default: true, controlType: Boolean },
    { key: 'spinnerTipsEnabled', default: true, controlType: Boolean },
    { key: 'terminalProgressBarEnabled', default: true, controlType: Boolean },
    { key: 'prefersReducedMotion', default: false, controlType: Boolean },
    { key: 'spinnerVerbs', controlType: Object },
    { key: 'spinnerTipsOverride', controlType: Object },
  ],

  // ── Advanced ──
  advanced: [
    { key: 'forceLoginMethod', controlType: String, options: ['claudeai', 'console'] as const },
    { key: 'attribution', controlType: Object },
    { key: 'statusLine', controlType: Object },
    { key: 'fileSuggestion', controlType: Object },
    { key: 'sandbox', controlType: Object },
    { key: 'companyAnnouncements', controlType: Object },
    { key: 'forceLoginOrgUUID', controlType: String },
    { key: 'plansDirectory', default: '~/.claude/plans', controlType: String },
    { key: 'apiKeyHelper', controlType: String },
    { key: 'otelHeadersHelper', controlType: String },
    { key: 'awsCredentialExport', controlType: String },
    { key: 'awsAuthRefresh', controlType: String },
    { key: 'skipWebFetchPreflight', default: false, controlType: Boolean },
    { key: 'alwaysThinkingEnabled', default: false, controlType: Boolean },
    { key: 'claudeMdExcludes', controlType: Array },
    { key: 'modelOverrides', controlType: Object },
    { key: 'feedbackSurveyRate', controlType: Number, min: 0, max: 1, step: 0.01 },
    { key: 'worktree', controlType: Object },
    { key: 'autoMode', controlType: Object },
    { key: 'defaultShell', controlType: String, options: ['bash', 'powershell'] as const },
  ],

  // ── Permissions ──
  permissions: [
    { key: 'enableAllProjectMcpServers', default: false, controlType: Boolean },
    { key: 'enabledMcpjsonServers', controlType: Array },
    { key: 'disabledMcpjsonServers', controlType: Array },
    { key: 'permissions', controlType: Object },
    { key: 'allowedMcpServers', controlType: Object },
    { key: 'deniedMcpServers', controlType: Object },
  ],

  // ── Env ──
  env: [
    { key: 'env', controlType: Object },
  ],

  // ── Hooks ──
  hooks: [
    { key: 'disableAllHooks', default: false, controlType: Boolean },
    { key: 'hooks', controlType: Object },
    { key: 'httpHookAllowedEnvVars', controlType: Array },
    { key: 'allowedHttpHookUrls', controlType: Array },
  ],
};

/** Settings 頁面可見 section 順序。由 schema 檔集中定義，避免 SettingsPage 自己寫死。 */
export const SETTINGS_NAV_SECTIONS: SettingsSection[] = [
  'general',
  'display',
  'permissions',
  'env',
  'hooks',
  'advanced',
];

// ---------------------------------------------------------------------------
// Flat schema — 衍生的扁平索引，含 section 欄位
// ---------------------------------------------------------------------------

function buildFlatSchema(): Record<string, FlatFieldSchema> {
  const flat: Record<string, FlatFieldSchema> = {};
  for (const section of Object.keys(CLAUDE_SETTINGS_SCHEMA) as SettingsSection[]) {
    for (const { key, ...field } of CLAUDE_SETTINGS_SCHEMA[section]) {
      flat[key] = { ...field, section };
    }
  }
  return flat;
}

/** 扁平索引：key → FlatFieldSchema（含 section） */
export const SETTINGS_FLAT_SCHEMA: Record<string, FlatFieldSchema> = buildFlatSchema();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 取得 section 內的 UI 渲染順序（排除 hidden）。
 * 順序即 CLAUDE_SETTINGS_SCHEMA 陣列中的宣告順序。
 */
export function getSectionFieldOrder(section: SettingsSection): string[] {
  return CLAUDE_SETTINGS_SCHEMA[section]
    .filter(f => !f.hidden)
    .map(f => f.key);
}

/**
 * 從 schema 取得欄位的預設值。
 * 若 key 不存在，拋出 Error（fail-fast）；無預設則回傳 undefined。
 */
export function getSchemaDefault<T = unknown>(key: string): T | undefined {
  const field = SETTINGS_FLAT_SCHEMA[key];
  if (!field) throw new Error(`Schema key "${key}" not found`);
  return field.default as T | undefined;
}

/**
 * 從 schema 取得 enum 欄位的 options 陣列。
 * 若 key 不存在或無 options，拋出 Error（fail-fast）。
 */
export function getSchemaEnumOptions(key: string): readonly string[] {
  const field = SETTINGS_FLAT_SCHEMA[key];
  if (!field) throw new Error(`Schema key "${key}" not found`);
  if (field.controlType !== String || !field.options) {
    throw new Error(`Schema key "${key}" is not an enum with options`);
  }
  return field.options;
}
