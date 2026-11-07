import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { BooleanMergeRule, getAllFlatFieldSchemas } from '../../claude-settings-schema';
import * as drift from '../settings-meta-drift';
import type { DocsEntry } from '../settings-meta-drift';

const realMd = readFileSync(join(__dirname, 'fixtures', 'settings-reference.booleanMerge.md'), 'utf8');

const ANY_TRUE_KEYS = [
  'permissions.blockReadsOutsideWorkingDirectories',
  'permissions.blockWritesOutsideWorkingDirectories',
  'skipAutoPermissionPrompt',
  'skipDangerousModePermissionPrompt',
  'disableClaudeAiConnectors',
  'isolatePeerMachines',
];
const ONLY_FALSE_KEYS = ['syncClaudeAiSkills', 'syncClaudeAiPlugins', 'enableArtifact', 'useAutoModeDuringPlan'];
const ALL_KEYS = [...ANY_TRUE_KEYS, ...ONLY_FALSE_KEYS];

const EXCLUDED_KEYS = ['prefersReducedMotion', 'disableWorkflows', 'channelsEnabled', 'enableAllProjectMcpServers'];

function runDiff(md: string): ReturnType<typeof drift.diffBooleanMerge> {
  return drift.diffBooleanMerge(getAllFlatFieldSchemas(), drift.parseSettingsEntries(md));
}

function mergeOf(md: string, key: string): DocsEntry['booleanMerge'] {
  return drift.parseSettingsEntries(md).get(key)?.booleanMerge;
}

/** Carrier keys exist in the repo schema and carry no booleanMerge mark. */
const SCOPE_ROW_MD = [
  '### `fastMode`',
  '',
  '* **Scope**: [`Any file`](#scopes). A `true` in any file applies, so a repository can turn it on for itself but can\'t lift yours.',
  '* **Type**: Boolean',
  '* **Default**: unset',
].join('\n');

const TYPE_SUBBULLET_MD = [
  '### `disableAllHooks`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: Boolean',
  '  * `true`: hooks are off',
  '  * `false`: the same as unset; the block still applies if another file sets `true`',
  '* **Default**: unset',
].join('\n');

const HONORS_ONLY_FALSE_MD = [
  '### `alwaysThinkingEnabled`',
  '',
  'Turn thinking off. Claude Code honors only `false`: `true` is the same as unset.',
  '',
  '* **Scope**: [`User, local, or managed`](#scopes)',
  '* **Type**: Boolean',
  '* **Default**: unset',
].join('\n');

const ENABLE_ARTIFACT_SCOPE_MD = [
  '### `enableArtifact`',
  '',
  '* **Scope**: [`Any file`](#scopes). Every file can turn the tool off, and none can turn it back on.',
  '* **Type**: Boolean',
  '* **Default**: unset',
].join('\n');

const ENABLE_ARTIFACT_TYPE_MD = [
  '### `enableArtifact`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: Boolean',
  '  * `false`: Claude Code turns the Artifact tool off for every session the file applies to',
  '  * `true`: the same as leaving the key unset, because it never overrides a `false` from another file, from `CLAUDE_CODE_DISABLE_ARTIFACT`, or from your organization\'s admin setting',
  '* **Default**: unset',
].join('\n');

const AUTO_MEMORY_MD = [
  '### `autoMemoryEnabled`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: Boolean',
  '  * `true`: the same as unset; auto memory stays on unless something that outranks this key turns it off for the session, such as `--bare`, safe mode, or `CLAUDE_CODE_DISABLE_AUTO_MEMORY`',
  '  * `false`: Claude doesn\'t read from or write to the auto memory directory',
  '* **Default**: `true`',
].join('\n');

const ATTRIBUTION_MD = [
  '### `attribution`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: Boolean',
  '  * `true`: the same as unset; Claude Code adds the commit trailer and pull request text',
  '  * `false`: hide all attribution',
  '* **Default**: unset',
].join('\n');

const ANY_FALSE_OFF_MD = [
  '### `fastMode`',
  '',
  '* **Scope**: [`User, local, or managed`](#scopes). A repository can\'t turn it off for you.',
  '  * A `false` in any of these files or in `--settings` turns it off, unless you leave that user or local file out with an option such as `--setting-sources`',
  '* **Type**: Boolean',
  '* **Default**: unset',
].join('\n');

const PREFERS_REDUCED_MOTION_MD = [
  '### `prefersReducedMotion`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: Boolean',
  '  * `true`: Claude Code reduces or turns off interface animations such as the spinner, shimmer, and flash effects',
  '  * `false`: the same as unset; Claude Code shows its animations',
  '* **Default**: `false`',
].join('\n');

const DISABLE_WORKFLOWS_MD = [
  '### `disableWorkflows`',
  '',
  '* **Scope**: [`Any file`](#scopes)',
  '* **Type**: Boolean',
  '  * `true`: Claude Code turns off dynamic workflows and the bundled workflow commands for everyone your settings reach',
  '  * `false`: the same as unset; whether workflows are on then follows [`enableWorkflows`](#enableworkflows) and your plan\'s default',
  '* **Default**: `false`',
].join('\n');

describe('booleanMerge drift：三句型各自命中 missing（紅燈 15）', () => {
  it('Scope 列「A `true` in any file applies」命中 missing', () => {
    const hit = runDiff(SCOPE_ROW_MD).filter((d) => d.key === 'fastMode');
    expect(hit).toEqual([expect.objectContaining({ key: 'fastMode', kind: 'missing' })]);
  });

  it('Type 子項目「`false`: the same as unset; ... another file」命中 missing', () => {
    const hit = runDiff(TYPE_SUBBULLET_MD).filter((d) => d.key === 'disableAllHooks');
    expect(hit).toEqual([expect.objectContaining({ key: 'disableAllHooks', kind: 'missing' })]);
  });

  it('正文「honors only `false`」命中 missing', () => {
    const hit = runDiff(HONORS_ONLY_FALSE_MD).filter((d) => d.key === 'alwaysThinkingEnabled');
    expect(hit).toEqual([expect.objectContaining({ key: 'alwaysThinkingEnabled', kind: 'missing' })]);
  });

  it('三句型解析出的規則：Scope 列與 Type 子項目為 anyTrue，honors only false 為 onlyFalse', () => {
    expect(mergeOf(SCOPE_ROW_MD, 'fastMode')).toBe('anyTrue');
    expect(mergeOf(TYPE_SUBBULLET_MD, 'disableAllHooks')).toBe('anyTrue');
    expect(mergeOf(HONORS_ONLY_FALSE_MD, 'alwaysThinkingEnabled')).toBe('onlyFalse');
  });

  it('沒有三句型的條目不回報', () => {
    const md = ['### `fastMode`', '', '* **Scope**: [`Any file`](#scopes)', '* **Type**: Boolean', '* **Default**: unset'].join('\n');
    expect(runDiff(md)).toEqual([]);
  });
});

describe('booleanMerge drift：enableArtifact 的兩種句型各自判為 onlyFalse', () => {
  it('Scope 列「none can turn it back on」單獨出現 → onlyFalse', () => {
    expect(mergeOf(ENABLE_ARTIFACT_SCOPE_MD, 'enableArtifact')).toBe('onlyFalse');
  });

  it('Type 子項目「`true`: the same as leaving the key unset, because it never overrides a `false`」單獨出現 → onlyFalse', () => {
    expect(mergeOf(ENABLE_ARTIFACT_TYPE_MD, 'enableArtifact')).toBe('onlyFalse');
  });

  it('Scope 子項目「A `false` in any of these files … turns it off」單獨出現 → onlyFalse', () => {
    expect(mergeOf(ANY_FALSE_OFF_MD, 'fastMode')).toBe('onlyFalse');
  });

  it('autoMemoryEnabled、attribution、prefersReducedMotion、disableWorkflows 的「`false`/`true`: the same as unset;」不被判為同類（真實文件與單獨 fixture 皆然）', () => {
    expect(mergeOf(realMd, 'autoMemoryEnabled')).toBeUndefined();
    expect(mergeOf(realMd, 'attribution')).toBeUndefined();
    expect(mergeOf(AUTO_MEMORY_MD, 'autoMemoryEnabled')).toBeUndefined();
    expect(mergeOf(ATTRIBUTION_MD, 'attribution')).toBeUndefined();
    expect(mergeOf(realMd, 'prefersReducedMotion')).toBeUndefined();
    expect(mergeOf(realMd, 'disableWorkflows')).toBeUndefined();
    expect(mergeOf(PREFERS_REDUCED_MOTION_MD, 'prefersReducedMotion')).toBeUndefined();
    expect(mergeOf(DISABLE_WORKFLOWS_MD, 'disableWorkflows')).toBeUndefined();
  });
});

describe('booleanMerge drift：真實 settings-reference（紅燈 16）', () => {
  it('文件偵測剛好命中 10 個 key，規則分別為 6 個 anyTrue、4 個 onlyFalse（含 enableArtifact、useAutoModeDuringPlan）', () => {
    for (const key of ANY_TRUE_KEYS) expect(mergeOf(realMd, key), key).toBe('anyTrue');
    for (const key of ONLY_FALSE_KEYS) expect(mergeOf(realMd, key), key).toBe('onlyFalse');
    const detected = [...drift.parseSettingsEntries(realMd)]
      .filter(([, entry]) => entry.booleanMerge !== undefined)
      .map(([key]) => key)
      .sort();
    expect(detected).toEqual([...ALL_KEYS].sort());
  });

  it('schema 標記後，真實文件對 repo 不再回報任何 missing', () => {
    const missing = runDiff(realMd).filter((d) => d.kind === 'missing');
    expect(missing).toEqual([]);
  });

  it('標記後整體無 booleanMerge 漂移', () => {
    expect(runDiff(realMd)).toEqual([]);
  });
});

describe('booleanMerge drift：排除清單（紅燈 17）', () => {
  it('排除清單的 key 不被判同類，而 isolatePeerMachines 仍被判定', () => {
    expect(mergeOf(realMd, 'isolatePeerMachines')).toBe('anyTrue');
    for (const key of EXCLUDED_KEYS) expect(mergeOf(realMd, key), key).toBeUndefined();
  });

  it('排除清單的 key 不出現在 diff 結果', () => {
    const keys = runDiff(realMd).map((d) => d.key);
    for (const key of EXCLUDED_KEYS) expect(keys).not.toContain(key);
  });
});

describe('booleanMerge drift：mismatch 與 repoOnly 分支', () => {
  const real = getAllFlatFieldSchemas();

  it('docs 為 anyTrue、schema 標 onlyFalse → mismatch，帶雙方規則', () => {
    const flat = { fastMode: { ...real.fastMode, booleanMerge: BooleanMergeRule.OnlyFalse } };
    const result = drift.diffBooleanMerge(flat, drift.parseSettingsEntries(SCOPE_ROW_MD));
    expect(result).toEqual([
      expect.objectContaining({ key: 'fastMode', kind: 'mismatch', docs: BooleanMergeRule.AnyTrue, repo: BooleanMergeRule.OnlyFalse }),
    ]);
  });

  it('schema 標了、docs 無句型 → repoOnly', () => {
    const md = ['### `fastMode`', '', '* **Scope**: [`Any file`](#scopes)', '* **Type**: Boolean', '* **Default**: unset'].join('\n');
    const flat = { fastMode: { ...real.fastMode, booleanMerge: BooleanMergeRule.AnyTrue } };
    const result = drift.diffBooleanMerge(flat, drift.parseSettingsEntries(md));
    expect(result).toEqual([
      expect.objectContaining({ key: 'fastMode', kind: 'repoOnly', docs: undefined, repo: BooleanMergeRule.AnyTrue }),
    ]);
  });
});
