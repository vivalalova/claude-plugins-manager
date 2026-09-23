import { describe, it, expect } from 'vitest';

import type { FlatFieldSchema } from '../../claude-settings-schema';
import { getAllFlatFieldSchemas } from '../../claude-settings-schema';
import {
  parseSettingsEntries,
  parseDocsDefault,
  diffDefaults,
  diffStorage,
  diffScopes,
  diffDeprecated,
  diffEnumOptions,
  KNOWN_DEFAULT_EQUIVALENT,
  warningParseHealthy,
  excludeDeprecatedGaps,
} from '../settings-meta-drift';

const detailsMd = [
  '## Settings index',
  '',
  '| Key | Description | Topic | Scope |',
  '| :-- | :-- | :-- | :-- |',
  '| [`fastMode`](#fastmode) | Fast mode | Model | Any file |',
  '',
  '## Model and responses',
  '',
  '### `fastMode`',
  '',
  'Turn fast mode on.',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: Boolean',
  '* **Default**: unset, so fast mode is off',
  '',
  '### `teammateMode`',
  '',
  '```bash',
  '# a shell comment is not a heading',
  '* **Default**: `"inside-code-block"`',
  '```',
  '',
  '* **Type**: string',
  '* **Default**: `"in-process"`',
  '',
  '### `permissions.defaultMode`',
  '',
  '* **Default**: `"default"`, or `"plan"` in some cases',
  '',
  '### `oddKey`',
  '',
  '* **Default**: depends on your plan',
  '',
  '## Next topic',
  '',
  '* **Default**: `"orphan"`',
].join('\n');

type FakeObjectProperty = {
  schema: { kind: string; enum?: string[]; properties?: Record<string, FakeObjectProperty> };
  optional: boolean;
  effectiveScopes?: readonly ('user' | 'local')[];
};

type FakeField = {
  valueSchema: { kind: string; properties?: Record<string, FakeObjectProperty> };
  default?: unknown;
  nestedUnder?: string;
  storageFile?: 'globalConfig';
  effectiveScopes?: readonly ('user' | 'local')[];
};

function field(partial: FakeField): FlatFieldSchema {
  return { controlType: 'String', section: 'general', ...partial } as unknown as FlatFieldSchema;
}

const USER_ONLY = ['user'] as const;
const USER_AND_LOCAL = ['user', 'local'] as const;

describe('parseSettingsEntries — default', () => {
  it('reads the first Default bullet of each `### key` entry and ignores code blocks and orphans', () => {
    const entries = parseSettingsEntries(detailsMd);
    const details = new Map([...entries].map(([key, entry]) => [key, entry.default]));

    expect(details.get('fastMode')).toBe('unset, so fast mode is off');
    expect(details.get('teammateMode')).toBe('`"in-process"`');
    expect(details.get('permissions.defaultMode')).toBe('`"default"`, or `"plan"` in some cases');
    expect(details.get('oddKey')).toBe('depends on your plan');
    expect([...details.values()]).not.toContain('`"orphan"`');
    expect([...details.values()]).not.toContain('`"inside-code-block"`');
  });
});

describe('parseDocsDefault', () => {
  it.each([
    ['unset', { kind: 'unset' }],
    ['unset, so fast mode is off', { kind: 'unset' }],
    ['none', { kind: 'unset' }],
    ['not locked', { kind: 'unset' }],
    ['`false`', { kind: 'literal', value: false }],
    ['`30`', { kind: 'literal', value: 30 }],
    ['`"medium"`, or `"small"` on a Pro plan', { kind: 'conditional' }],
    ['`false`, so filesystem isolation stays on', { kind: 'literal', value: false }],
    ['depends on your plan', { kind: 'unparsed' }],
    ['`~/.claude/plans`', { kind: 'unparsed' }],
  ])('%s', (raw, expected) => {
    expect(parseDocsDefault(raw)).toEqual(expected);
  });
});

describe('diffDefaults', () => {
  const details = new Map([
    ['fastMode', 'unset, so fast mode is off'],
    ['teammateMode', '`"in-process"`'],
    ['defaultMode', 'never used: bare form of a nested key'],
    ['permissions.defaultMode', '`"default"`'],
    ['model', 'unset'],
    ['oddKey', 'depends on your plan'],
    ['sandbox', '`{}`'],
    ['workflowSizeGuideline', '`"medium"`, or `"small"` on a Pro plan'],
    ['defaultShell', '`"bash"`, or `"powershell"` on Windows'],
    ['disableAutoMode', '`"disable"`'],
  ]);
  const schemas: Record<string, FlatFieldSchema> = {
    fastMode: field({ valueSchema: { kind: 'boolean' }, default: false }),
    teammateMode: field({ valueSchema: { kind: 'string' }, default: 'auto' }),
    defaultMode: field({ valueSchema: { kind: 'string' }, nestedUnder: 'permissions' }),
    model: field({ valueSchema: { kind: 'string' } }),
    oddKey: field({ valueSchema: { kind: 'string' } }),
    sandbox: field({ valueSchema: { kind: 'object', properties: {} } }),
    notInDocs: field({ valueSchema: { kind: 'string' }, default: 'x' }),
    workflowSizeGuideline: field({ valueSchema: { kind: 'string' }, default: 'medium' }),
    defaultShell: field({ valueSchema: { kind: 'string' } }),
    disableAutoMode: field({ valueSchema: { kind: 'string' }, nestedUnder: 'permissions' }),
  };

  it('reports literal mismatches, repo defaults docs leave unset or conditional, and unparsed docs text', () => {
    const drift = diffDefaults(schemas, details, new Map());

    expect(drift).toEqual([
      { key: 'disableAutoMode', kind: 'mismatch', docs: '`"disable"`', repo: undefined },
      { key: 'fastMode', kind: 'repoDefaultDocsUnset', docs: 'unset, so fast mode is off', repo: false },
      { key: 'oddKey', kind: 'unparsed', docs: 'depends on your plan', repo: undefined },
      { key: 'permissions.defaultMode', kind: 'mismatch', docs: '`"default"`', repo: undefined },
      { key: 'teammateMode', kind: 'mismatch', docs: '`"in-process"`', repo: 'auto' },
      { key: 'workflowSizeGuideline', kind: 'conditional', docs: '`"medium"`, or `"small"` on a Pro plan', repo: 'medium' },
    ]);
  });

  it('skips a vetted equivalence only while the docs Default text is unchanged', () => {
    const vetted = new Map([['fastMode', 'unset, so fast mode is off']]);
    expect(diffDefaults(schemas, details, vetted).map((d) => d.key)).not.toContain('fastMode');

    const stale = new Map([['fastMode', 'unset, so fast mode is on']]);
    expect(diffDefaults(schemas, details, stale).map((d) => d.key)).toContain('fastMode');
  });

  it('registers alwaysThinkingEnabled in KNOWN_DEFAULT_EQUIVALENT against the real schema', () => {
    const docsDefaults = new Map([
      ['alwaysThinkingEnabled', 'unset, so thinking is on for models that support it'],
    ]);
    const drift = diffDefaults(getAllFlatFieldSchemas(), docsDefaults, KNOWN_DEFAULT_EQUIVALENT);

    expect(drift.map((d) => d.key)).not.toContain('alwaysThinkingEnabled');
  });
});

describe('diffStorage', () => {
  it('reports keys whose index Scope and repo storageFile disagree about ~/.claude.json', () => {
    const scopes = new Map([
      ['autoConnectIde', 'Global config'],
      ['copyOnSelect', 'Global config'],
      ['workflowSizeGuideline', 'Any file'],
      ['model', 'Any file'],
    ]);
    const schemas: Record<string, FlatFieldSchema> = {
      autoConnectIde: field({ valueSchema: { kind: 'boolean' }, storageFile: 'globalConfig' }),
      workflowSizeGuideline: field({ valueSchema: { kind: 'string' }, storageFile: 'globalConfig' }),
      model: field({ valueSchema: { kind: 'string' } }),
    };

    expect(diffStorage(schemas, scopes)).toEqual([
      { key: 'workflowSizeGuideline', docsScope: 'Any file', repoStorageFile: 'globalConfig' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// #24 diffScopes — 20 個「只在特定 scope 生效」設定的 schema 登錄 vs docs Scope 欄比對
// ---------------------------------------------------------------------------

describe('diffScopes', () => {
  it('登錄與 docs 一致（含 sandbox 巢狀子設定與 container-level 行）→ []', () => {
    const scopes = new Map([
      ['fastMode', 'Any file'],
      ['dialogExpiry', 'User or managed'],
      ['useAutoModeDuringPlan', 'User, local, or managed'],
      ['sandbox.allowAppleEvents', 'User or managed'],
      ['sandbox.filesystem.disabled', 'User or managed'],
      ['sandbox.credentials.awsPairs', 'User or managed'],
      ['sandbox.ripgrep', 'User or managed'],
      ['managedOnlyKey', 'Managed'],
      ['globalOnlyKey', 'Global config'],
    ]);

    const schemas: Record<string, FlatFieldSchema> = {
      fastMode: field({ valueSchema: { kind: 'boolean' } }),
      dialogExpiry: field({ valueSchema: { kind: 'string' }, effectiveScopes: USER_ONLY }),
      useAutoModeDuringPlan: field({ valueSchema: { kind: 'boolean' }, effectiveScopes: USER_AND_LOCAL }),
      managedOnlyKey: field({ valueSchema: { kind: 'boolean' } }),
      globalOnlyKey: field({ valueSchema: { kind: 'boolean' }, storageFile: 'globalConfig' }),
      sandbox: field({
        valueSchema: {
          kind: 'object',
          properties: {
            allowAppleEvents: { schema: { kind: 'boolean' }, optional: true, effectiveScopes: USER_ONLY },
            ripgrep: {
              schema: { kind: 'object', properties: { args: { schema: { kind: 'array' }, optional: true } } },
              optional: true,
              effectiveScopes: USER_ONLY,
            },
            filesystem: {
              schema: {
                kind: 'object',
                properties: {
                  disabled: { schema: { kind: 'boolean' }, optional: true, effectiveScopes: USER_ONLY },
                  allowWrite: { schema: { kind: 'array' }, optional: true },
                },
              },
              optional: true,
            },
            credentials: {
              schema: {
                kind: 'object',
                properties: {
                  awsPairs: { schema: { kind: 'array' }, optional: true, effectiveScopes: USER_ONLY },
                  envVars: { schema: { kind: 'array' }, optional: true },
                },
              },
              optional: true,
            },
          },
        },
      }),
    };

    expect(diffScopes(schemas, scopes)).toEqual([]);
  });

  it('登錄比 docs 更寬（多登了 local）→ mismatch', () => {
    const scopes = new Map([['dialogExpiry', 'User or managed']]);
    const schemas: Record<string, FlatFieldSchema> = {
      dialogExpiry: field({ valueSchema: { kind: 'string' }, effectiveScopes: USER_AND_LOCAL }),
    };

    expect(diffScopes(schemas, scopes)).toEqual([
      { key: 'dialogExpiry', docsScope: 'User or managed', repoEffectiveScopes: USER_AND_LOCAL, kind: 'mismatch' },
    ]);
  });

  it('docs 限制但 repo 完全未登錄 → mismatch', () => {
    const scopes = new Map([['askUserQuestionTimeout', 'User or managed']]);
    const schemas: Record<string, FlatFieldSchema> = {
      askUserQuestionTimeout: field({ valueSchema: { kind: 'string' } }),
    };

    expect(diffScopes(schemas, scopes)).toEqual([
      { key: 'askUserQuestionTimeout', docsScope: 'User or managed', repoEffectiveScopes: undefined, kind: 'mismatch' },
    ]);
  });

  it('repo 登錄了限制，但 docs 是 Any file → mismatch（登錄本不該存在）', () => {
    const scopes = new Map([['model', 'Any file']]);
    const schemas: Record<string, FlatFieldSchema> = {
      model: field({ valueSchema: { kind: 'string' }, effectiveScopes: USER_ONLY }),
    };

    expect(diffScopes(schemas, scopes)).toEqual([
      { key: 'model', docsScope: 'Any file', repoEffectiveScopes: USER_ONLY, kind: 'mismatch' },
    ]);
  });

  it('sandbox 巢狀子設定登錄與 docs 不符 → mismatch，key 帶完整 dotted path', () => {
    const scopes = new Map([['sandbox.network.strictAllowlist', 'User or managed']]);
    const schemas: Record<string, FlatFieldSchema> = {
      sandbox: field({
        valueSchema: {
          kind: 'object',
          properties: {
            network: {
              schema: {
                kind: 'object',
                properties: {
                  strictAllowlist: { schema: { kind: 'boolean' }, optional: true }, // 漏登錄
                },
              },
              optional: true,
            },
          },
        },
      }),
    };

    expect(diffScopes(schemas, scopes)).toEqual([
      { key: 'sandbox.network.strictAllowlist', docsScope: 'User or managed', repoEffectiveScopes: undefined, kind: 'mismatch' },
    ]);
  });

  it('Managed／Global config 兩種 docs scope 一律跳過，即使 repo 有登錄也不列入', () => {
    const scopes = new Map([
      ['managedKey', 'Managed'],
      ['globalKey', 'Global config'],
    ]);
    const schemas: Record<string, FlatFieldSchema> = {
      managedKey: field({ valueSchema: { kind: 'boolean' }, effectiveScopes: USER_ONLY }),
      globalKey: field({ valueSchema: { kind: 'boolean' }, effectiveScopes: USER_ONLY, storageFile: 'globalConfig' }),
    };

    expect(diffScopes(schemas, scopes)).toEqual([]);
  });

  it('docs Scope 欄文字無法辨識 → kind: unrecognized', () => {
    const scopes = new Map([['oddScopeKey', 'Some future scope wording']]);
    const schemas: Record<string, FlatFieldSchema> = {
      oddScopeKey: field({ valueSchema: { kind: 'boolean' } }),
    };

    const drift = diffScopes(schemas, scopes);
    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ key: 'oddScopeKey', docsScope: 'Some future scope wording', kind: 'unrecognized' });
  });

  it('回傳結果依 key 字母序排序', () => {
    const scopes = new Map([
      ['zKey', 'User or managed'],
      ['aKey', 'User or managed'],
    ]);
    const schemas: Record<string, FlatFieldSchema> = {
      zKey: field({ valueSchema: { kind: 'boolean' } }),
      aKey: field({ valueSchema: { kind: 'boolean' } }),
    };

    expect(diffScopes(schemas, scopes).map((d) => d.key)).toEqual(['aKey', 'zKey']);
  });

  it('集合比較與順序無關：registration 陣列元素順序與 docs 推導集合順序不同仍判為相符', () => {
    const scopes = new Map([['syncClaudeAiSkills', 'User, local, or managed']]);
    const schemas: Record<string, FlatFieldSchema> = {
      // 刻意寫成 ['local', 'user']，docs 'User, local, or managed' 推導集合是 {'user','local'}——
      // 元素順序不同，但當同一個集合，不該被判為 mismatch。
      syncClaudeAiSkills: field({ valueSchema: { kind: 'boolean' }, effectiveScopes: ['local', 'user'] }),
    };

    expect(diffScopes(schemas, scopes)).toEqual([]);
  });

  it('用真實 schema + 20 個 key 的 docs Scope map（依 2026-09-23 索引表）比對 → []（釘住全部登錄）', () => {
    const docsScopes = new Map([
      ['askUserQuestionTimeout', 'User or managed'],
      ['autoContinueAtUsageLimit', 'User or managed'],
      ['autoMode', 'User or managed'],
      ['autoMode.classifyAllShell', 'User or managed'],
      ['desktopSessionCleanupPeriodDays', 'User or managed'],
      ['dialogExpiry', 'User or managed'],
      ['feedbackDrafts', 'User or managed'],
      ['footerLinksRegexes', 'User or managed'],
      ['modelPicker', 'User or managed'],
      ['processWrapper', 'User or managed'],
      ['spellcheck', 'User or managed'],
      ['sshConfigs', 'User or managed'],
      ['vimInsertModeRemaps', 'User or managed'],
      ['sandbox.allowAppleEvents', 'User or managed'],
      ['sandbox.credentials.awsPairs', 'User or managed'],
      ['sandbox.credentials.allowPlaintextInject', 'User or managed'],
      ['sandbox.credentials.sigv4', 'User or managed'],
      ['sandbox.filesystem.disabled', 'User or managed'],
      ['sandbox.network.strictAllowlist', 'User or managed'],
      ['sandbox.network.tlsTerminate', 'User or managed'],
      ['sandbox.ripgrep', 'User or managed'],
      ['skipDangerousModePermissionPrompt', 'User, local, or managed'],
      ['syncClaudeAiSkills', 'User, local, or managed'],
      ['useAutoModeDuringPlan', 'User, local, or managed'],
    ]);

    expect(diffScopes(getAllFlatFieldSchemas(), docsScopes)).toEqual([]);
  });

  it('container-level 巢狀物件本身未登錄 effectiveScopes（子屬性也未登錄）→ mismatch', () => {
    const scopes = new Map([['sandbox.ripgrep', 'User or managed']]);
    const schemas: Record<string, FlatFieldSchema> = {
      sandbox: field({
        valueSchema: {
          kind: 'object',
          properties: {
            ripgrep: {
              schema: {
                kind: 'object',
                properties: {
                  args: { schema: { kind: 'array' }, optional: true },
                },
              },
              optional: true,
              // 漏登錄 effectiveScopes
            },
          },
        },
      }),
    };

    expect(diffScopes(schemas, scopes)).toEqual([
      { key: 'sandbox.ripgrep', docsScope: 'User or managed', repoEffectiveScopes: undefined, kind: 'mismatch' },
    ]);
  });

  it('flat 欄位登錄的 scope 比 docs 窄 → mismatch', () => {
    const scopes = new Map([['syncClaudeAiSkills', 'User, local, or managed']]);
    const schemas: Record<string, FlatFieldSchema> = {
      syncClaudeAiSkills: field({ valueSchema: { kind: 'boolean' }, effectiveScopes: USER_ONLY }),
    };

    expect(diffScopes(schemas, scopes)).toEqual([
      { key: 'syncClaudeAiSkills', docsScope: 'User, local, or managed', repoEffectiveScopes: USER_ONLY, kind: 'mismatch' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// #27 — parseSettingsEntries / diffDeprecated / diffEnumOptions
// ---------------------------------------------------------------------------

/** Enum-valued fake field — `field()` above types valueSchema without `enum`,
 * so this widens via a direct `as unknown as FlatFieldSchema` cast (no
 * intervening typed literal → no excess-property check). */
function enumField(options: string[], nestedUnder?: string): FlatFieldSchema {
  return {
    controlType: String,
    section: 'general',
    valueSchema: { kind: 'string', enum: options },
    nestedUnder,
  } as unknown as FlatFieldSchema;
}

function stringField(nestedUnder?: string): FlatFieldSchema {
  return {
    controlType: String,
    section: 'general',
    valueSchema: { kind: 'string' },
    nestedUnder,
  } as unknown as FlatFieldSchema;
}

// Verbatim (trimmed) excerpts from settings-reference.md, 2026-09-23 — real
// <Warning> and **Type** bullet shapes, not synthesized ones.
const warningMd = [
  '### `keybindingFlavor`',
  '',
  '<Warning>',
  "  Deprecated since v2.1.261 and has no effect. The prompt's word-editing keys always follow readline conventions, as in Bash. Claude Code still accepts `keybindingFlavor`, so a settings file that sets it stays valid.",
  '</Warning>',
  '',
  'In v2.1.238 through v2.1.260, setting it to `"readline"` made `Ctrl+W` delete back to the previous whitespace instead of only the previous word.',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: string, `"classic"` or `"readline"`',
  '* **Default**: unset',
  '',
  '### `teammateDefaultModel`',
  '',
  '<Warning>',
  '  Removed in v2.1.234, together with its `/config` row **Default teammate model**. Setting it has no effect on current versions.',
  '</Warning>',
  '',
  'Through v2.1.233, you set this key to the model for agent team teammates your prompt did not name a model for.',
  '',
  '* **Scope**: [`Global config`](#scopes). On v2.1.233 and earlier.',
  '* **Type**: string, a model alias or full model ID, or `null`',
  '* **Default**: unset',
  '',
  '### `prefersReducedMotion`',
  '',
  'Reduce or turn off interface animations such as the spinner, shimmer, and flash effects.',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: Boolean',
  '  * `true`: Claude Code reduces or turns off interface animations such as the spinner, shimmer, and flash effects',
  '  * `false`: the same as unset; Claude Code shows its animations',
  '* **Default**: `false`',
  '',
  '### `twoWarningsKey`',
  '',
  '<Warning>',
  '  Deprecated since v2.1.1.',
  '</Warning>',
  '',
  'Some body text sits between the two Warning blocks — only the first classifies.',
  '',
  '<Warning>',
  '  Removed in v2.1.2.',
  '</Warning>',
  '',
  '* **Type**: Boolean',
  '* **Default**: unset',
].join('\n');

describe('parseSettingsEntries — Warning classification (T1)', () => {
  it('"Deprecated" 開頭的 Warning 分類為 kind: "deprecated"，docs 文字保留原句', () => {
    const entries = parseSettingsEntries(warningMd);
    const entry = entries.get('keybindingFlavor');
    expect(entry?.warning?.kind).toBe('deprecated');
    expect(entry?.warning?.text).toContain('Deprecated since v2.1.261');
  });

  it('"Removed in" 開頭的 Warning 分類為 kind: "removed"', () => {
    const entries = parseSettingsEntries(warningMd);
    const entry = entries.get('teammateDefaultModel');
    expect(entry?.warning?.kind).toBe('removed');
    expect(entry?.warning?.text).toContain('Removed in v2.1.234');
  });

  it('無 Warning block 的 entry → warning 為 undefined', () => {
    const entries = parseSettingsEntries(warningMd);
    expect(entries.get('prefersReducedMotion')?.warning).toBeUndefined();
  });

  it('entry 內有多個 Warning block → 只取第一個分類', () => {
    const entries = parseSettingsEntries(warningMd);
    const entry = entries.get('twoWarningsKey');
    expect(entry?.warning?.kind).toBe('deprecated');
    expect(entry?.warning?.text).toContain('Deprecated since v2.1.1');
    expect(entry?.warning?.text).not.toContain('Removed in v2.1.2');
  });

  it('default 仍照既有 **Default** bullet 邏輯讀取（相容既有消費者）', () => {
    const entries = parseSettingsEntries(warningMd);
    expect(entries.get('keybindingFlavor')?.default).toBe('unset');
    expect(entries.get('prefersReducedMotion')?.default).toBe('`false`');
  });

  // T-e: 非棄用類 Warning（不是 Deprecated／Removed 開頭）不應被分類。
  it('非 Deprecated／Removed 開頭的 Warning → warning 為 undefined，diffDeprecated 不回報', () => {
    const md = [
      '### `skipConfirmDialog`',
      '',
      '<Warning>',
      '  Setting this to true skips the confirmation dialog.',
      '</Warning>',
      '',
      '* **Type**: Boolean',
      '* **Default**: unset',
    ].join('\n');
    const entries = parseSettingsEntries(md);
    expect(entries.get('skipConfirmDialog')?.warning).toBeUndefined();

    const schemas: Record<string, FlatFieldSchema> = {
      skipConfirmDialog: field({ valueSchema: { kind: 'boolean' } }),
    };
    expect(diffDeprecated(schemas, entries)).toEqual([]);
  });

  // T-f: Warning 必須在 entry 開頭（sawContent 為 false 時）才分類；正文或程式碼區塊
  // 先出現，後面才接的 Warning 不算。
  it('entry 正文先出現一行，後面接 Deprecated Warning → warning 為 undefined（Warning 不在開頭）', () => {
    const md = [
      '### `lateWarningKey`',
      '',
      'Some prose sits before the Warning block.',
      '',
      '<Warning>',
      '  Deprecated since v2.1.1.',
      '</Warning>',
      '',
      '* **Type**: Boolean',
      '* **Default**: unset',
    ].join('\n');
    const entries = parseSettingsEntries(md);
    expect(entries.get('lateWarningKey')?.warning).toBeUndefined();
  });

  it('entry 開頭先接一段 fenced code block，後面才接 Deprecated Warning → warning 為 undefined', () => {
    const md = [
      '### `fencedThenWarningKey`',
      '',
      '```json',
      '{}',
      '```',
      '',
      '<Warning>',
      '  Deprecated since v2.1.1.',
      '</Warning>',
      '',
      '* **Type**: Boolean',
      '* **Default**: unset',
    ].join('\n');
    const entries = parseSettingsEntries(md);
    expect(entries.get('fencedThenWarningKey')?.warning).toBeUndefined();
  });
});

// Verbatim (trimmed) excerpts covering Type bullet formats (a)–(f).
const typesMd = [
  '### `effortLevel`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: string, one of:',
  '  * `"low"`: the least reasoning, for short, scoped, latency-sensitive tasks',
  '  * `"medium"`: reduces token usage for cost-sensitive work',
  '  * `"high"`: balances token usage and intelligence',
  '  * `"xhigh"`: deeper reasoning at higher token spend',
  '* **Default**: unset',
  '',
  '### `keybindingFlavor`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: string, `"classic"` or `"readline"`',
  '* **Default**: unset',
  '',
  '### `disableDeepLinkRegistration`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: the string `"disable"`',
  '* **Default**: unset, so Claude Code registers the handler',
  '',
  '### `theme`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: string, one of:',
  "  * `\"auto\"`: matches your terminal's light or dark background",
  '  * `"dark"`: the dark theme',
  '  * `"light"`: the light theme',
  '  * `"dark-daltonized"`: the dark theme with colorblind-friendly colors',
  '  * `"light-daltonized"`: the light theme with colorblind-friendly colors',
  "  * `\"dark-ansi\"`: the dark theme using only your terminal's ANSI color palette",
  "  * `\"light-ansi\"`: the light theme using only your terminal's ANSI color palette",
  '  * `"custom:<slug>"` or `"custom:<plugin-name>:<slug>"`: a custom theme from `~/.claude/themes/` or a plugin',
  '* **Default**: `"dark"`',
  '',
  '### `feedbackDrafts`',
  '',
  '* **Scope**: [`User or managed`](#scopes)',
  '* **Type**: string, one of `"notify"`, `"quiet"`, or `"off"`',
  '  * `"notify"`: Claude Code shows a card above the prompt when Claude queues a draft',
  '  * `"quiet"`: Claude drafts without a card',
  '  * `"off"`: Claude Code removes the SendFeedback tool',
  '* **Default**: `"notify"`',
  '',
  '### `permissions.defaultMode`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: string, one of:',
  '  * `"default"`: Claude Code runs only reads without asking',
  '  * `"acceptEdits"`: Claude Code also runs file edits and common filesystem commands',
  '  * `"plan"`: Claude Code reads and plans but blocks edits until you approve a plan',
  '* **Default**: unset',
  '',
  '### `worktree.baseRef`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: string, one of:',
  '  * `"fresh"`: new worktrees branch from `origin/<default-branch>`',
  "  * `\"head\"`: new worktrees branch from your current local `HEAD`",
  '* **Default**: `"fresh"`',
  '',
  '### `dialogExpiry`',
  '',
  '* **Scope**: [`User or managed`](#scopes)',
  '* **Type**: string, one of `"60s"`, `"5m"`, `"10m"`, or `"never"`, which disables the deadline',
  '* **Default**: `"5m"`',
  '',
  '### `maxEffortLevel`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: string, one of `"low"`, `"medium"`, `"high"`, `"xhigh"`, or `"max"`. A `"max"` value sets no cap',
  '* **Default**: unset, so no cap applies',
  '',
  '### `oddInlineListKey`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: string, `"a"` or `"b"` plus any path',
  '* **Default**: unset',
].join('\n');

describe('parseSettingsEntries — Type 欄位格式 a–f (T3)', () => {
  it('(a) "one of:" + 縮排子項目 → typeOptions 為各子項目的字串值', () => {
    const entries = parseSettingsEntries(typesMd);
    expect(entries.get('effortLevel')?.typeOptions).toEqual(['low', 'medium', 'high', 'xhigh']);
  });

  it('(c) 行內 "string, `"a"` or `"b"`"（無 "one of"）→ typeOptions 取行內字串值', () => {
    const entries = parseSettingsEntries(typesMd);
    expect(entries.get('keybindingFlavor')?.typeOptions).toEqual(['classic', 'readline']);
  });

  it('(d) 單一字串 "the string `"x"`" → typeOptions 為單元素陣列', () => {
    const entries = parseSettingsEntries(typesMd);
    expect(entries.get('disableDeepLinkRegistration')?.typeOptions).toEqual(['disable']);
  });

  it('theme：樣板值（含 `<`，如 "custom:<slug>"）不列入 typeOptions，只留具體字面值', () => {
    const entries = parseSettingsEntries(typesMd);
    expect(entries.get('theme')?.typeOptions).toEqual([
      'auto', 'dark', 'light', 'dark-daltonized', 'light-daltonized', 'dark-ansi', 'light-ansi',
    ]);
  });

  it('(b)+(e) 行內 "one of `"a"`, `"b"`, or `"c"`" 加子項目重複列出同一組值 → 去重後仍是 3 個', () => {
    const entries = parseSettingsEntries(typesMd);
    expect(entries.get('feedbackDrafts')?.typeOptions).toEqual(['notify', 'quiet', 'off']);
  });

  it('(f) dotted-heading 子設定：permissions.defaultMode／worktree.baseRef 各自解析出 typeOptions', () => {
    const entries = parseSettingsEntries(typesMd);
    expect(entries.get('permissions.defaultMode')?.typeOptions).toEqual(['default', 'acceptEdits', 'plan']);
    expect(entries.get('worktree.baseRef')?.typeOptions).toEqual(['fresh', 'head']);
  });

  it('Boolean 型別的 true/false 子項目不是 enum，typeOptions 為 undefined', () => {
    const entries = parseSettingsEntries(warningMd);
    expect(entries.get('prefersReducedMotion')?.typeOptions).toBeUndefined();
  });

  // T-c(1): Type 是開放描述（非 "one of"），底下接引號字面值子項目 → 不收（Type 本身非封閉列舉）。
  it('Type 為 "string, a model alias or full model ID" + 引號子項目 → typeOptions 為 undefined', () => {
    const md = [
      '### `modelAliasKey`',
      '',
      '* **Type**: string, a model alias or full model ID',
      '  * `"opus"`: the strongest model',
      '* **Default**: unset',
    ].join('\n');
    expect(parseSettingsEntries(md).get('modelAliasKey')?.typeOptions).toBeUndefined();
  });

  // T-c(2): 引號子項目掛在 **Default** 底下、不在 Type 底下 → 不收，即使 Type 本身是封閉列舉格式。
  it('引號子項目掛在 **Default** 底下（非 Type 底下）→ typeOptions 不含該子項目的值', () => {
    const md = [
      '### `defaultStraySubBulletKey`',
      '',
      '* **Type**: string, one of:',
      '  * `"a"`: option a',
      '* **Default**: `"a"`',
      '  * `"b"`: stray sub-bullet sitting under Default, not Type',
    ].join('\n');
    expect(parseSettingsEntries(md).get('defaultStraySubBulletKey')?.typeOptions).toEqual(['a']);
  });

  // T-d: LIST_TAIL_RE 的真實尾巴格式（dialogExpiry 的 ", which ..."、maxEffortLevel 的 ". A ..."）。
  it('dialogExpiry：inline 清單尾巴為 ", which disables the deadline" → typeOptions 取四個值', () => {
    expect(parseSettingsEntries(typesMd).get('dialogExpiry')?.typeOptions).toEqual(['60s', '5m', '10m', 'never']);
  });

  it('maxEffortLevel：inline 清單尾巴為 ". A `"max"` value sets no cap" → typeOptions 取五個值', () => {
    expect(parseSettingsEntries(typesMd).get('maxEffortLevel')?.typeOptions).toEqual([
      'low', 'medium', 'high', 'xhigh', 'max',
    ]);
  });

  it('inline 清單後接其他非尾巴格式的散文（"plus any path"）→ typeOptions 為 undefined', () => {
    expect(parseSettingsEntries(typesMd).get('oddInlineListKey')?.typeOptions).toBeUndefined();
  });
});

// Verbatim excerpt from settings-reference.md:3501-3512, 2026-09-23 — timeFormat's
// last sub-bullet is a strftime-pattern description, not a literal: the Type is open.
const timeFormatMd = [
  '### `timeFormat`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: string, one of:',
  '  * `"auto"`: the same as unset; each time keeps its built-in format, which follows your locale on the turn duration message',
  '  * `"12-hour"`: a 12-hour clock',
  '  * `"24-hour"`: a 24-hour clock',
  '  * `"24-hour-utc"`: a 24-hour clock in UTC with `Z` after the minutes, such as `18:05Z`; Claude Code ignores [`timeZone`](#timezone) for this preset',
  '  * A strftime pattern such as `"%H:%M"`: Claude Code writes each time with the pattern. Any value that contains a `%` is a pattern, and any other value outside the presets counts as `"auto"`',
  '* **Default**: `"auto"`',
].join('\n');

describe('parseSettingsEntries — openType (T-a)', () => {
  it('timeFormat：子項目最後一條不是字面值開頭（strftime pattern 描述）→ openType 為 true，typeOptions 為 4 個 preset', () => {
    const entry = parseSettingsEntries(timeFormatMd).get('timeFormat');
    expect(entry?.openType).toBe(true);
    expect(entry?.typeOptions).toEqual(['auto', '12-hour', '24-hour', '24-hour-utc']);
  });

  it('theme：樣板值子項目（含 `<`，如 "custom:<slug>"）→ openType 為 true', () => {
    expect(parseSettingsEntries(typesMd).get('theme')?.openType).toBe(true);
  });
});

describe('diffEnumOptions — open type (T-a)', () => {
  it('repo 是自由字串（無 enum）＋ docs 為 open type → 不回報漂移', () => {
    const entries = parseSettingsEntries(timeFormatMd);
    const schemas: Record<string, FlatFieldSchema> = { timeFormat: stringField() };
    expect(diffEnumOptions(schemas, entries)).toEqual([]);
  });

  it('repo enum 缺 docs 的一個固定值（"24-hour-utc"）→ mismatch，docsOnly 為該值，repoOnly 為空', () => {
    const entries = parseSettingsEntries(timeFormatMd);
    const schemas: Record<string, FlatFieldSchema> = {
      timeFormat: enumField(['auto', '12-hour', '24-hour']),
    };
    expect(diffEnumOptions(schemas, entries)).toEqual([
      { key: 'timeFormat', kind: 'mismatch', docsOnly: ['24-hour-utc'], repoOnly: [] },
    ]);
  });

  it('repo enum 多出 docs 沒有的值（open type 允許擴充）→ 不回報漂移', () => {
    const entries = parseSettingsEntries(timeFormatMd);
    const schemas: Record<string, FlatFieldSchema> = {
      timeFormat: enumField(['auto', '12-hour', '24-hour', '24-hour-utc', 'custom']),
    };
    expect(diffEnumOptions(schemas, entries)).toEqual([]);
  });
});

// Verbatim (trimmed) excerpts from settings-reference.md, 2026-09-23 — the 5
// keys removed in #27, with their real Deprecated／Removed Warning text.
const REMOVED_KEYS_WARNING_MD = [
  '### `keybindingFlavor`',
  '',
  '<Warning>',
  "  Deprecated since v2.1.261 and has no effect. The prompt's word-editing keys always follow readline conventions, as in Bash. Claude Code still accepts `keybindingFlavor`, so a settings file that sets it stays valid.",
  '</Warning>',
  '',
  '* **Type**: string, `"classic"` or `"readline"`',
  '* **Default**: unset',
  '',
  '### `voiceEnabled`',
  '',
  '<Warning>',
  '  Deprecated since v2.1.92, when the `voice` object replaced it. Claude Code still reads it so older settings files keep working, but new configurations should set `voice.enabled`.',
  '</Warning>',
  '',
  '* **Type**: Boolean',
  '* **Default**: unset',
  '',
  '### `disableArtifact`',
  '',
  '<Warning>',
  '  Deprecated, and replaced by `enableArtifact`. Claude Code still honors `disableArtifact: true` as equivalent to `enableArtifact: false`, and ignores `disableArtifact: false`.',
  '</Warning>',
  '',
  '* **Type**: Boolean',
  '* **Default**: unset',
  '',
  '### `permissionExplainerEnabled`',
  '',
  '<Warning>',
  '  Removed in v2.1.257, together with the `Ctrl+E` command explanation on Bash and PowerShell permission prompts. Setting it has no effect on current versions.',
  '</Warning>',
  '',
  '* **Type**: Boolean',
  '* **Default**: `true`',
  '',
  '### `teammateDefaultModel`',
  '',
  '<Warning>',
  '  Removed in v2.1.234, together with its `/config` row **Default teammate model**. Setting it has no effect on current versions.',
  '</Warning>',
  '',
  '* **Type**: string, a model alias or full model ID, or `null`',
  '* **Default**: unset',
].join('\n');

describe('diffDeprecated (27-2)', () => {
  it('回傳仍在 repo schema 的 deprecated/removed key，含 kind 與 docs 文字，並依 key 排序', () => {
    const entries = parseSettingsEntries(warningMd);
    const schemas: Record<string, FlatFieldSchema> = {
      twoWarningsKey: field({ valueSchema: { kind: 'boolean' } }),
      keybindingFlavor: stringField(),
      prefersReducedMotion: field({ valueSchema: { kind: 'boolean' } }),
      // teammateDefaultModel 故意不放進 schema：模擬 #27 移除後不該再被回報。
    };

    expect(diffDeprecated(schemas, entries)).toEqual([
      { key: 'keybindingFlavor', kind: 'deprecated', docs: expect.stringContaining('Deprecated since v2.1.261') },
      { key: 'twoWarningsKey', kind: 'deprecated', docs: expect.stringContaining('Deprecated since v2.1.1') },
    ]);
  });

  it('沒有 Warning 的 key 不出現在結果中', () => {
    const entries = parseSettingsEntries(warningMd);
    const schemas: Record<string, FlatFieldSchema> = {
      prefersReducedMotion: field({ valueSchema: { kind: 'boolean' } }),
    };
    expect(diffDeprecated(schemas, entries)).toEqual([]);
  });

  it('dotted-heading 子設定（nestedUnder）也能比對出 deprecated 標記', () => {
    const md = [
      '### `container.child`',
      '',
      '<Warning>',
      '  Deprecated since v2.1.9.',
      '</Warning>',
      '',
      '* **Type**: Boolean',
      '* **Default**: unset',
    ].join('\n');
    const entries = parseSettingsEntries(md);
    const schemas: Record<string, FlatFieldSchema> = {
      child: field({ valueSchema: { kind: 'boolean' }, nestedUnder: 'container' }),
    };

    expect(diffDeprecated(schemas, entries)).toEqual([
      { key: 'container.child', kind: 'deprecated', docs: expect.stringContaining('Deprecated since v2.1.9') },
    ]);
  });

  // T-b: 同一形狀但走 object property（無 nestedUnder），驗證 forEachDocsKey 的 walk 分支。
  it('object property 子欄位（無 nestedUnder）也能比對出 deprecated 標記', () => {
    const md = [
      '### `worktree.child`',
      '',
      '<Warning>',
      '  Deprecated since v2.1.9.',
      '</Warning>',
      '',
      '* **Type**: Boolean',
      '* **Default**: unset',
    ].join('\n');
    const entries = parseSettingsEntries(md);
    const schemas: Record<string, FlatFieldSchema> = {
      worktree: field({
        valueSchema: {
          kind: 'object',
          properties: { child: { schema: { kind: 'boolean' }, optional: true } },
        },
      }),
    };

    expect(diffDeprecated(schemas, entries)).toEqual([
      { key: 'worktree.child', kind: 'deprecated', docs: expect.stringContaining('Deprecated since v2.1.9') },
    ]);
  });

  // T2: fixture schema（模擬移除前的狀態，5 個 key 仍在 schema 中）+ 真實 docs Warning 文字
  // → diffDeprecated 應把全部 5 個列為 drift，且 kind 正確（deprecated ×3／removed ×2）。
  it('fixture schema（含 5 個待移除 key）+ 真實 docs Warning 文字 → 5 個 key 全部列為 drift，kind 正確', () => {
    const realEntries = parseSettingsEntries(REMOVED_KEYS_WARNING_MD);

    const fixtureSchemas: Record<string, FlatFieldSchema> = {
      keybindingFlavor: stringField(),
      voiceEnabled: field({ valueSchema: { kind: 'boolean' } }),
      disableArtifact: field({ valueSchema: { kind: 'boolean' } }),
      permissionExplainerEnabled: field({ valueSchema: { kind: 'boolean' } }),
      teammateDefaultModel: stringField(),
    };

    expect(diffDeprecated(fixtureSchemas, realEntries)).toEqual([
      { key: 'disableArtifact', kind: 'deprecated', docs: expect.stringContaining('replaced by `enableArtifact`') },
      { key: 'keybindingFlavor', kind: 'deprecated', docs: expect.stringContaining('Deprecated since v2.1.261') },
      {
        key: 'permissionExplainerEnabled',
        kind: 'removed',
        docs: expect.stringContaining('Removed in v2.1.257'),
      },
      { key: 'teammateDefaultModel', kind: 'removed', docs: expect.stringContaining('Removed in v2.1.234') },
      { key: 'voiceEnabled', kind: 'deprecated', docs: expect.stringContaining('Deprecated since v2.1.92') },
    ]);
  });

  // T2 guard: 真實 repo schema（移除後）+ 同一批真實 docs Warning 文字 → 這 5 個 key
  // 應維持 []，確保它們已從 schema 移除且不再被回報（防止未來誤加回去而沒發現）。
  it('真實 schema（移除後）+ 真實 docs Warning 文字 → []（5 個 key 保持移除）', () => {
    const realEntries = parseSettingsEntries(REMOVED_KEYS_WARNING_MD);

    expect(diffDeprecated(getAllFlatFieldSchemas(), realEntries)).toEqual([]);
  });
});

describe('diffEnumOptions (27-3)', () => {
  // T-b: object property 子欄位（無 nestedUnder）也能比對出 enum 漂移，驗證 forEachDocsKey 的 walk 分支。
  it('object property 子欄位（無 nestedUnder）：worktree.baseRef 缺 "head" → mismatch', () => {
    const entries = parseSettingsEntries(typesMd);
    const schemas: Record<string, FlatFieldSchema> = {
      worktree: field({
        valueSchema: {
          kind: 'object',
          properties: { baseRef: { schema: { kind: 'string', enum: ['fresh'] }, optional: true } },
        },
      }),
    };

    expect(diffEnumOptions(schemas, entries)).toEqual([
      { key: 'worktree.baseRef', kind: 'mismatch', docsOnly: ['head'], repoOnly: [] },
    ]);
  });

  it('repo 是字串 enum，但 docs Type 未能解析出 typeOptions → kind: "unparsed"', () => {
    const md = ['### `oddEnum`', '', '* **Type**: depends on your plan', '* **Default**: unset'].join('\n');
    const entries = parseSettingsEntries(md);
    const schemas: Record<string, FlatFieldSchema> = {
      oddEnum: enumField(['a', 'b']),
    };

    expect(diffEnumOptions(schemas, entries)).toEqual([
      { key: 'oddEnum', kind: 'unparsed', docsOnly: [], repoOnly: ['a', 'b'] },
    ]);
  });

  it('repo 非 enum（自由輸入字串）但 docs Type 是固定選項 → kind: "repoNotEnum"（如 timeFormat 的形狀）', () => {
    const md = [
      '### `timeFormat`',
      '',
      '* **Type**: string, one of:',
      '  * `"12h"`: 12-hour clock',
      '  * `"24h"`: 24-hour clock',
      '* **Default**: unset',
    ].join('\n');
    const entries = parseSettingsEntries(md);
    const schemas: Record<string, FlatFieldSchema> = {
      timeFormat: stringField(),
    };

    expect(diffEnumOptions(schemas, entries)).toEqual([
      { key: 'timeFormat', kind: 'repoNotEnum', docsOnly: ['12h', '24h'], repoOnly: [] },
    ]);
  });

  it('repo enum 與 docs typeOptions 完全相符 → 不回報', () => {
    const entries = parseSettingsEntries(typesMd);
    const schemas: Record<string, FlatFieldSchema> = {
      keybindingFlavor: enumField(['classic', 'readline']),
    };
    expect(diffEnumOptions(schemas, entries)).toEqual([]);
  });

  it('dotted-heading 子設定（nestedUnder）也能比對：permissions.defaultMode', () => {
    const entries = parseSettingsEntries(typesMd);
    const schemas: Record<string, FlatFieldSchema> = {
      defaultMode: enumField(['default', 'acceptEdits'], 'permissions'),
    };

    expect(diffEnumOptions(schemas, entries)).toEqual([
      { key: 'permissions.defaultMode', kind: 'mismatch', docsOnly: ['plan'], repoOnly: [] },
    ]);
  });

  it('回傳結果依 key 排序', () => {
    const entries = parseSettingsEntries(typesMd);
    const schemas: Record<string, FlatFieldSchema> = {
      theme: enumField(['dark']),
      effortLevel: enumField(['max', 'xhigh', 'high', 'medium', 'low']),
    };
    expect(diffEnumOptions(schemas, entries).map((d) => d.key)).toEqual(['effortLevel', 'theme']);
  });
});

// T4 guard: effortLevel 的 repoOnly 對照真實 docs typeOptions，鎖住 'max' 這個具體漂移
// （#27 P2 只套用這一項；套用後 getSchemaEnumOptions('effortLevel') 不再含 'max'，
// claude-settings-schema.test.ts 另有該斷言）。
describe('diffEnumOptions — effortLevel repoOnly 對照真實 docs Type (T3 fixture schema with max)', () => {
  it('repo（套用前，含 "max"）vs 真實 docs typeOptions → repoOnly 恰為 ["max"]', () => {
    const entries = parseSettingsEntries(typesMd);
    const fixtureSchemaWithMax: Record<string, FlatFieldSchema> = {
      effortLevel: enumField(['max', 'xhigh', 'high', 'medium', 'low']),
    };

    const drift = diffEnumOptions(fixtureSchemaWithMax, entries);
    expect(drift).toEqual([
      { key: 'effortLevel', kind: 'mismatch', docsOnly: [], repoOnly: ['max'] },
    ]);
  });
});

// T-g: F3 的 Warning-parse 健康檢查——md 裡有 <Warning>/Deprecated/Removed 字樣，
// 但一筆都沒被分類到，判為不健康（供 CLI 用來 exit 1）。
describe('warningParseHealthy (T-g)', () => {
  it('md 含 <Warning> 與 Deprecated 字樣，但 entries 一筆 warning 都沒有 → false', () => {
    const md = ['### `someKey`', '', '<Warning>', '  Deprecated since v2.1.1.', '</Warning>'].join('\n');
    expect(warningParseHealthy(md, new Map())).toBe(false);
  });

  it('md 含 Warning 且 entries 有分類到 → true', () => {
    const entries = parseSettingsEntries(warningMd);
    expect(warningParseHealthy(warningMd, entries)).toBe(true);
  });

  it('md 完全沒有 Warning → true（沒有可分類的東西，非不健康）', () => {
    const entries = parseSettingsEntries(detailsMd);
    expect(warningParseHealthy(detailsMd, entries)).toBe(true);
  });
});

// T-h: F2 settingsGaps 濾掉 docs 已標 Deprecated／Removed 的 key（如 taskOutputMaxChars）。
describe('excludeDeprecatedGaps (T-h)', () => {
  it('濾掉 entries 有 warning 的 key，保留其餘', () => {
    const entries = parseSettingsEntries(REMOVED_KEYS_WARNING_MD);
    const keys = ['keybindingFlavor', 'newFeatureKey'];
    expect(excludeDeprecatedGaps(keys, entries)).toEqual(['newFeatureKey']);
  });

  it('entries 沒有該 key（未收錄）→ 保留', () => {
    expect(excludeDeprecatedGaps(['unknownKey'], new Map())).toEqual(['unknownKey']);
  });
});
