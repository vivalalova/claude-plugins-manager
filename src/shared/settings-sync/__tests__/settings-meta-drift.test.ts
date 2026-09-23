import { describe, it, expect } from 'vitest';

import type { FlatFieldSchema } from '../../claude-settings-schema';
import {
  parseSettingsDetails,
  parseDocsDefault,
  diffDefaults,
  diffStorage,
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

type FakeField = {
  valueSchema: { kind: string; properties?: object };
  default?: unknown;
  nestedUnder?: string;
  storageFile?: 'globalConfig';
};

function field(partial: FakeField): FlatFieldSchema {
  return { controlType: 'String', section: 'general', ...partial } as unknown as FlatFieldSchema;
}

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
