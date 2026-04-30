/**
 * Claude Code settings schema.
 * 單一來源：settings key、完整 value shape、UI metadata 都定義在這裡。
 * ClaudeSettings 由本檔直接推導；不要再手寫平行 interface。
 */

export const SETTINGS_SECTION_KEYS = ['general', 'display', 'permissions', 'env', 'hooks', 'advanced'] as const;

export type SettingsSection = typeof SETTINGS_SECTION_KEYS[number];

export type ControlType =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ArrayConstructor
  | ObjectConstructor;

type PrimitiveLiteral = string | number | boolean | null;

export interface StringValueSchema<Options extends readonly string[] | undefined = undefined> {
  kind: 'string';
  enum?: Options;
}

export interface NumberValueSchema {
  kind: 'number';
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanValueSchema {
  kind: 'boolean';
}

export interface LiteralValueSchema<Value extends PrimitiveLiteral = PrimitiveLiteral> {
  kind: 'literal';
  value: Value;
}

export interface ArrayValueSchema<Item extends ValueSchema = ValueSchema> {
  kind: 'array';
  item: Item;
}

export interface RecordValueSchema<Value extends ValueSchema = ValueSchema> {
  kind: 'record';
  value: Value;
}

export interface ObjectProperty<Schema extends ValueSchema = ValueSchema, Optional extends boolean = boolean> {
  schema: Schema;
  optional: Optional;
}

export interface ObjectValueSchema<Properties extends Record<string, ObjectProperty> = Record<string, ObjectProperty>> {
  kind: 'object';
  properties: Properties;
}

export interface UnionValueSchema<Members extends readonly ValueSchema[] = readonly ValueSchema[]> {
  kind: 'union';
  anyOf: Members;
}

type AnyStringValueSchema = StringValueSchema<readonly string[] | undefined>;

export type ValueSchema =
  | AnyStringValueSchema
  | NumberValueSchema
  | BooleanValueSchema
  | LiteralValueSchema
  | ArrayValueSchema
  | RecordValueSchema
  | ObjectValueSchema
  | UnionValueSchema;

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

type OptionalObjectKeys<Properties extends Record<string, ObjectProperty>> = {
  [K in keyof Properties]: Properties[K]['optional'] extends true ? K : never;
}[keyof Properties];

type RequiredObjectKeys<Properties extends Record<string, ObjectProperty>> = Exclude<
  keyof Properties,
  OptionalObjectKeys<Properties>
>;

export type InferValueSchema<Schema extends ValueSchema> =
  Schema extends StringValueSchema<infer Options>
    ? Options extends readonly string[]
      ? Options[number]
      : string
    : Schema extends NumberValueSchema
      ? number
      : Schema extends BooleanValueSchema
        ? boolean
        : Schema extends LiteralValueSchema<infer Value>
          ? Value
          : Schema extends ArrayValueSchema<infer Item>
            ? InferValueSchema<Item>[]
            : Schema extends RecordValueSchema<infer Value>
              ? Record<string, InferValueSchema<Value>>
              : Schema extends ObjectValueSchema<infer Properties>
                ? Expand<
                  { [K in RequiredObjectKeys<Properties>]: InferValueSchema<Properties[K]['schema']> } &
                  { [K in OptionalObjectKeys<Properties>]?: InferValueSchema<Properties[K]['schema']> }
                >
                : Schema extends UnionValueSchema<infer Members>
                  ? InferValueSchema<Members[number]>
                  : never;

export interface SettingFieldSchema<
  Value extends ValueSchema = ValueSchema,
  NestedUnder extends string | undefined = string | undefined,
> {
  /** 完整資料 shape；ClaudeSettings 由這個 schema 推導 */
  valueSchema: Value;
  /** 預設值（undefined 表示無預設） */
  default?: InferValueSchema<Value>;
  /** 巢狀欄位：該 key 實際位於 settings[nestedUnder][key]（例：defaultMode 在 permissions.defaultMode） */
  nestedUnder: NestedUnder;
  /** 需要確認對話框的危險值（選擇這些值前需使用者確認） */
  dangerValues?: readonly string[];
  /** 僅在自動推導不符合 UI 需求時覆寫 controlType */
  controlTypeOverride?: ControlType;
}

/** Schema 陣列元素 — key + 完整 schema + UI metadata */
export type SettingFieldEntry<
  Key extends string = string,
  Value extends ValueSchema = ValueSchema,
  NestedUnder extends string | undefined = string | undefined,
> = { key: Key } & SettingFieldSchema<Value, NestedUnder>;

export type AnySettingFieldEntry = SettingFieldEntry<string, ValueSchema, string | undefined>;
export type SettingsSchema = { [K in SettingsSection]: readonly AnySettingFieldEntry[] };

type AssertSchemaSectionKeys<Schema extends Record<string, unknown>> =
  Exclude<SettingsSection, keyof Schema> extends never
    ? Exclude<keyof Schema, SettingsSection> extends never
      ? true
      : never
    : never;

/** 含衍生 section 與 UI-friendly meta 的扁平 field schema */
export type FlatFieldSchema = Omit<SettingFieldSchema, 'controlTypeOverride'> & {
  controlType: ControlType;
  readonly section: SettingsSection;
};

function stringValue(): StringValueSchema;
function stringValue<const Options extends readonly string[]>(options: Options): StringValueSchema<Options>;
function stringValue<const Options extends readonly string[] | undefined>(options?: Options): StringValueSchema<Options> {
  return options ? { kind: 'string', enum: options } : { kind: 'string' };
}

function numberValue(meta: Pick<NumberValueSchema, 'min' | 'max' | 'step'> = {}): NumberValueSchema {
  return { kind: 'number', ...meta };
}

function booleanValue(): BooleanValueSchema {
  return { kind: 'boolean' };
}

function literalValue<const Value extends PrimitiveLiteral>(value: Value): LiteralValueSchema<Value> {
  return { kind: 'literal', value };
}

function arrayValue<Item extends ValueSchema>(item: Item): ArrayValueSchema<Item> {
  return { kind: 'array', item };
}

function recordValue<Value extends ValueSchema>(value: Value): RecordValueSchema<Value> {
  return { kind: 'record', value };
}

function objectValue<Properties extends Record<string, ObjectProperty>>(properties: Properties): ObjectValueSchema<Properties> {
  return { kind: 'object', properties };
}

function unionValue<const Members extends readonly ValueSchema[]>(...anyOf: Members): UnionValueSchema<Members> {
  return { kind: 'union', anyOf };
}

function required<Schema extends ValueSchema>(schema: Schema): ObjectProperty<Schema, false> {
  return { schema, optional: false };
}

function optional<Schema extends ValueSchema>(schema: Schema): ObjectProperty<Schema, true> {
  return { schema, optional: true };
}

interface BaseFieldMeta<NestedUnder extends string | undefined = undefined> {
  default?: unknown;
  nestedUnder?: NestedUnder;
  dangerValues?: readonly string[];
  controlTypeOverride?: ControlType;
}

function inferControlType(valueSchema: ValueSchema): ControlType | undefined {
  switch (valueSchema.kind) {
    case 'string':
    case 'literal':
      return String;
    case 'number':
      return Number;
    case 'boolean':
      return Boolean;
    case 'array':
      return Array;
    case 'record':
    case 'object':
      return Object;
    case 'union': {
      const memberTypes = new Set(valueSchema.anyOf.map((member) => inferControlType(member)));
      return memberTypes.size === 1 ? [...memberTypes][0] : undefined;
    }
  }
}

function createField<
  Key extends string,
  Value extends ValueSchema,
  NestedUnder extends string | undefined = undefined,
>(
  key: Key,
  valueSchema: Value,
  meta: BaseFieldMeta<NestedUnder> = {},
): SettingFieldEntry<Key, Value, NestedUnder> {
  return {
    key,
    valueSchema,
    default: meta.default as InferValueSchema<Value> | undefined,
    nestedUnder: (meta.nestedUnder ?? undefined) as NestedUnder,
    dangerValues: meta.dangerValues,
    controlTypeOverride: meta.controlTypeOverride,
  };
}

function stringField<Key extends string, NestedUnder extends string | undefined = undefined>(
  key: Key,
  meta: BaseFieldMeta<NestedUnder> = {},
): SettingFieldEntry<Key, StringValueSchema, NestedUnder> {
  return createField(key, stringValue(), meta);
}

function booleanField<Key extends string, NestedUnder extends string | undefined = undefined>(
  key: Key,
  meta: BaseFieldMeta<NestedUnder> = {},
): SettingFieldEntry<Key, BooleanValueSchema, NestedUnder> {
  return createField(key, booleanValue(), meta);
}

function arrayField<
  Key extends string,
  Item extends ValueSchema,
  NestedUnder extends string | undefined = undefined,
>(
  key: Key,
  item: Item,
  meta: BaseFieldMeta<NestedUnder> = {},
): SettingFieldEntry<Key, ArrayValueSchema<Item>, NestedUnder> {
  return createField(key, arrayValue(item), meta);
}

function recordField<
  Key extends string,
  Value extends ValueSchema,
  NestedUnder extends string | undefined = undefined,
>(
  key: Key,
  value: Value,
  meta: BaseFieldMeta<NestedUnder> = {},
): SettingFieldEntry<Key, RecordValueSchema<Value>, NestedUnder> {
  return createField(key, recordValue(value), meta);
}

const DEFAULT_MODE_OPTIONS = ['default', 'acceptEdits', 'plan', 'dontAsk', 'auto', 'bypassPermissions', 'delegate'] as const;
const EFFORT_LEVEL_OPTIONS = ['max', 'xhigh', 'high', 'medium', 'low'] as const;
const UPDATE_CHANNEL_OPTIONS = ['stable', 'latest'] as const;
const TEAMMATE_MODE_OPTIONS = ['auto', 'in-process', 'tmux'] as const;
const VIEW_MODE_OPTIONS = ['default', 'verbose', 'focus'] as const;
const EDITOR_MODE_OPTIONS = ['normal', 'vim'] as const;
const TUI_OPTIONS = ['fullscreen', 'default'] as const;
const FORCE_LOGIN_METHOD_OPTIONS = ['claudeai', 'console'] as const;
const DISABLE_ONLY_OPTIONS = ['disable'] as const;
const DEFAULT_SHELL_OPTIONS = ['bash', 'powershell'] as const;
const SPINNER_MODE_OPTIONS = ['append', 'replace'] as const;
const HOOK_SHELL_OPTIONS = ['bash', 'powershell'] as const;

const STRING_SCHEMA = stringValue();
const STRING_ARRAY_SCHEMA = arrayValue(STRING_SCHEMA);
const STRING_RECORD_SCHEMA = recordValue(STRING_SCHEMA);

const MCP_SERVER_MATCH_SCHEMA = unionValue(
  objectValue({ serverName: required(STRING_SCHEMA) }),
  objectValue({ serverCommand: required(STRING_ARRAY_SCHEMA) }),
  objectValue({ serverUrl: required(STRING_SCHEMA) }),
);

export const HOOK_COMMAND_SCHEMA = unionValue(
  objectValue({
    type: required(literalValue('command')),
    command: required(STRING_SCHEMA),
    timeout: optional(numberValue()),
    async: optional(booleanValue()),
    asyncRewake: optional(booleanValue()),
    shell: optional(stringValue(HOOK_SHELL_OPTIONS)),
    if: optional(STRING_SCHEMA),
    statusMessage: optional(STRING_SCHEMA),
  }),
  objectValue({
    type: required(literalValue('prompt')),
    prompt: required(STRING_SCHEMA),
    model: optional(STRING_SCHEMA),
    timeout: optional(numberValue()),
    if: optional(STRING_SCHEMA),
    statusMessage: optional(STRING_SCHEMA),
  }),
  objectValue({
    type: required(literalValue('agent')),
    prompt: required(STRING_SCHEMA),
    model: optional(STRING_SCHEMA),
    timeout: optional(numberValue()),
    if: optional(STRING_SCHEMA),
    statusMessage: optional(STRING_SCHEMA),
  }),
  objectValue({
    type: required(literalValue('http')),
    url: required(STRING_SCHEMA),
    headers: optional(STRING_RECORD_SCHEMA),
    timeout: optional(numberValue()),
    if: optional(STRING_SCHEMA),
    statusMessage: optional(STRING_SCHEMA),
    allowedEnvVars: optional(STRING_ARRAY_SCHEMA),
  }),
  objectValue({
    type: required(literalValue('mcp_tool')),
    server: required(STRING_SCHEMA),
    tool: required(STRING_SCHEMA),
    input: optional(recordValue(STRING_SCHEMA)),
    timeout: optional(numberValue()),
    if: optional(STRING_SCHEMA),
    statusMessage: optional(STRING_SCHEMA),
  }),
);

const DEFAULT_MODE_VALUE_SCHEMA = stringValue(DEFAULT_MODE_OPTIONS);
const EFFORT_LEVEL_VALUE_SCHEMA = stringValue(EFFORT_LEVEL_OPTIONS);
const UPDATE_CHANNEL_VALUE_SCHEMA = stringValue(UPDATE_CHANNEL_OPTIONS);
const TEAMMATE_MODE_VALUE_SCHEMA = stringValue(TEAMMATE_MODE_OPTIONS);
const VIEW_MODE_VALUE_SCHEMA = stringValue(VIEW_MODE_OPTIONS);
const EDITOR_MODE_VALUE_SCHEMA = stringValue(EDITOR_MODE_OPTIONS);
const TUI_VALUE_SCHEMA = stringValue(TUI_OPTIONS);
const FORCE_LOGIN_METHOD_VALUE_SCHEMA = stringValue(FORCE_LOGIN_METHOD_OPTIONS);
const DISABLE_ONLY_VALUE_SCHEMA = stringValue(DISABLE_ONLY_OPTIONS);
const DEFAULT_SHELL_VALUE_SCHEMA = stringValue(DEFAULT_SHELL_OPTIONS);
const SPINNER_MODE_VALUE_SCHEMA = stringValue(SPINNER_MODE_OPTIONS);

const SPINNER_VERBS_VALUE_SCHEMA = objectValue({
  mode: optional(SPINNER_MODE_VALUE_SCHEMA),
  verbs: required(STRING_ARRAY_SCHEMA),
});

const SPINNER_TIPS_OVERRIDE_VALUE_SCHEMA = objectValue({
  tips: required(STRING_ARRAY_SCHEMA),
  excludeDefault: optional(booleanValue()),
});

const ATTRIBUTION_VALUE_SCHEMA = objectValue({
  commit: optional(STRING_SCHEMA),
  pr: optional(STRING_SCHEMA),
});

const STATUS_LINE_VALUE_SCHEMA = objectValue({
  type: required(literalValue('command')),
  command: required(STRING_SCHEMA),
  padding: optional(numberValue()),
  refreshInterval: optional(numberValue({ min: 1, step: 1 })),
});

const FILE_SUGGESTION_VALUE_SCHEMA = objectValue({
  type: required(literalValue('command')),
  command: required(STRING_SCHEMA),
});

const SANDBOX_VALUE_SCHEMA = objectValue({
  enabled: optional(booleanValue()),
  autoAllowBashIfSandboxed: optional(booleanValue()),
  excludedCommands: optional(STRING_ARRAY_SCHEMA),
  enableWeakerNetworkIsolation: optional(booleanValue()),
  enableWeakerNestedSandbox: optional(booleanValue()),
  allowUnsandboxedCommands: optional(booleanValue()),
  ignoreViolations: optional(recordValue(STRING_ARRAY_SCHEMA)),
  ripgrep: optional(objectValue({
    command: required(STRING_SCHEMA),
    args: optional(STRING_ARRAY_SCHEMA),
  })),
  filesystem: optional(objectValue({
    allowWrite: optional(STRING_ARRAY_SCHEMA),
    denyWrite: optional(STRING_ARRAY_SCHEMA),
    denyRead: optional(STRING_ARRAY_SCHEMA),
    allowRead: optional(STRING_ARRAY_SCHEMA),
    allowManagedReadPathsOnly: optional(booleanValue()),
  })),
  network: optional(objectValue({
    allowedDomains: optional(STRING_ARRAY_SCHEMA),
    deniedDomains: optional(STRING_ARRAY_SCHEMA),
    allowUnixSockets: optional(STRING_ARRAY_SCHEMA),
    allowAllUnixSockets: optional(booleanValue()),
    allowLocalBinding: optional(booleanValue()),
    httpProxyPort: optional(numberValue({ min: 1, max: 65535, step: 1 })),
    socksProxyPort: optional(numberValue({ min: 1, max: 65535, step: 1 })),
    allowManagedDomainsOnly: optional(booleanValue()),
    allowMachLookup: optional(STRING_ARRAY_SCHEMA),
  })),
});

const COMPANY_ANNOUNCEMENTS_VALUE_SCHEMA = arrayValue(STRING_SCHEMA);
const FORCE_LOGIN_ORG_UUID_VALUE_SCHEMA = unionValue(STRING_SCHEMA, STRING_ARRAY_SCHEMA);
const MODEL_OVERRIDES_VALUE_SCHEMA = recordValue(STRING_SCHEMA);
const CLEANUP_PERIOD_DAYS_VALUE_SCHEMA = numberValue({ min: 1, step: 1 });
const FEEDBACK_SURVEY_RATE_VALUE_SCHEMA = numberValue({ min: 0, max: 1, step: 0.01 });

const WORKTREE_VALUE_SCHEMA = objectValue({
  sparsePaths: optional(STRING_ARRAY_SCHEMA),
  symlinkDirectories: optional(STRING_ARRAY_SCHEMA),
});

const AUTO_MODE_VALUE_SCHEMA = objectValue({
  environment: optional(STRING_ARRAY_SCHEMA),
  allow: optional(STRING_ARRAY_SCHEMA),
  soft_deny: optional(STRING_ARRAY_SCHEMA),
});

const PERMISSIONS_VALUE_SCHEMA = objectValue({
  allow: optional(STRING_ARRAY_SCHEMA),
  deny: optional(STRING_ARRAY_SCHEMA),
  ask: optional(STRING_ARRAY_SCHEMA),
  defaultMode: optional(DEFAULT_MODE_VALUE_SCHEMA),
  disableBypassPermissionsMode: optional(DISABLE_ONLY_VALUE_SCHEMA),
  disableAutoMode: optional(DISABLE_ONLY_VALUE_SCHEMA),
  additionalDirectories: optional(STRING_ARRAY_SCHEMA),
});

const MCP_SERVER_LIST_VALUE_SCHEMA = arrayValue(MCP_SERVER_MATCH_SCHEMA);

const HOOKS_VALUE_SCHEMA = recordValue(arrayValue(objectValue({
  matcher: optional(STRING_SCHEMA),
  hooks: required(arrayValue(HOOK_COMMAND_SCHEMA)),
})));

/**
 * Settings schema — 巢狀結構，section 分群。
 * 陣列順序即 UI 渲染順序。
 * 沒有 hidden 逃生門；user-facing key 要嘛落在對應 section，要嘛直接放 advanced。
 */
export const CLAUDE_SETTINGS_SCHEMA = {
  general: [
    stringField('model'),
    stringField('advisorModel'),
    stringField('agent'),
    createField('defaultMode', DEFAULT_MODE_VALUE_SCHEMA, {
      nestedUnder: 'permissions',
      dangerValues: ['bypassPermissions'],
    }),
    createField('effortLevel', EFFORT_LEVEL_VALUE_SCHEMA, { default: 'high' }),
    stringField('language'),
    arrayField('availableModels', STRING_SCHEMA),
    booleanField('includeGitInstructions', { default: true }),
    booleanField('respectGitignore', { default: true }),
    booleanField('fastMode', { default: false }),
    booleanField('fastModePerSessionOptIn', { default: false }),
    booleanField('autoMemoryEnabled', { default: true }),
    stringField('autoMemoryDirectory'),
    stringField('outputStyle'),
    createField('autoUpdatesChannel', UPDATE_CHANNEL_VALUE_SCHEMA, { default: 'latest' }),
    stringField('minimumVersion'),
    createField('cleanupPeriodDays', CLEANUP_PERIOD_DAYS_VALUE_SCHEMA, { default: 30 }),
  ],

  display: [
    createField('teammateMode', TEAMMATE_MODE_VALUE_SCHEMA, { default: 'auto' }),
    createField('viewMode', VIEW_MODE_VALUE_SCHEMA),
    createField('tui', TUI_VALUE_SCHEMA),
    booleanField('showTurnDuration', { default: true }),
    booleanField('showThinkingSummaries', { default: false }),
    booleanField('showClearContextOnPlanAccept', { default: false }),
    booleanField('spinnerTipsEnabled', { default: true }),
    booleanField('terminalProgressBarEnabled', { default: true }),
    booleanField('prefersReducedMotion', { default: false }),
    booleanField('voiceEnabled', { default: false }),
    createField('editorMode', EDITOR_MODE_VALUE_SCHEMA, { default: 'normal' }),
    booleanField('autoConnectIde', { default: false }),
    booleanField('autoInstallIdeExtension', { default: true }),
    createField('spinnerVerbs', SPINNER_VERBS_VALUE_SCHEMA),
    createField('spinnerTipsOverride', SPINNER_TIPS_OVERRIDE_VALUE_SCHEMA),
  ],

  permissions: [
    booleanField('enableAllProjectMcpServers', { default: false }),
    arrayField('enabledMcpjsonServers', STRING_SCHEMA),
    arrayField('disabledMcpjsonServers', STRING_SCHEMA),
    createField('disableAutoMode', DISABLE_ONLY_VALUE_SCHEMA),
    booleanField('skipDangerousModePermissionPrompt', { default: false }),
    booleanField('useAutoModeDuringPlan', { default: true }),
    createField('permissions', PERMISSIONS_VALUE_SCHEMA),
    createField('allowedMcpServers', MCP_SERVER_LIST_VALUE_SCHEMA, { controlTypeOverride: Object }),
    createField('deniedMcpServers', MCP_SERVER_LIST_VALUE_SCHEMA, { controlTypeOverride: Object }),
  ],

  env: [
    recordField('env', STRING_SCHEMA, { default: {} }),
  ],

  hooks: [
    booleanField('disableAllHooks', { default: false }),
    createField('hooks', HOOKS_VALUE_SCHEMA),
    arrayField('httpHookAllowedEnvVars', STRING_SCHEMA),
    arrayField('allowedHttpHookUrls', STRING_SCHEMA),
  ],

  advanced: [
    createField('forceLoginMethod', FORCE_LOGIN_METHOD_VALUE_SCHEMA),
    createField('attribution', ATTRIBUTION_VALUE_SCHEMA),
    createField('statusLine', STATUS_LINE_VALUE_SCHEMA),
    createField('fileSuggestion', FILE_SUGGESTION_VALUE_SCHEMA),
    createField('sandbox', SANDBOX_VALUE_SCHEMA),
    createField('companyAnnouncements', COMPANY_ANNOUNCEMENTS_VALUE_SCHEMA, { controlTypeOverride: Object }),
    createField('forceLoginOrgUUID', FORCE_LOGIN_ORG_UUID_VALUE_SCHEMA, { controlTypeOverride: String }),
    stringField('plansDirectory', { default: '~/.claude/plans' }),
    stringField('apiKeyHelper'),
    stringField('otelHeadersHelper'),
    stringField('awsCredentialExport'),
    stringField('awsAuthRefresh'),
    booleanField('skipWebFetchPreflight', { default: false }),
    createField('disableDeepLinkRegistration', DISABLE_ONLY_VALUE_SCHEMA),
    booleanField('disableSkillShellExecution', { default: false }),
    booleanField('alwaysThinkingEnabled', { default: false }),
    arrayField('claudeMdExcludes', STRING_SCHEMA),
    createField('modelOverrides', MODEL_OVERRIDES_VALUE_SCHEMA),
    createField('feedbackSurveyRate', FEEDBACK_SURVEY_RATE_VALUE_SCHEMA),
    createField('worktree', WORKTREE_VALUE_SCHEMA),
    createField('autoMode', AUTO_MODE_VALUE_SCHEMA),
    createField('defaultShell', DEFAULT_SHELL_VALUE_SCHEMA),
    stringField('prUrlTemplate'),
    booleanField('channelsEnabled', { default: false }),
  ],
} as const;

const _settingsSchemaSectionKeyCoverage: AssertSchemaSectionKeys<typeof CLAUDE_SETTINGS_SCHEMA> = true;

export type { ClaudeSettings, HookCommand } from './claude-settings-types.generated';

/** Settings sections 依 CLAUDE_SETTINGS_SCHEMA 宣告順序輸出。 */
export function getSettingsSections(): readonly SettingsSection[] {
  return SETTINGS_SECTION_KEYS;
}

interface RuntimeSettingFieldBase {
  valueSchema: ValueSchema;
  default?: unknown;
  nestedUnder: string | undefined;
  dangerValues?: readonly string[];
  controlTypeOverride?: ControlType;
}

interface RuntimeFlatFieldSchema extends Omit<RuntimeSettingFieldBase, 'controlTypeOverride'> {
  controlType: ControlType;
  section: SettingsSection;
}

function buildFlatSchema(): Record<string, RuntimeFlatFieldSchema> {
  const flat: Record<string, RuntimeFlatFieldSchema> = {};
  for (const section of SETTINGS_SECTION_KEYS) {
    for (const { key, ...field } of CLAUDE_SETTINGS_SCHEMA[section]) {
      const flatFieldBase = field as RuntimeSettingFieldBase;
      const controlType = flatFieldBase.controlTypeOverride ?? inferControlType(flatFieldBase.valueSchema);
      if (!controlType) {
        throw new Error(`Unable to infer controlType for schema field '${key}'`);
      }
      flat[key] = {
        valueSchema: flatFieldBase.valueSchema,
        controlType,
        default: flatFieldBase.default,
        nestedUnder: flatFieldBase.nestedUnder,
        dangerValues: flatFieldBase.dangerValues,
        section,
      };
    }
  }
  return flat;
}

const FLAT_SCHEMA_BY_KEY: Record<string, RuntimeFlatFieldSchema> = buildFlatSchema();

/** 取得單一扁平 schema field。 */
export function getFlatFieldSchema(key: string): FlatFieldSchema | undefined {
  return FLAT_SCHEMA_BY_KEY[key] as FlatFieldSchema | undefined;
}

/** 列出全部扁平 schema fields。 */
export function getAllFlatFieldSchemas(): Readonly<Record<string, FlatFieldSchema>> {
  return FLAT_SCHEMA_BY_KEY as Readonly<Record<string, FlatFieldSchema>>;
}

/**
 * 取得 section 內的 UI 渲染順序。
 * 順序即 CLAUDE_SETTINGS_SCHEMA 陣列中的宣告順序。
 */
export function getSectionFieldOrder(section: SettingsSection): string[] {
  return CLAUDE_SETTINGS_SCHEMA[section].map((field) => field.key);
}

/**
 * 從 schema 取得欄位的預設值。
 * 若 key 不存在，拋出 Error（fail-fast）；無預設則回傳 undefined。
 */
export function getSchemaDefault<T = unknown>(key: string): T | undefined {
  const field = FLAT_SCHEMA_BY_KEY[key] as { default?: unknown } | undefined;
  if (!field) throw new Error(`Schema key "${key}" not found`);
  return field.default as T | undefined;
}

export function getValueSchemaEnumOptions(valueSchema: ValueSchema): readonly string[] | undefined {
  return valueSchema.kind === 'string' ? valueSchema.enum : undefined;
}

export function getValueSchemaNumberMeta(valueSchema: ValueSchema): Pick<NumberValueSchema, 'min' | 'max' | 'step'> | undefined {
  return valueSchema.kind === 'number'
    ? { min: valueSchema.min, max: valueSchema.max, step: valueSchema.step }
    : undefined;
}

/**
 * 從 schema 取得 enum 欄位的 options 陣列。
 * 若 key 不存在或無 options，拋出 Error（fail-fast）。
 */
export function getSchemaEnumOptions(key: string): readonly string[] {
  const field = FLAT_SCHEMA_BY_KEY[key] as { controlType: ControlType; valueSchema: ValueSchema } | undefined;
  if (!field) throw new Error(`Schema key "${key}" not found`);
  const options = getValueSchemaEnumOptions(field.valueSchema);
  if (field.controlType !== String || !options) {
    throw new Error(`Schema key "${key}" is not an enum with options`);
  }
  return options;
}
