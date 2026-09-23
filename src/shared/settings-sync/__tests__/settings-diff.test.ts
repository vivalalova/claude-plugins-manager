/**
 * Core gate: fixture-driven diff logic tests for ../settings-diff.
 *
 * ─── Why a frozen snapshot ────────────────────────────────────────────────
 * fixtures/repo-keys.snapshot.json is frozen at a past schema state rather
 * than live-imported from the schema. This lets the `missing`-direction
 * logic tests stay stable when the schema catches up on gap keys — those
 * tests exercise parseSettingsDocs + diffKeys logic, not "current schema
 * state". "Current schema state" is checked by the end-to-end CLI invocation.
 *
 * `removed`-direction and `collectRepoFlatFieldKeys` tests use small inline
 * fake schemas instead (same reason: isolate diff logic from live schema
 * shape, which is exercised separately by the CLI's real invocation).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

// This import will fail with "Cannot find module" until the module is created.
// That is the intended RED state.
import {
  parseSettingsDocs,
  parseEnvDocs,
  collectRepoSettingKeys,
  collectRepoFlatFieldKeys,
  diffKeys,
  diffEnvVars,
  KNOWN_EXCLUDED,
  KNOWN_REPO_ONLY,
  checkEnvDocsHealth,
  checkSettingsDocsHealth,
} from '../settings-diff';

// ─── Fixture paths ────────────────────────────────────────────────────────────

const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const settingsMd = readFileSync(resolve(FIXTURES_DIR, 'settings.md'), 'utf8');
const settingsReferenceMd = readFileSync(resolve(FIXTURES_DIR, 'settings-reference.md'), 'utf8');
const envVarsMd = readFileSync(resolve(FIXTURES_DIR, 'env-vars.md'), 'utf8');
const snapshotRaw = JSON.parse(readFileSync(resolve(FIXTURES_DIR, 'repo-keys.snapshot.json'), 'utf8')) as { keys: string[] };
const SNAPSHOT_KEYS: Set<string> = new Set(snapshotRaw.keys);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sortedArray(s: string[]): string[] {
  return [...s].sort();
}

// ─── A. Core gate: exactly the 21 expected gaps ───────────────────────────────

// #27：disableArtifact 進 KNOWN_EXCLUDED（docs 標 Deprecated，不再是首方 settings 頁面設定），
// 21 → 20；frozen 快照本身不動（disableArtifact 仍不在快照裡，只是現在被排除不算 gap）。
const EXPECTED_20 = [
  // Top-level (17)
  'advisorModel',
  'agentPushNotifEnabled',
  'autoCompactEnabled',
  'axScreenReader',
  'disableBundledSkills',
  'disableClaudeAiConnectors',
  'disableWorkflows',
  'fallbackModel',
  'fileCheckpointingEnabled',
  'footerLinksRegexes',
  'inputNeededNotifEnabled',
  'remoteControlAtStartup',
  'respondToBashCommands',
  'theme',
  'verbose',
  'wheelScrollAccelerationEnabled',
  'workflowKeywordTriggerEnabled',
  // Nested (3)
  'attribution.sessionUrl',
  'sandbox.credentials.envVars',
  'sandbox.credentials.files',
].sort();

describe('settings-diff — core gate: 20 gap', () => {
  it('diffKeys with frozen snapshot produces exactly the 20 expected gaps', () => {
    const docsKeys = parseSettingsDocs(settingsMd).keys;
    const { missing } = diffKeys(docsKeys, SNAPSHOT_KEYS, KNOWN_EXCLUDED);
    expect(sortedArray(missing)).toEqual(EXPECTED_20);
  });

  // Verify each nested gap key individually (they are easy to get wrong)
  it.each([
    'sandbox.credentials.files',
    'sandbox.credentials.envVars',
    'attribution.sessionUrl',
  ])('nested gap "%s" is in the missing list', (key) => {
    const docsKeys = parseSettingsDocs(settingsMd).keys;
    const { missing } = diffKeys(docsKeys, SNAPSHOT_KEYS, KNOWN_EXCLUDED);
    expect(missing).toContain(key);
  });
});

// ─── B. Managed-marker precision tests ───────────────────────────────────────

describe('settings-diff — managed marker precision', () => {
  it('footerLinksRegexes IS in the gap (not excluded by loose "managed settings only" text)', () => {
    // footerLinksRegexes description says "…and managed settings only."
    // in a scope-description context, not as a bracket marker — must NOT be excluded.
    const docsKeys = parseSettingsDocs(settingsMd).keys;
    const { missing } = diffKeys(docsKeys, SNAPSHOT_KEYS, KNOWN_EXCLUDED);
    expect(missing).toContain('footerLinksRegexes');
  });

  it('requiredMinimumVersion is NOT in the gap (excluded via KNOWN_EXCLUDED)', () => {
    // docs text: "Managed settings only. Minimum Claude Code version..."
    // This is plain text, not a bracket marker, so KNOWN_EXCLUDED must cover it.
    const docsKeys = parseSettingsDocs(settingsMd).keys;
    const { missing } = diffKeys(docsKeys, SNAPSHOT_KEYS, KNOWN_EXCLUDED);
    expect(missing).not.toContain('requiredMinimumVersion');
  });

  it('sandbox.bwrapPath is NOT in the gap (bracket managed marker: "(Managed settings only, Linux/WSL2)")', () => {
    // The Sandbox settings table has bwrapPath with "(Managed settings only, Linux/WSL2)"
    // bracket marker → parseSettingsDocs must exclude it → not a gap.
    const docsKeys = parseSettingsDocs(settingsMd).keys;
    const { missing } = diffKeys(docsKeys, SNAPSHOT_KEYS, KNOWN_EXCLUDED);
    expect(missing).not.toContain('sandbox.bwrapPath');
    expect(missing).not.toContain('bwrapPath');
  });
});

// ─── C. Corruption tests (漏算→紅) ────────────────────────────────────────────

describe('settings-diff — corruption detection (these prove the gate is sensitive)', () => {
  it('removing an existing repo key from snapshot makes missing grow by 1 and includes that key', () => {
    // Remove "attribution.pr" (present in current snapshot) → it should appear as new gap
    const corruptedSnapshot = new Set(SNAPSHOT_KEYS);
    corruptedSnapshot.delete('attribution.pr');

    const docsKeys = parseSettingsDocs(settingsMd).keys;
    const { missing } = diffKeys(docsKeys, corruptedSnapshot, KNOWN_EXCLUDED);

    // Now 21 gaps (20 genuine + 1 introduced)
    expect(missing.length).toBe(21);
    expect(missing).toContain('attribution.pr');
  });

  it('removing a different existing repo key makes the count 21 and includes that key', () => {
    // Use a clearly non-gap key: "model" (in repo, not in EXPECTED_20)
    const corruptedSnapshot = new Set(SNAPSHOT_KEYS);
    corruptedSnapshot.delete('model');

    const docsKeys = parseSettingsDocs(settingsMd).keys;
    const { missing } = diffKeys(docsKeys, corruptedSnapshot, KNOWN_EXCLUDED);

    expect(missing.length).toBe(21);
    expect(missing).toContain('model');
  });

  it('parseSettingsDocs with a line removed no longer detects the key on that line', () => {
    // Remove the "advisorModel" row from the docs fixture
    const corruptedMd = settingsMd
      .split('\n')
      .filter((line) => !line.includes('`advisorModel`'))
      .join('\n');

    const docsKeys = parseSettingsDocs(corruptedMd).keys;
    // advisorModel should no longer be parsed → will NOT appear in missing
    expect(docsKeys.has('advisorModel')).toBe(false);

    const { missing } = diffKeys(docsKeys, SNAPSHOT_KEYS, KNOWN_EXCLUDED);
    // Now only 19 gaps (advisorModel no longer detected)
    expect(missing).not.toContain('advisorModel');
    expect(missing.length).toBe(19);
  });
});

// ─── D. parseSettingsDocs: section → prefix mapping ──────────────────────────

describe('parseSettingsDocs — section/prefix mapping', () => {
  it('returns a Set<string> via .keys property', () => {
    const result = parseSettingsDocs(settingsMd);
    expect(result.keys).toBeInstanceOf(Set);
    expect(result.keys.size).toBeGreaterThan(80);
  });

  it('top-level keys from "Available settings" have no prefix', () => {
    const { keys } = parseSettingsDocs(settingsMd);
    expect(keys.has('model')).toBe(true);
    expect(keys.has('language')).toBe(true);
    expect(keys.has('effortLevel')).toBe(true);
  });

  it('"Worktree settings" keys appear as worktree.x (docs already prefixed)', () => {
    const { keys } = parseSettingsDocs(settingsMd);
    expect(keys.has('worktree.baseRef')).toBe(true);
    expect(keys.has('worktree.sparsePaths')).toBe(true);
  });

  it('"Permission settings" keys get permissions. prefix except skipDangerousModePermissionPrompt', () => {
    const { keys } = parseSettingsDocs(settingsMd);
    expect(keys.has('permissions.defaultMode')).toBe(true);
    expect(keys.has('permissions.additionalDirectories')).toBe(true);
    // Exception: stays top-level
    expect(keys.has('skipDangerousModePermissionPrompt')).toBe(true);
    expect(keys.has('permissions.skipDangerousModePermissionPrompt')).toBe(false);
  });

  it('"Sandbox settings" keys get sandbox. prefix', () => {
    const { keys } = parseSettingsDocs(settingsMd);
    expect(keys.has('sandbox.enabled')).toBe(true);
    expect(keys.has('sandbox.credentials.files')).toBe(true);
    expect(keys.has('sandbox.credentials.envVars')).toBe(true);
  });

  it('"Attribution settings" keys get attribution. prefix', () => {
    const { keys } = parseSettingsDocs(settingsMd);
    expect(keys.has('attribution.sessionUrl')).toBe(true);
  });

  it('bracket managed-only keys are excluded', () => {
    // "(Managed settings only)" bracket form
    const { keys } = parseSettingsDocs(settingsMd);
    expect(keys.has('allowAllClaudeAiMcps')).toBe(false);
    expect(keys.has('permissions.allowAllClaudeAiMcps')).toBe(false);
  });

  it('sandbox path prefix rows (like "./") are not parsed as keys', () => {
    const { keys } = parseSettingsDocs(settingsMd);
    expect(keys.has('sandbox./')).toBe(false);
    expect(keys.has('sandbox../')).toBe(false);
    expect(keys.has('sandbox.~/')).toBe(false);
  });

  it('"Global config settings" keys have no prefix (stored in ~/.claude.json, not settings.json)', () => {
    const { keys } = parseSettingsDocs(settingsMd);
    expect(keys.has('autoConnectIde')).toBe(true);
    expect(keys.has('autoInstallIdeExtension')).toBe(true);
    expect(keys.has('externalEditorContext')).toBe(true);
    expect(keys.has('teammateDefaultModel')).toBe(true);
  });

  it('extracts a non-empty description for a known key', () => {
    const { descriptions } = parseSettingsDocs(settingsMd);
    expect(descriptions.get('model')).toBeTruthy();
    expect(descriptions.get('sandbox.enabled')).toBeTruthy();
  });

  it('returns empty string (never throws) for a row with no description cell', () => {
    const { keys, descriptions } = parseSettingsDocs('### Available settings\n\n| `fooBar` |\n');
    expect(keys.has('fooBar')).toBe(true);
    expect(descriptions.get('fooBar')).toBe('');
  });
});

// ─── D2. settings-reference.md All settings index ────────────────────────────

describe('parseSettingsDocs — settings-reference.md All settings index', () => {
  it('parses linked top-level and dotted keys with their descriptions', () => {
    const { keys, descriptions, topics, scopes } = parseSettingsDocs(settingsReferenceMd);

    expect(keys).toEqual(new Set([
      'advisorModel',
      'model',
      'permissions.allow',
      'sandbox.enabled',
      'sandbox.credentials.files',
      'attribution.commit',
      'managedByScope',
    ]));
    expect(descriptions.get('advisorModel')).toBe('Pick the model used by the advisor');
    expect(descriptions.get('sandbox.credentials.files')).toBe('Block reads of credential files with an escaped \\| pipe');
    expect(topics.get('advisorModel')).toBe('Model and responses');
    expect(scopes.get('advisorModel')).toBe('Any file');
    expect(scopes.get('managedByScope')).toBe('Managed');
  });

  it('excludes managed-marker rows and links that are not same-page setting anchors', () => {
    const { keys } = parseSettingsDocs(settingsReferenceMd);

    expect(keys.has('managedOnly')).toBe(false);
    expect(keys.has('externalLink')).toBe(false);
    expect(keys.has('not-a-setting')).toBe(false);
  });

  it('stops inventory at the next level-two heading and ignores detailed tables', () => {
    const { keys } = parseSettingsDocs(settingsReferenceMd);

    expect(keys.has('detailTableKey')).toBe(false);
  });

  it('locates the index by its header row, not the heading text, skipping a component block before the table', () => {
    const liveShape = settingsReferenceMd.replace(
      '## All settings\n',
      '## Settings index\n\nEvery key below links to its entry.\n\n<ReferenceFilter\n  noun="settings"\n  columnHelp={{\ntopic: "The section of this page that holds the entry.",\n}}\n/>\n',
    );
    const { keys, scopes } = parseSettingsDocs(liveShape, 'reference');

    expect(keys).toEqual(parseSettingsDocs(settingsReferenceMd).keys);
    expect(scopes.get('managedByScope')).toBe('Managed');
  });

  it('returns no keys when the index table is missing', () => {
    const missingTable = '## Settings index\n\nSettings are listed elsewhere.\n\n## Model and responses\n';
    const { keys } = parseSettingsDocs(missingTable);

    expect(keys).toEqual(new Set());
    expect(checkSettingsDocsHealth(keys).ok).toBe(false);
  });
});

// ─── E. KNOWN_EXCLUDED contents ──────────────────────────────────────────────

describe('KNOWN_EXCLUDED constant', () => {
  it('is a Set (or Set-like with .has method)', () => {
    expect(typeof KNOWN_EXCLUDED.has).toBe('function');
  });

  it.each([
    'policyHelper',
    'ultracode',
    'autoDreamEnabled',
    'skipWorkflowUsageWarning',
    'skipAutoPermissionPrompt',
    'requiredMinimumVersion',
    'requiredMaximumVersion',
    'enforceAvailableModels',
    'allowAllClaudeAiMcps',
    'allowedChannelPlugins',
    'sandbox.filesystem.allowManagedReadPathsOnly',
    'enabledPlugins',
    'includeCoAuthoredBy',
    // #27：docs 標為 Deprecated／Removed in 的 5 個設定，UI 已移除，不再是首方設定頁面。
    'keybindingFlavor',
    'voiceEnabled',
    'disableArtifact',
    'permissionExplainerEnabled',
    'teammateDefaultModel',
  ])('contains "%s"', (key) => {
    expect(KNOWN_EXCLUDED.has(key)).toBe(true);
  });
});

// ─── F. parseEnvDocs ─────────────────────────────────────────────────────────

describe('parseEnvDocs', () => {
  it('parses env-vars.md and returns a Set with ~277 entries', () => {
    const { keys } = parseEnvDocs(envVarsMd);
    expect(keys).toBeInstanceOf(Set);
    // Verified count from fixture is ~277; allow some flex for docs changes
    expect(keys.size).toBeGreaterThanOrEqual(250);
    expect(keys.size).toBeLessThan(400);
  });

  it('contains ANTHROPIC_API_KEY', () => {
    const { keys } = parseEnvDocs(envVarsMd);
    expect(keys.has('ANTHROPIC_API_KEY')).toBe(true);
  });

  it('contains only uppercase env-var-like strings (A-Z, 0-9, underscore)', () => {
    const { keys } = parseEnvDocs(envVarsMd);
    for (const key of keys) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('extracts a non-empty description for ANTHROPIC_API_KEY', () => {
    const { descriptions } = parseEnvDocs(envVarsMd);
    expect(descriptions.get('ANTHROPIC_API_KEY')).toBeTruthy();
  });

  it('returns empty string (never throws) for a var with no description cell', () => {
    const { keys, descriptions } = parseEnvDocs('| `FOO_BAR` |\n');
    expect(keys.has('FOO_BAR')).toBe(true);
    expect(descriptions.get('FOO_BAR')).toBe('');
  });
});

// ─── G. checkEnvDocsHealth ───────────────────────────────────────────────────

describe('checkEnvDocsHealth', () => {
  it('returns { ok: true } for the real env-vars.md fixture (sufficient keys)', () => {
    const keys = parseEnvDocs(envVarsMd);
    const result = checkEnvDocsHealth(keys);
    expect(result.ok).toBe(true);
  });

  it('returns { ok: false } for an empty set', () => {
    const result = checkEnvDocsHealth(new Set());
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('returns { ok: false } for a suspiciously small set (< 50 keys)', () => {
    const tinySet = new Set(['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']);
    const result = checkEnvDocsHealth(tinySet);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('returns { ok: false } for content that produces zero env keys (empty string)', () => {
    const { keys } = parseEnvDocs('');
    const result = checkEnvDocsHealth(keys);
    expect(result.ok).toBe(false);
  });
});

// ─── H. collectRepoSettingKeys ────────────────────────────────────────────────

describe('collectRepoSettingKeys', () => {
  it('returns a Set', () => {
    const result = collectRepoSettingKeys({});
    expect(result).toBeInstanceOf(Set);
  });

  it('includes bare key AND nestedUnder.key for a field with nestedUnder', () => {
    // Simulate a minimal flat schema with one nestedUnder field
    const fakeSchema = {
      disableAutoMode: {
        nestedUnder: 'permissions',
        valueSchema: { kind: 'string' as const },
        controlType: String,
        default: undefined,
        section: 'permissions' as const,
      },
    };
    const result = collectRepoSettingKeys(fakeSchema);
    // Must include both forms so docs "disableAutoMode" matches
    expect(result.has('disableAutoMode')).toBe(true);
    expect(result.has('permissions.disableAutoMode')).toBe(true);
  });

  it('recurses into object valueSchema properties', () => {
    const fakeSchema = {
      attribution: {
        nestedUnder: undefined,
        valueSchema: {
          kind: 'object' as const,
          properties: {
            commit: { schema: { kind: 'string' as const }, optional: true },
            pr: { schema: { kind: 'string' as const }, optional: true },
          },
        },
        controlType: Object,
        default: undefined,
        section: 'advanced' as const,
      },
    };
    const result = collectRepoSettingKeys(fakeSchema);
    expect(result.has('attribution')).toBe(true);
    expect(result.has('attribution.commit')).toBe(true);
    expect(result.has('attribution.pr')).toBe(true);
  });

  it('does NOT include attribution.sessionUrl (not in current schema → gap)', () => {
    // Live schema does not have sessionUrl → snapshot also lacks it → gap
    // This verifies the snapshot was produced correctly.
    expect(SNAPSHOT_KEYS.has('attribution.sessionUrl')).toBe(false);
  });

  it('does NOT include sandbox.credentials (not in current schema → gap)', () => {
    expect(SNAPSHOT_KEYS.has('sandbox.credentials.files')).toBe(false);
    expect(SNAPSHOT_KEYS.has('sandbox.credentials.envVars')).toBe(false);
  });
});

// ─── H2. collectRepoFlatFieldKeys ─────────────────────────────────────────────
//
// Flat-field-grain repo key set (bare + nestedUnder-prefixed, non-object
// fields only — object-kind fields are dropped entirely, not recursed). This
// is the set the `removed` diff direction compares against: docs never
// documents a nested object's *container* path on its own, and whether a
// top-level object field additionally gets an "Available settings" overview
// row is inconsistent across docs — not a reliable per-field signal — so the
// whole kind is excluded structurally rather than case-by-case.

describe('collectRepoFlatFieldKeys', () => {
  const fakeSchemaWithNested = {
    disableAutoMode: {
      nestedUnder: 'permissions',
      valueSchema: { kind: 'string' as const },
      controlType: String,
      default: undefined,
      section: 'permissions' as const,
    },
    sandbox: {
      nestedUnder: undefined,
      valueSchema: {
        kind: 'object' as const,
        properties: {
          enabled: { schema: { kind: 'boolean' as const }, optional: true },
          filesystem: {
            schema: {
              kind: 'object' as const,
              properties: {
                allowWrite: { schema: { kind: 'array' as const, item: { kind: 'string' as const } }, optional: true },
              },
            },
            optional: true,
          },
        },
      },
      controlType: Object,
      default: undefined,
      section: 'advanced' as const,
    },
  };

  it('returns a Set', () => {
    expect(collectRepoFlatFieldKeys({})).toBeInstanceOf(Set);
  });

  it('includes bare key AND nestedUnder.key for a non-object nestedUnder field', () => {
    const result = collectRepoFlatFieldKeys(fakeSchemaWithNested);
    expect(result.has('disableAutoMode')).toBe(true);
    expect(result.has('permissions.disableAutoMode')).toBe(true);
  });

  it('excludes an object-kind field entirely — no bare key, no recursion into its properties', () => {
    const result = collectRepoFlatFieldKeys(fakeSchemaWithNested);
    expect(result.has('sandbox')).toBe(false);
    expect(result.has('sandbox.enabled')).toBe(false);
    expect(result.has('sandbox.filesystem')).toBe(false);
    expect(result.has('sandbox.filesystem.allowWrite')).toBe(false);
  });
});

// ─── H3. diffKeys — removed direction (repo-has/docs-lacks) ──────────────────
//
// The `removed` direction must run at flat-field grain: comparing the fully
// expanded repoKeys set (collectRepoSettingKeys) against docsKeys produces
// spurious hits for every nested object container (docs documents leaf paths
// like `sandbox.filesystem.allowWrite`, never the intermediate container path
// `sandbox.filesystem`, and inconsistently documents the top-level container
// itself). This section proves the flat-field-grain set avoids that
// structurally, and that a genuine reverse-direction gap (docs dropped a key
// repo still has) is still caught.

describe('diffKeys — removed direction', () => {
  it('flags a repo-only leaf key that docs no longer documents', () => {
    const docsKeys = new Set(['model', 'permissions.allow']);
    const repoFlatFieldKeys = new Set(['model', 'permissions.allow', 'legacyRenamedKey']);
    const { removed } = diffKeys(docsKeys, new Set(), KNOWN_EXCLUDED, repoFlatFieldKeys);
    expect(removed).toEqual(['legacyRenamedKey']);
  });

  it('does NOT flag a nested object container merely because docs never lists the container path itself', () => {
    // Simulates the real `sandbox` case: docs documents `sandbox.filesystem.allowWrite`
    // (a deep leaf) but never `sandbox` or `sandbox.filesystem` as their own row.
    const docsKeys = new Set(['sandbox.filesystem.allowWrite']);
    const fakeSchema = {
      sandbox: {
        nestedUnder: undefined,
        valueSchema: { kind: 'object' as const, properties: {} },
        controlType: Object,
        default: undefined,
        section: 'advanced' as const,
      },
    };
    // collectRepoFlatFieldKeys drops object-kind fields entirely — 'sandbox'
    // never reaches the comparison, so it can never be a false positive here
    // (no KNOWN_REPO_ONLY entry needed, unlike the nestedUnder dual-form case).
    const repoFlatFieldKeys = collectRepoFlatFieldKeys(fakeSchema);
    expect(repoFlatFieldKeys.has('sandbox')).toBe(false);
    const { removed } = diffKeys(docsKeys, new Set(), KNOWN_EXCLUDED, repoFlatFieldKeys, KNOWN_REPO_ONLY);
    expect(removed).toEqual([]);
  });

  it('defaults removed to [] when repoFlatFieldKeys is omitted (missing-only callers are unaffected)', () => {
    const docsKeys = new Set(['model']);
    const repoKeys = new Set(['model']);
    const { removed } = diffKeys(docsKeys, repoKeys, KNOWN_EXCLUDED);
    expect(removed).toEqual([]);
  });

  it('applies knownRepoOnly exclusions to the removed set', () => {
    const docsKeys = new Set<string>();
    const repoFlatFieldKeys = new Set(['excludedKey', 'realRemovedKey']);
    const { removed } = diffKeys(docsKeys, new Set(), KNOWN_EXCLUDED, repoFlatFieldKeys, new Set(['excludedKey']));
    expect(removed).toEqual(['realRemovedKey']);
  });
});

// ─── H4. KNOWN_REPO_ONLY constant ─────────────────────────────────────────────

describe('KNOWN_REPO_ONLY constant', () => {
  it('is a Set (or Set-like with .has method)', () => {
    expect(typeof KNOWN_REPO_ONLY.has).toBe('function');
  });

  it.each([
    'defaultMode',
    'disableBypassPermissionsMode',
    'permissions.disableAutoMode',
  ])('contains "%s"', (key) => {
    expect(KNOWN_REPO_ONLY.has(key)).toBe(true);
  });

  it('does NOT need object-kind container entries (sandbox/worktree/subagentStatusLine) — collectRepoFlatFieldKeys excludes them structurally', () => {
    expect(KNOWN_REPO_ONLY.has('sandbox')).toBe(false);
    expect(KNOWN_REPO_ONLY.has('worktree')).toBe(false);
    expect(KNOWN_REPO_ONLY.has('subagentStatusLine')).toBe(false);
  });
});

// ─── H5. diffEnvVars ──────────────────────────────────────────────────────────

describe('diffEnvVars', () => {
  it('envGaps: docs has, registry lacks', () => {
    const docsEnvKeys = new Set(['ANTHROPIC_API_KEY', 'NEW_DOCS_ONLY_VAR']);
    const registryEnvNames = new Set(['ANTHROPIC_API_KEY']);
    const { envGaps } = diffEnvVars(docsEnvKeys, registryEnvNames);
    expect(envGaps).toEqual(['NEW_DOCS_ONLY_VAR']);
  });

  it('envRemoved: registry has, docs lacks', () => {
    const docsEnvKeys = new Set(['ANTHROPIC_API_KEY']);
    const registryEnvNames = new Set(['ANTHROPIC_API_KEY', 'STALE_REGISTRY_ONLY_VAR']);
    const { envRemoved } = diffEnvVars(docsEnvKeys, registryEnvNames);
    expect(envRemoved).toEqual(['STALE_REGISTRY_ONLY_VAR']);
  });

  it('returns empty arrays when docs and registry match exactly', () => {
    const both = new Set(['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']);
    const { envGaps, envRemoved } = diffEnvVars(both, both);
    expect(envGaps).toEqual([]);
    expect(envRemoved).toEqual([]);
  });

  it('sorts both output arrays', () => {
    const docsEnvKeys = new Set(['Z_VAR', 'A_VAR']);
    const { envGaps } = diffEnvVars(docsEnvKeys, new Set());
    expect(envGaps).toEqual(['A_VAR', 'Z_VAR']);
  });
});

// ─── I. checkSettingsDocsHealth ────────────────────────────────────────────────
//
// Contract for executor:
//
// checkSettingsDocsHealth(settingsKeys: Set<string>): { ok: boolean; reason?: string }
//
// Returns { ok: false, reason: <non-empty string> } when:
//   1. settingsKeys is empty (size === 0), OR
//   2. settingsKeys is suspiciously small (threshold: < 20 keys — floor comparable
//      to env's spirit: a real parse produces 90+ keys), OR
//   3. Any sentinel key is absent:
//        - 'model'              (in "Available settings")
//        - 'permissions.allow'  (in "Permission settings")
//        - 'env'                (in "Available settings")
//        - 'sandbox.enabled'    (in "Sandbox settings")
//        - 'attribution.commit' (in "Attribution settings")
// Returns { ok: true } when settingsKeys has enough keys AND all sentinels present.
//
// Rationale: if the official settings.md renames "### Available settings" or
// "### Permission settings", parseSettingsDocs silently drops all those keys
// → settingsKeys shrinks drastically AND sentinels vanish → ok:false → fail-fast.

describe('checkSettingsDocsHealth', () => {
  it('real settings.md fixture → ok:true', () => {
    const { keys } = parseSettingsDocs(settingsMd);
    const result = checkSettingsDocsHealth(keys);
    expect(result.ok).toBe(true);
  });

  it('empty set → ok:false with reason', () => {
    const result = checkSettingsDocsHealth(new Set());
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('suspiciously small set (< 20 keys) → ok:false with reason', () => {
    const tinySet = new Set(['model', 'language', 'effortLevel']);
    const result = checkSettingsDocsHealth(tinySet);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('"Available settings" section renamed → sentinel "model" missing → ok:false', () => {
    // Rename "### Available settings" so parseSettingsDocs no longer recognises
    // the section → all top-level keys (including sentinel 'model') are excluded.
    const corruptedMd = settingsMd.replace(
      '### Available settings',
      '### Settings list (renamed)',
    );
    const { keys } = parseSettingsDocs(corruptedMd);
    // Confirm the sentinel is indeed gone (proves the rename took effect)
    expect(keys.has('model')).toBe(false);
    const result = checkSettingsDocsHealth(keys);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('"Permission settings" section renamed → sentinel "permissions.allow" missing → ok:false', () => {
    // Rename "### Permission settings" so that section's keys (including
    // permissions.allow) are excluded by parseSettingsDocs.
    const corruptedMd = settingsMd.replace(
      '### Permission settings',
      '### Permissions (renamed)',
    );
    const { keys } = parseSettingsDocs(corruptedMd);
    expect(keys.has('permissions.allow')).toBe(false);
    const result = checkSettingsDocsHealth(keys);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('"Sandbox settings" section renamed → sentinel "sandbox.enabled" missing → ok:false', () => {
    // Rename "### Sandbox settings" so that section's keys (including
    // sandbox.enabled) are excluded by parseSettingsDocs. Total key count
    // stays well above the 20-key floor, so only the sentinel check catches this.
    const corruptedMd = settingsMd.replace(
      '### Sandbox settings',
      '### Sandboxing (renamed)',
    );
    const { keys } = parseSettingsDocs(corruptedMd);
    expect(keys.has('sandbox.enabled')).toBe(false);
    const result = checkSettingsDocsHealth(keys);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('"Attribution settings" section renamed → sentinel "attribution.commit" missing → ok:false', () => {
    // Rename "### Attribution settings" so that section's keys (including
    // attribution.commit) are excluded by parseSettingsDocs. Total key count
    // stays well above the 20-key floor, so only the sentinel check catches this.
    const corruptedMd = settingsMd.replace(
      '### Attribution settings',
      '### Attribution (renamed)',
    );
    const { keys } = parseSettingsDocs(corruptedMd);
    expect(keys.has('attribution.commit')).toBe(false);
    const result = checkSettingsDocsHealth(keys);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('empty string docs → ok:false', () => {
    const { keys } = parseSettingsDocs('');
    const result = checkSettingsDocsHealth(keys);
    expect(result.ok).toBe(false);
  });
});

// ─── J. KNOWN_ENV_REPO_ONLY 白名單 + diffEnvVars 過濾（批次 R，先紅） ──────────
//
// 背景：有 10 個 env var 是 repo registry 有、官方 env-vars.md 不列（記在
// settings.md 或別處）的已知常態，diffEnvVars 的 envRemoved 每次都會誤報它們。
//
// 契約（給執行者）：
//   export const KNOWN_ENV_REPO_ONLY: ReadonlySet<string>
//   diffEnvVars 內部**預設就套用** KNOWN_ENV_REPO_ONLY 過濾 envRemoved，
//   簽名維持 (docsEnvKeys, registryEnvNames) 兩參數 — 不要仿 diffKeys 改成
//   由呼叫端傳入第三參數，否則下面的兩參數呼叫永遠過不了。
//
// 紅因設計：KNOWN_ENV_REPO_ONLY 用 namespace import 取值，避免 named import
// 在 export 尚未存在時整檔 link error（那會讓紅因變成模組錯誤而非斷言失敗）。

import * as settingsDiffModule from '../settings-diff';

const diffMod = settingsDiffModule as unknown as { KNOWN_ENV_REPO_ONLY?: ReadonlySet<string> };

const ENV_REPO_ONLY_VARS = [
  'CLAUDE_PROJECT_DIR',
  'DISABLE_BUG_COMMAND',
  'NODE_EXTRA_CA_CERTS',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_HEADERS',
  'OTEL_EXPORTER_OTLP_PROTOCOL',
  'OTEL_LOGS_EXPORTER',
  'OTEL_LOGS_EXPORT_INTERVAL',
  'OTEL_METRICS_EXPORTER',
  'OTEL_METRIC_EXPORT_INTERVAL',
];

describe('KNOWN_ENV_REPO_ONLY constant', () => {
  it('is exported as a Set-like with .has', () => {
    expect(typeof diffMod.KNOWN_ENV_REPO_ONLY?.has).toBe('function');
  });

  it.each(ENV_REPO_ONLY_VARS)('contains "%s"', (name) => {
    expect(diffMod.KNOWN_ENV_REPO_ONLY?.has(name)).toBe(true);
  });

  it('contains exactly the 10 documented repo-only env vars', () => {
    expect([...(diffMod.KNOWN_ENV_REPO_ONLY ?? [])].sort()).toEqual([...ENV_REPO_ONLY_VARS].sort());
  });
});

describe('diffEnvVars — KNOWN_ENV_REPO_ONLY 過濾 envRemoved', () => {
  it.each(ENV_REPO_ONLY_VARS)('registry 有 "%s"、docs 沒有 → 不進 envRemoved', (name) => {
    const docsEnvKeys = new Set(['ANTHROPIC_API_KEY']);
    const registryEnvNames = new Set(['ANTHROPIC_API_KEY', name]);
    const { envRemoved } = diffEnvVars(docsEnvKeys, registryEnvNames);
    expect(envRemoved).not.toContain(name);
  });

  it('白名單全部在 registry、docs 皆缺 → envRemoved 為空', () => {
    const docsEnvKeys = new Set(['ANTHROPIC_API_KEY']);
    const registryEnvNames = new Set(['ANTHROPIC_API_KEY', ...ENV_REPO_ONLY_VARS]);
    const { envRemoved } = diffEnvVars(docsEnvKeys, registryEnvNames);
    expect(envRemoved).toEqual([]);
  });

  it('白名單不影響真正的 stale var（仍被回報）', () => {
    const docsEnvKeys = new Set(['ANTHROPIC_API_KEY']);
    const registryEnvNames = new Set(['ANTHROPIC_API_KEY', 'CLAUDE_PROJECT_DIR', 'STALE_REGISTRY_ONLY_VAR']);
    const { envRemoved } = diffEnvVars(docsEnvKeys, registryEnvNames);
    expect(envRemoved).toEqual(['STALE_REGISTRY_ONLY_VAR']);
  });

  it('白名單不影響 envGaps 方向（docs 有、registry 缺 → 照樣回報）', () => {
    const docsEnvKeys = new Set(['CLAUDE_PROJECT_DIR']);
    const registryEnvNames = new Set<string>();
    const { envGaps } = diffEnvVars(docsEnvKeys, registryEnvNames);
    expect(envGaps).toEqual(['CLAUDE_PROJECT_DIR']);
  });
});
