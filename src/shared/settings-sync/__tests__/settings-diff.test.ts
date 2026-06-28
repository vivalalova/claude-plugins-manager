/**
 * Core gate: fixture-driven diff logic tests.
 *
 * This file imports a module that does NOT yet exist:
 *   ../settings-diff
 *
 * All tests in this file are intentionally RED until the executor implements
 * that module. The module-not-found import error is the expected red state.
 *
 * ─── Why a frozen snapshot ────────────────────────────────────────────────
 * We use fixtures/repo-keys.snapshot.json (frozen at current schema state)
 * rather than live-importing the schema. This lets the logic tests remain
 * stable across the NEXT round, when those 21 missing keys get added to the
 * schema. Adding them to the schema must NOT make these tests break — they
 * test parseSettingsDocs + diffKeys logic, not "current schema state".
 * "Current schema state" is checked by the end-to-end CLI invocation.
 *
 * ─── Assumed module contract (executor: implement exactly these signatures) ─
 *
 * parseSettingsDocs(md: string): { keys: Set<string> }
 *   Parse settings.md → Set of effective JSON keys (with section→prefix
 *   applied and bracket managed-only keys excluded).
 *   Section→prefix rules:
 *     "Available settings"    → ''           (top-level)
 *     "Worktree settings"     → ''           (keys written as worktree.x)
 *     "Permission settings"   → 'permissions.' (except skipDangerousModePermissionPrompt → top-level)
 *     "Sandbox settings"      → 'sandbox.'
 *     "Attribution settings"  → 'attribution.'
 *     All other sections      → excluded
 *   Managed-only marker: /\([^)]*[Mm]anaged settings only[^)]*\)/ (bracket form only).
 *   "…and managed settings only." in descriptive text is NOT a marker.
 *   Any level of heading (##, ###, ####, …) triggers section boundary.
 *
 * parseEnvDocs(md: string): Set<string>
 *   Parse env-vars.md → Set of env var names.
 *   Source: table rows matching /^\|\s*`([A-Z][A-Z0-9_]*)`/.
 *
 * collectRepoSettingKeys(
 *   flatSchemas: Record<string, FlatFieldSchema>,
 *   objectValueSchemas: Record<string, ObjectValueSchema>   // unused in current impl
 * ): Set<string>
 *   Build repo key set. For each flat schema entry:
 *     - Include the bare schema key (e.g. 'disableAutoMode')
 *     - If nestedUnder, also include 'nestedUnder.key' (e.g. 'permissions.disableAutoMode')
 *     - Recurse into object-kind valueSchema.properties, adding 'prefix.prop' keys
 *   Note: "bare key" is REQUIRED so docs "Available settings" entries like
 *   "disableAutoMode" match the repo's permissions.disableAutoMode schema field.
 *
 * diffKeys(
 *   docsKeys: Set<string>,
 *   repoKeys: Set<string>,
 *   knownExcluded: Set<string>
 * ): { missing: string[] }
 *   Return sorted array of keys in docsKeys that are in neither repoKeys nor knownExcluded.
 *
 * KNOWN_EXCLUDED: ReadonlySet<string>
 *   The single authoritative exclusion list. Must contain at least:
 *     'policyHelper'             - "Only honored from MDM" (no bracket marker)
 *     'ultracode'                - session-only, not read from settings.json
 *     'autoDreamEnabled'         - undocumented
 *     'skipWorkflowUsageWarning' - undocumented
 *     'skipAutoPermissionPrompt' - undocumented
 *     'requiredMinimumVersion'   - "Managed settings only." (text, not bracket)
 *     'requiredMaximumVersion'   - "Managed settings only." (text, not bracket)
 *     'enforceAvailableModels'   - effectively managed-only
 *
 * checkEnvDocsHealth(envKeys: Set<string>): { ok: boolean; reason?: string }
 *   Returns { ok: false, reason: '...' } when the set is empty or suspiciously
 *   small (threshold: < 50 keys). Returns { ok: true } otherwise.
 *   Callers should throw or exit-nonzero on !ok.
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
  diffKeys,
  KNOWN_EXCLUDED,
  checkEnvDocsHealth,
  checkSettingsDocsHealth,
} from '../settings-diff';

// ─── Fixture paths ────────────────────────────────────────────────────────────

const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const settingsMd = readFileSync(resolve(FIXTURES_DIR, 'settings.md'), 'utf8');
const envVarsMd = readFileSync(resolve(FIXTURES_DIR, 'env-vars.md'), 'utf8');
const snapshotRaw = JSON.parse(readFileSync(resolve(FIXTURES_DIR, 'repo-keys.snapshot.json'), 'utf8')) as { keys: string[] };
const SNAPSHOT_KEYS: Set<string> = new Set(snapshotRaw.keys);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sortedArray(s: string[]): string[] {
  return [...s].sort();
}

// ─── A. Core gate: exactly the 21 expected gaps ───────────────────────────────

const EXPECTED_21 = [
  // Top-level (18)
  'advisorModel',
  'agentPushNotifEnabled',
  'autoCompactEnabled',
  'axScreenReader',
  'disableArtifact',
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

describe('settings-diff — core gate: 21 gap', () => {
  it('diffKeys with frozen snapshot produces exactly the 21 expected gaps', () => {
    const docsKeys = parseSettingsDocs(settingsMd).keys;
    const { missing } = diffKeys(docsKeys, SNAPSHOT_KEYS, KNOWN_EXCLUDED);
    expect(sortedArray(missing)).toEqual(EXPECTED_21);
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

    // Now 22 gaps (21 genuine + 1 introduced)
    expect(missing.length).toBe(22);
    expect(missing).toContain('attribution.pr');
  });

  it('removing a different existing repo key makes the count 22 and includes that key', () => {
    // Use a clearly non-gap key: "model" (in repo, not in EXPECTED_21)
    const corruptedSnapshot = new Set(SNAPSHOT_KEYS);
    corruptedSnapshot.delete('model');

    const docsKeys = parseSettingsDocs(settingsMd).keys;
    const { missing } = diffKeys(docsKeys, corruptedSnapshot, KNOWN_EXCLUDED);

    expect(missing.length).toBe(22);
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
    // Now only 20 gaps (advisorModel no longer detected)
    expect(missing).not.toContain('advisorModel');
    expect(missing.length).toBe(20);
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
  ])('contains "%s"', (key) => {
    expect(KNOWN_EXCLUDED.has(key)).toBe(true);
  });
});

// ─── F. parseEnvDocs ─────────────────────────────────────────────────────────

describe('parseEnvDocs', () => {
  it('parses env-vars.md and returns a Set with ~277 entries', () => {
    const keys = parseEnvDocs(envVarsMd);
    expect(keys).toBeInstanceOf(Set);
    // Verified count from fixture is ~277; allow some flex for docs changes
    expect(keys.size).toBeGreaterThanOrEqual(250);
    expect(keys.size).toBeLessThan(400);
  });

  it('contains ANTHROPIC_API_KEY', () => {
    const keys = parseEnvDocs(envVarsMd);
    expect(keys.has('ANTHROPIC_API_KEY')).toBe(true);
  });

  it('contains only uppercase env-var-like strings (A-Z, 0-9, underscore)', () => {
    const keys = parseEnvDocs(envVarsMd);
    for (const key of keys) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
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
    const keys = parseEnvDocs('');
    const result = checkEnvDocsHealth(keys);
    expect(result.ok).toBe(false);
  });
});

// ─── H. collectRepoSettingKeys ────────────────────────────────────────────────

describe('collectRepoSettingKeys', () => {
  it('returns a Set', () => {
    const result = collectRepoSettingKeys({}, {});
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
    const result = collectRepoSettingKeys(fakeSchema, {});
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
    const result = collectRepoSettingKeys(fakeSchema, {});
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
//        - 'model'            (in "Available settings")
//        - 'permissions.allow' (in "Permission settings")
//        - 'env'              (in "Available settings")
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

  it('empty string docs → ok:false', () => {
    const { keys } = parseSettingsDocs('');
    const result = checkSettingsDocsHealth(keys);
    expect(result.ok).toBe(false);
  });
});
