/**
 * Deterministic settings gap detection.
 * Pure functions; no I/O, no side-effects.
 */

import type { FlatFieldSchema, ObjectValueSchema } from '../claude-settings-schema';

// ─── Section → prefix map ─────────────────────────────────────────────────────

/**
 * Available settings → '' (top-level)
 * Global config settings → '' (stored in ~/.claude.json but same bare-key form)
 * Worktree settings  → '' (rows already read as worktree.x)
 * Permission settings → 'permissions.' (except skipDangerousModePermissionPrompt → '')
 * Sandbox settings   → 'sandbox.'
 * Attribution settings → 'attribution.'
 * All other headings → excluded (null)
 */
const SECTION_PREFIX: Record<string, string | null> = {
  'available settings': '',
  'global config settings': '',
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

/**
 * Extract the description cell (2nd markdown-table column) from a table row.
 * Row shape is always `| key | description | ...optional extra columns... |`,
 * so the description is always at split-by-'|' index 2 regardless of how many
 * trailing columns (e.g. "Example") the table has.
 * Returns '' when the row has no description cell — never throws.
 */
function extractRowDescription(line: string): string {
  const cells = line.split('|');
  const raw = cells[2];
  return raw ? raw.trim() : '';
}

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
  'forceLoginGatewayUrl',                    // managed-only: honored only at the managed policy tier
  'sandbox.credentials.allowPlaintextInject', // managed-only: sandbox nested managed sub-key
  'sandbox.network.tlsTerminate',             // managed-only: sandbox nested managed sub-key, experimental object shape
]);

// ─── KNOWN_REPO_ONLY ──────────────────────────────────────────────────────────

/**
 * Reverse-direction SSOT, parallel to KNOWN_EXCLUDED: keys that legitimately
 * exist in repoKeys but never appear in docs in that exact form, so they must
 * be excluded from diffKeys' `removed` output (repo-has/docs-lacks) to avoid
 * false positives.
 *
 * The `removed` diff runs at flat-field grain (collectRepoFlatFieldKeys —
 * non-object top-level flatSchema entries only; object-kind fields are
 * dropped entirely, not recursed) specifically so structural container/leaf
 * mismatches — e.g. `sandbox`, `worktree`, `sandbox.filesystem` — never reach
 * this list at all. Only the orthogonal nestedUnder dual-form case remains,
 * verified 2026-07-21 against https://code.claude.com/docs/en/settings.md.
 */
export const KNOWN_REPO_ONLY: ReadonlySet<string> = new Set([
  // Source: collectRepoFlatFieldKeys() emits BOTH the bare key and the
  // `nestedUnder.key` form for every nestedUnder field (so the *missing*
  // diff matches docs regardless of which form docs happens to use). Docs
  // only ever lists ONE of the two forms per key, so the unused form is
  // always a spurious `removed` hit. Verified 2026-07-21: all three
  // nestedUnder fields in `src/shared/claude-settings-schema.ts`.
  //
  // docs lists only the prefixed form in "### Permission settings" — bare
  // form is repo-only (exists so the *missing* diff still matches if docs
  // ever lists it bare, mirroring how disableAutoMode is listed bare).
  'defaultMode',
  'disableBypassPermissionsMode',
  // inverse case: docs lists disableAutoMode bare in "### Available settings"
  // only — the prefixed form is repo-only.
  'permissions.disableAutoMode',
  // docs lists only the prefixed form `autoMode.classifyAllShell` — bare form
  // is repo-only. Verified 2026-07-21 against
  // https://code.claude.com/docs/en/settings.md.
  'classifyAllShell',
  // docs lists only the prefixed form `remote.defaultEnvironmentId` in
  // "### Available settings" — bare form is repo-only. Verified 2026-07-30
  // against https://code.claude.com/docs/en/settings.md.
  'defaultEnvironmentId',
]);

// ─── KNOWN_ENV_REPO_ONLY ──────────────────────────────────────────────────────

/**
 * Env-var counterpart to KNOWN_REPO_ONLY: names the repo registry legitimately
 * carries even though the official env-vars.md reference table never lists them
 * as their own row (they are documented elsewhere — hooks/network/monitoring
 * pages, or only in env-vars.md prose). Without this filter diffEnvVars' reverse
 * direction reports all ten on every run.
 *
 * Each entry records where the var is currently documented; all verified
 * 2026-07-30 against https://code.claude.com/docs/en/.
 */
export const KNOWN_ENV_REPO_ONLY: ReadonlySet<string> = new Set([
  // hooks.md — injected into hook commands, not a user-set env var row
  'CLAUDE_PROJECT_DIR',
  // env-vars.md prose only: the DISABLE_FEEDBACK_COMMAND row notes "the older
  // name is also accepted", so the legacy name has no row of its own
  'DISABLE_BUG_COMMAND',
  // network-config.md — Node's own CA bundle var, documented under proxy/TLS setup
  'NODE_EXTRA_CA_CERTS',
  // OTEL exporter/endpoint knobs: env-vars.md closing prose + monitoring-usage.md
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_HEADERS',
  'OTEL_EXPORTER_OTLP_PROTOCOL',
  'OTEL_LOGS_EXPORTER',
  'OTEL_LOGS_EXPORT_INTERVAL',
  'OTEL_METRICS_EXPORTER',
  'OTEL_METRIC_EXPORT_INTERVAL',
]);

// ─── parseSettingsDocs ────────────────────────────────────────────────────────

/**
 * Parse settings.md → Set of effective JSON keys + per-key description text.
 * Section→prefix applied; bracket managed-only keys excluded.
 */
export function parseSettingsDocs(md: string): { keys: Set<string>; descriptions: Map<string, string> } {
  const keys = new Set<string>();
  const descriptions = new Map<string, string>();
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
    descriptions.set(effectiveKey, extractRowDescription(line));
  }

  return { keys, descriptions };
}

// ─── parseEnvDocs ─────────────────────────────────────────────────────────────

/**
 * Parse env-vars.md → Set of env var names + per-var description text.
 * Source: table rows matching /^\|\s*`([A-Z][A-Z0-9_]*)`.
 */
export function parseEnvDocs(md: string): { keys: Set<string>; descriptions: Map<string, string> } {
  const keys = new Set<string>();
  const descriptions = new Map<string, string>();
  for (const line of md.split('\n')) {
    const m = ENV_VAR_ROW_RE.exec(line);
    if (m) {
      keys.add(m[1]);
      descriptions.set(m[1], extractRowDescription(line));
    }
  }
  return { keys, descriptions };
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

// ─── collectRepoFlatFieldKeys ─────────────────────────────────────────────────

/**
 * Build the repo key set at flat-schema-registration grain: one entry per
 * non-object flatSchemas key (bare form, plus `nestedUnder.key` when present).
 * Object-kind fields (valueSchema.kind === 'object') are skipped entirely —
 * no bare key, no recursion into their properties.
 *
 * Used for the `removed` diff direction (repo-has/docs-lacks) instead of the
 * fully expanded collectRepoSettingKeys() set. Docs never independently lists
 * a nested object property's *container* path as its own row (e.g.
 * `sandbox.filesystem`, `statusLine.command` never get a row — only their
 * leaf descendants do), and whether a top-level object field additionally
 * gets an overview row in "Available settings" is inconsistent across docs
 * (`permissions`/`hooks`/`voice` do; `sandbox`/`worktree` don't) — not a
 * reliable signal either way. Comparing object-kind keys in the `removed`
 * direction at all is therefore comparing two things docs doesn't consistently
 * expose at the same grain, so this function drops the entire kind rather
 * than special-casing each inconsistent field: one structural exclusion
 * instead of a growing per-key list (see KNOWN_REPO_ONLY, which is then only
 * needed for the orthogonal nestedUnder dual-form case).
 */
export function collectRepoFlatFieldKeys(
  flatSchemas: Record<string, FlatFieldSchema>,
): Set<string> {
  const keys = new Set<string>();

  for (const [key, field] of Object.entries(flatSchemas)) {
    if (field.valueSchema.kind === 'object') continue;
    keys.add(key);
    if (field.nestedUnder) {
      keys.add(`${field.nestedUnder}.${key}`);
    }
  }

  return keys;
}

// ─── diffKeys ─────────────────────────────────────────────────────────────────

/**
 * Return sorted arrays of:
 *   - missing: keys in docsKeys that are in neither repoKeys nor knownExcluded
 *     (docs added something repo hasn't synced yet). Compared against the
 *     fully expanded repoKeys (collectRepoSettingKeys) so deeply nested doc
 *     gaps (e.g. `sandbox.credentials.files`) are still caught.
 *   - removed: keys in repoFlatFieldKeys that are in neither docsKeys nor
 *     knownRepoOnly (docs no longer documents a key repo still supports —
 *     candidate for the skill's "delete key" flow). Compared at flat-field
 *     grain (collectRepoFlatFieldKeys) — see that function's doc comment for
 *     why full expansion is wrong for this direction. Defaults to an empty
 *     set so callers that only care about `missing` don't need to supply it.
 */
export function diffKeys(
  docsKeys: Set<string>,
  repoKeys: Set<string>,
  knownExcluded: ReadonlySet<string>,
  repoFlatFieldKeys: Set<string> = new Set(),
  knownRepoOnly: ReadonlySet<string> = new Set(),
): { missing: string[]; removed: string[] } {
  const missing: string[] = [];
  for (const key of docsKeys) {
    if (!repoKeys.has(key) && !knownExcluded.has(key)) {
      missing.push(key);
    }
  }
  missing.sort();

  const removed: string[] = [];
  for (const key of repoFlatFieldKeys) {
    if (!docsKeys.has(key) && !knownRepoOnly.has(key)) {
      removed.push(key);
    }
  }
  removed.sort();

  return { missing, removed };
}

// ─── diffEnvVars ──────────────────────────────────────────────────────────────

/**
 * Return sorted arrays of:
 *   - envGaps: env var names documented but not in the repo registry
 *   - envRemoved: env var names in the repo registry but no longer documented,
 *     minus knownEnvRepoOnly (documented outside the env-vars.md table).
 *     Mirrors diffKeys' caller-injected exclusion list; defaults to
 *     KNOWN_ENV_REPO_ONLY so two-argument callers keep the filter.
 * No user-useful/triage judgment here — that's the skill's manual step.
 */
export function diffEnvVars(
  docsEnvKeys: Set<string>,
  registryEnvNames: Set<string>,
  knownEnvRepoOnly: ReadonlySet<string> = KNOWN_ENV_REPO_ONLY,
): { envGaps: string[]; envRemoved: string[] } {
  const envGaps: string[] = [];
  for (const name of docsEnvKeys) {
    if (!registryEnvNames.has(name)) envGaps.push(name);
  }
  envGaps.sort();

  const envRemoved: string[] = [];
  for (const name of registryEnvNames) {
    if (!docsEnvKeys.has(name) && !knownEnvRepoOnly.has(name)) envRemoved.push(name);
  }
  envRemoved.sort();

  return { envGaps, envRemoved };
}

// ─── checkSettingsDocsHealth ──────────────────────────────────────────────────

const SETTINGS_HEALTH_THRESHOLD = 20;
const SETTINGS_SENTINELS = ['model', 'env', 'permissions.allow', 'sandbox.enabled', 'attribution.commit'] as const;

/**
 * Sanity check on the parsed settings-docs key set.
 * Returns { ok: false, reason } when:
 *   - size === 0
 *   - size < 20 (suspiciously small — real parse produces 90+ keys)
 *   - any sentinel key is absent: 'model', 'env', 'permissions.allow',
 *     'sandbox.enabled', 'attribution.commit' (one per docs section that
 *     drives SECTION_PREFIX, so a renamed heading silently drops that
 *     section's keys instead of surfacing as a health failure)
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
