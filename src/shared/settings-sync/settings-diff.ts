/**
 * Deterministic settings gap detection.
 * Pure functions; no I/O, no side-effects.
 */

import type { FlatFieldSchema, ObjectValueSchema } from '../claude-settings-schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CollectableObjectValueSchema = ObjectValueSchema;

// ─── Section → prefix map ─────────────────────────────────────────────────────

/**
 * Available settings → '' (top-level)
 * Worktree settings  → '' (rows already read as worktree.x)
 * Permission settings → 'permissions.' (except skipDangerousModePermissionPrompt → '')
 * Sandbox settings   → 'sandbox.'
 * Attribution settings → 'attribution.'
 * All other headings → excluded (null)
 */
const SECTION_PREFIX: Record<string, string | null> = {
  'available settings': '',
  'worktree settings': '',
  'permission settings': 'permissions.',
  'sandbox settings': 'sandbox.',
  'attribution settings': 'attribution.',
};

/** Keys in the Permission section that stay top-level (no prefix). */
const PERMISSION_SECTION_TOP_LEVEL = new Set(['skipDangerousModePermissionPrompt']);

/** Regex matching a valid JSON key in the first table cell: `| \`key\` |` */
const KEY_ROW_RE = /^\|\s*`([^`]+)`/;

/** Regex matching the bracket managed-only marker. */
const MANAGED_BRACKET_RE = /\([^)]*[Mm]anaged settings only[^)]*\)/;

/** Regex matching any markdown heading (##, ###, ####, …). */
const HEADING_RE = /^#{2,}\s+(.+)$/;

/** Match env var rows: first column must be `UPPER_CASE`. */
const ENV_VAR_ROW_RE = /^\|\s*`([A-Z][A-Z0-9_]*)`/;

// ─── KNOWN_EXCLUDED ───────────────────────────────────────────────────────────

/**
 * Single authoritative exclusion list.
 * Keys here are unconditionally skipped in diffKeys, regardless of whether
 * they appear in docs or snapshot.
 */
export const KNOWN_EXCLUDED: ReadonlySet<string> = new Set([
  'policyHelper',             // "Only honored from MDM" — no bracket marker
  'ultracode',                // session-only, not read from settings.json
  'autoDreamEnabled',         // undocumented
  'skipWorkflowUsageWarning', // undocumented
  'skipAutoPermissionPrompt', // undocumented
  'requiredMinimumVersion',   // "Managed settings only." text (not bracket)
  'requiredMaximumVersion',   // "Managed settings only." text (not bracket)
  'enforceAvailableModels',   // effectively managed-only
]);

// ─── parseSettingsDocs ────────────────────────────────────────────────────────

/**
 * Parse settings.md → Set of effective JSON keys.
 * Section→prefix applied; bracket managed-only keys excluded.
 */
export function parseSettingsDocs(md: string): { keys: Set<string> } {
  const keys = new Set<string>();
  let currentPrefix: string | null = null; // null = excluded section

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trimEnd();

    // Detect any heading level (##, ###, ####, …)
    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      const sectionName = headingMatch[1].trim().toLowerCase();
      currentPrefix = SECTION_PREFIX[sectionName] ?? null;
      continue;
    }

    // Skip if current section is excluded
    if (currentPrefix === null) continue;

    // Try to parse a key from the first cell
    const keyMatch = KEY_ROW_RE.exec(line);
    if (!keyMatch) continue;

    const rawKey = keyMatch[1];

    // Skip keys that aren't valid identifier-like strings (e.g. path prefixes like "/", "~/", "./")
    // A valid settings key starts with a letter, optionally followed by letters/digits/dots/underscores.
    if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(rawKey)) continue;

    // Skip bracket managed-only keys
    if (MANAGED_BRACKET_RE.test(line)) continue;

    // Apply prefix — with exception for skipDangerousModePermissionPrompt in Permission section
    let effectiveKey: string;
    if (currentPrefix === 'permissions.' && PERMISSION_SECTION_TOP_LEVEL.has(rawKey)) {
      effectiveKey = rawKey;
    } else {
      effectiveKey = currentPrefix + rawKey;
    }

    keys.add(effectiveKey);
  }

  return { keys };
}

// ─── parseEnvDocs ─────────────────────────────────────────────────────────────

/**
 * Parse env-vars.md → Set of env var names.
 * Source: table rows matching /^\|\s*`([A-Z][A-Z0-9_]*)`.
 */
export function parseEnvDocs(md: string): Set<string> {
  const keys = new Set<string>();
  for (const line of md.split('\n')) {
    const m = ENV_VAR_ROW_RE.exec(line);
    if (m) keys.add(m[1]);
  }
  return keys;
}

// ─── collectRepoSettingKeys ───────────────────────────────────────────────────

/**
 * Build the repo key set from the flat schema.
 * For each entry:
 *   - Add bare key (e.g. 'disableAutoMode')
 *   - If nestedUnder, also add 'nestedUnder.key' (e.g. 'permissions.disableAutoMode')
 *   - If valueSchema.kind === 'object', recurse into properties adding 'bareKey.prop' keys
 */
export function collectRepoSettingKeys(
  flatSchemas: Record<string, FlatFieldSchema>,
   
  _objectValueSchemas: Record<string, CollectableObjectValueSchema>,
): Set<string> {
  const keys = new Set<string>();

  for (const [key, field] of Object.entries(flatSchemas)) {
    // Always include the bare key
    keys.add(key);

    // If nested, also include the prefixed form
    if (field.nestedUnder) {
      keys.add(`${field.nestedUnder}.${key}`);
    }

    // Recurse into object valueSchema properties
    if (field.valueSchema.kind === 'object') {
      addObjectProperties(keys, key, field.valueSchema as ObjectValueSchema);
    }
  }

  return keys;
}

function addObjectProperties(
  keys: Set<string>,
  prefix: string,
  schema: ObjectValueSchema,
): void {
  for (const [propKey, propDef] of Object.entries(schema.properties)) {
    const fullKey = `${prefix}.${propKey}`;
    keys.add(fullKey);

    // Recurse if the property itself is an object
    if (propDef.schema.kind === 'object') {
      addObjectProperties(keys, fullKey, propDef.schema as ObjectValueSchema);
    }
  }
}

// ─── diffKeys ─────────────────────────────────────────────────────────────────

/**
 * Return sorted array of keys in docsKeys that are in neither repoKeys nor knownExcluded.
 */
export function diffKeys(
  docsKeys: Set<string>,
  repoKeys: Set<string>,
  knownExcluded: ReadonlySet<string>,
): { missing: string[] } {
  const missing: string[] = [];
  for (const key of docsKeys) {
    if (!repoKeys.has(key) && !knownExcluded.has(key)) {
      missing.push(key);
    }
  }
  missing.sort();
  return { missing };
}

// ─── checkSettingsDocsHealth ──────────────────────────────────────────────────

const SETTINGS_HEALTH_THRESHOLD = 20;
const SETTINGS_SENTINELS = ['model', 'env', 'permissions.allow'] as const;

/**
 * Sanity check on the parsed settings-docs key set.
 * Returns { ok: false, reason } when:
 *   - size === 0
 *   - size < 20 (suspiciously small — real parse produces 90+ keys)
 *   - any sentinel key is absent: 'model', 'env', 'permissions.allow'
 */
export function checkSettingsDocsHealth(settingsKeys: Set<string>): { ok: boolean; reason?: string } {
  if (settingsKeys.size === 0) {
    return { ok: false, reason: 'settings.md produced zero keys — likely a parse failure or empty content' };
  }
  if (settingsKeys.size < SETTINGS_HEALTH_THRESHOLD) {
    return { ok: false, reason: `settings.md produced only ${settingsKeys.size} keys (threshold: ${SETTINGS_HEALTH_THRESHOLD}) — content may be truncated or malformed` };
  }
  for (const sentinel of SETTINGS_SENTINELS) {
    if (!settingsKeys.has(sentinel)) {
      return { ok: false, reason: `settings.md missing sentinel key '${sentinel}' — section heading may have been renamed` };
    }
  }
  return { ok: true };
}

// ─── checkEnvDocsHealth ───────────────────────────────────────────────────────

const ENV_HEALTH_THRESHOLD = 50;

/**
 * Sanity check on the parsed env-vars set.
 * Returns { ok: false } when the set is empty or suspiciously small (< 50 keys).
 */
export function checkEnvDocsHealth(envKeys: Set<string>): { ok: boolean; reason?: string } {
  if (envKeys.size === 0) {
    return { ok: false, reason: 'env-vars.md produced zero keys — likely a parse failure or empty content' };
  }
  if (envKeys.size < ENV_HEALTH_THRESHOLD) {
    return { ok: false, reason: `env-vars.md produced only ${envKeys.size} keys (threshold: ${ENV_HEALTH_THRESHOLD}) — content may be truncated or malformed` };
  }
  return { ok: true };
}
