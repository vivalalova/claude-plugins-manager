import { describe, it, expect } from 'vitest';

import type { FlatFieldSchema } from '../../claude-settings-schema';
import { getAllFlatFieldSchemas } from '../../claude-settings-schema';
import {
  parseSettingsDetails,
  parseDocsDefault,
  diffDefaults,
  diffStorage,
  diffScopes,
  KNOWN_DEFAULT_EQUIVALENT,
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
  schema: { kind: string; properties?: Record<string, FakeObjectProperty> };
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

describe('parseSettingsDetails', () => {
  it('reads the first Default bullet of each `### key` entry and ignores code blocks and orphans', () => {
    const details = parseSettingsDetails(detailsMd);

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
