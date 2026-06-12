/**
 * sync-settings-options — discovery workflow (read-only).
 *
 * Fans out the expensive, parallelizable, NON-mutating part of the settings
 * sync: fetch the official schema + docs in parallel, deep-diff against the
 * repo, and categorize every gap (with an adversarial repo-only guard).
 *
 * It returns a structured gap report. It deliberately does NOT edit files,
 * ask the user, or run typecheck/test/build — those stay in the main loop,
 * because (1) a background workflow cannot AskUserQuestion and (2) the repo
 * forbids concurrent test/build, which parallel agents would violate.
 *
 * Run with: Workflow({ scriptPath: ".../references/scripts/sync-settings.workflow.js" })
 */

export const meta = {
  name: 'sync-settings-options',
  description: 'Discover Claude Code settings drift: fetch official schema + docs, deep-diff against repo schema/env/i18n, categorize each gap with an adversarial repo-only guard. Read-only — returns a gap report for the main loop to confirm + apply.',
  phases: [
    { title: 'Fetch', detail: 'schemastore JSON + official docs/CHANGELOG + repo schema/env/i18n, in parallel' },
    { title: 'Diff', detail: 'deep diff across top-level / nested / union / number-range / env / hook dimensions' },
    { title: 'Categorize', detail: 'classify each gap; adversarially verify before declaring a key repo-only' },
  ],
}

// --- structured-output schemas (polymorphic values stringified for robust validation) ---

const KEY_SHAPE = {
  type: 'object',
  required: ['key', 'type'],
  properties: {
    key: { type: 'string' },
    type: { type: 'string', description: 'string | number | boolean | array | object | union | enum | literal' },
    enum: { type: 'array', items: { type: 'string' }, description: 'enum options if any' },
    defaultStr: { type: 'string', description: 'stringified default, empty if none' },
    numberRange: { type: 'string', description: 'e.g. "min=1 max=65535" if the schema constrains a number, else empty' },
    nested: { type: 'string', description: 'parent object key if this is a nested property, else empty' },
    description: { type: 'string' },
  },
}

const ENV_VAR_SHAPE = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string' },
    valueType: { type: 'string', description: 'string | number | boolean if known, else empty' },
    category: { type: 'string', description: 'model | auth | provider | effort | timeout | limits | feature | ui | shell | telemetry if known, else empty' },
    defaultStr: { type: 'string', description: 'stringified default, empty if none' },
    sensitive: { type: 'boolean' },
    deprecated: { type: 'boolean' },
    description: { type: 'string' },
  },
}

const SCHEMA_STORE_SCHEMA = {
  type: 'object',
  required: ['fetchedOk', 'keys', 'hookCommandTypes', 'hookEventTypes'],
  properties: {
    fetchedOk: { type: 'boolean', description: 'false ONLY if curl failed or returned non-JSON' },
    sourceUrl: { type: 'string' },
    keys: { type: 'array', items: KEY_SHAPE },
    hookCommandTypes: { type: 'array', items: { type: 'string' }, description: '$defs.hookCommand.anyOf type literals' },
    hookEventTypes: { type: 'array', items: { type: 'string' }, description: 'properties.hooks.properties.* event names' },
  },
}

const OFFICIAL_SCHEMA = {
  type: 'object',
  required: ['docsKeys', 'changelogSettings', 'officialSchemaUrl', 'officialSchemaFetchedOk', 'officialSchemaKeys', 'envVars'],
  properties: {
    docsKeys: { type: 'array', items: { type: 'string' }, description: 'keys in the official "Available settings" table' },
    changelogSettings: { type: 'array', items: { type: 'string' }, description: 'settings keys in recent CHANGELOG entries' },
    officialSchemaUrl: { type: 'string', description: 'Anthropic-hosted schema URL if found, else empty' },
    officialSchemaFetchedOk: { type: 'boolean', description: 'true only when officialSchemaUrl was found and parsed successfully' },
    officialSchemaFetchError: { type: 'string', description: 'fetch/parse error if officialSchemaUrl was found but could not be parsed, else empty' },
    officialSchemaKeys: { type: 'array', items: KEY_SHAPE, description: 'parsed official schema keys when officialSchemaFetchedOk=true, else []' },
    officialHookCommandTypes: { type: 'array', items: { type: 'string' }, description: 'official schema hook command type literals when available' },
    officialHookEventTypes: { type: 'array', items: { type: 'string' }, description: 'official schema hook event names when available' },
    envVars: { type: 'array', items: ENV_VAR_SHAPE, description: 'known env vars from the official env-vars docs' },
  },
}

const REPO_SCHEMA = {
  type: 'object',
  required: ['schemaKeys', 'envVars', 'sections'],
  properties: {
    schemaKeys: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'section'],
        properties: {
          key: { type: 'string' },
          section: { type: 'string' },
          kind: { type: 'string' },
          defaultStr: { type: 'string' },
          enum: { type: 'array', items: { type: 'string' } },
          nestedUnder: { type: 'string' },
          hasNumberRange: { type: 'boolean' },
        },
      },
    },
    envVars: { type: 'array', items: ENV_VAR_SHAPE },
    sections: { type: 'array', items: { type: 'string' } },
    hookCommandTypes: { type: 'array', items: { type: 'string' } },
    hookEventTypes: { type: 'array', items: { type: 'string' } },
    i18nMissing: { type: 'array', items: { type: 'string' }, description: 'schema keys lacking en.ts label/description' },
    knownExcluded: { type: 'array', items: { type: 'string' }, description: 'keys surface-map.md documents as intentionally omitted (managed-only / plugin-internal / deprecated / meta), incl. nested like sandbox.bwrapPath' },
  },
}

const DIFF_SCHEMA = {
  type: 'object',
  required: ['added', 'removed', 'changed', 'envChanges', 'hookCoverage', 'conflicts'],
  properties: {
    added: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'source'],
        properties: { key: { type: 'string' }, type: { type: 'string' }, defaultStr: { type: 'string' }, source: { type: 'string', description: 'schema | docs-only | both' } },
      },
    },
    removed: { type: 'array', items: { type: 'object', required: ['key'], properties: { key: { type: 'string' }, repoSection: { type: 'string' } } } },
    changed: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'field', 'schema', 'repo', 'depth'],
        properties: { key: { type: 'string' }, field: { type: 'string' }, schema: { type: 'string' }, repo: { type: 'string' }, depth: { type: 'string', description: 'top-level | nested | union | meta' } },
      },
    },
    envChanges: { type: 'array', items: { type: 'object', required: ['name', 'change'], properties: { name: { type: 'string' }, change: { type: 'string', description: 'added | removed | changed' } } } },
    hookCoverage: {
      type: 'object',
      properties: {
        missingEventTypes: { type: 'array', items: { type: 'string' } },
        missingCommandTypes: { type: 'array', items: { type: 'string' } },
      },
    },
    conflicts: { type: 'array', items: { type: 'string' }, description: 'schema-vs-repo disagreements worth surfacing' },
  },
}

const CATEGORY_SCHEMA = {
  type: 'object',
  required: ['key', 'category', 'rationale'],
  properties: {
    key: { type: 'string' },
    category: { type: 'string', enum: ['user-facing', 'anti-direction', 'managed-only', 'plugin-internal', 'deprecated', 'repo-only', 'docs-likely-gap', 'meta'] },
    suggestedSection: { type: 'string', enum: ['general', 'display', 'permissions', 'env', 'hooks', 'advanced', ''] },
    rationale: { type: 'string' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['key', 'isDocsGap', 'evidence'],
  properties: {
    key: { type: 'string' },
    isDocsGap: { type: 'boolean', description: 'true only if concrete feature evidence found (env var / GitHub issue / CHANGELOG)' },
    evidence: { type: 'string' },
  },
}

// --- Phase 1: Fetch (three independent sources, in parallel) ---
phase('Fetch')
const [store, official, repo] = await parallel([
  () => agent(
    [
      'Fetch the Claude Code settings JSON Schema and return its structure. Do not invent keys.',
      'Run: curl -sL https://json.schemastore.org/claude-code-settings.json   (-L follows the redirect)',
      'Parse: properties.* (key, type, enum, default, description); $defs.hookCommand.anyOf[*] (the "type" literal of each variant); properties.hooks.properties.* (hook event names).',
      'For nested objects (permissions, sandbox.filesystem, sandbox.network, attribution, statusLine, worktree, autoMode, spinnerVerbs, spinnerTipsOverride, fileSuggestion), emit each nested property as its own key entry with the parent in "nested".',
      'Stringify defaults into defaultStr. Put number minimum/maximum/multipleOf into numberRange. Set fetchedOk=false ONLY if curl fails or returns non-JSON.',
    ].join('\n'),
    { label: 'fetch:schemastore', phase: 'Fetch', model: 'sonnet', schema: SCHEMA_STORE_SCHEMA },
  ),
  () => agent(
    [
      'Cross-check the OFFICIAL Claude Code sources (schema store is community-maintained and may lag).',
      '1. Via context7 (resolve library id /websites/code_claude), read code.claude.com/docs/en/settings and extract every key in the "Available settings" table → docsKeys.',
      '2. Via context7, read code.claude.com/docs/en/env-vars and extract env vars into envVars with name, valueType, defaultStr, sensitive/deprecated if stated, category if inferable from docs grouping, and description.',
      '3. WebSearch: site:github.com/anthropics/claude-code CHANGELOG settings — list settings keys named in recent entries → changelogSettings.',
      '4. Discover whether Anthropic now hosts its own settings schema URL (e.g. under code.claude.com). Return it in officialSchemaUrl, else empty string.',
      '5. If officialSchemaUrl is non-empty, curl it and parse the same structure as schemastore into officialSchemaKeys, officialHookCommandTypes, and officialHookEventTypes. Set officialSchemaFetchedOk=true only when that schema parsed successfully; otherwise set false and put the error in officialSchemaFetchError.',
      'Hard limit: at most 3 context7 queries total.',
    ].join('\n'),
    { label: 'fetch:official', phase: 'Fetch', model: 'sonnet', schema: OFFICIAL_SCHEMA },
  ),
  () => agent(
    [
      'Read the repo settings surface and return its current shape. READ ONLY — do not modify anything.',
      'Single source of truth: src/shared/claude-settings-schema.ts → CLAUDE_SETTINGS_SCHEMA. For each entry return: key, its section (general/display/permissions/env/hooks/advanced), valueSchema.kind, stringified default (defaultStr), enum options, nestedUnder, and hasNumberRange (true if a number field declares min/max).',
      'Also: KNOWN_ENV_VARS from src/shared/known-env-vars.ts (→ envVars with name, valueType, category, defaultStr, sensitive/deprecated); the hook command-type union variants + hook event types the repo supports; and which schema keys LACK a label/description in src/webview/i18n/locales/en.ts (→ i18nMissing).',
      'Also read .claude/skills/update-settings-options/references/surface-map.md and return its "Excluded categories" key list (managed-only / plugin-internal / deprecated / meta, including nested keys like sandbox.bwrapPath) → knownExcluded.',
      'Do NOT read src/shared/claude-settings-types.generated.ts — it is a generated artifact, not a source.',
    ].join('\n'),
    { label: 'read:repo', phase: 'Fetch', agentType: 'Explore', model: 'sonnet', schema: REPO_SCHEMA },
  ),
])

if ((!store || !store.fetchedOk) && !official?.officialSchemaFetchedOk) {
  throw new Error('schema fetch failed — schemastore failed and no official schema was parsed')
}
const primarySchemaSource = official?.officialSchemaFetchedOk ? 'official' : 'schemastore'
const primarySchemaKeyCount = official?.officialSchemaFetchedOk ? official.officialSchemaKeys.length : store.keys.length
log(`Fetched ${primarySchemaKeyCount} ${primarySchemaSource} schema keys · repo ${repo?.schemaKeys?.length ?? 0} keys · official docs ${official?.docsKeys?.length ?? 0} keys · official env ${official?.envVars?.length ?? 0}`)

// --- Phase 2: Diff (one reasoning pass over all three structured snapshots) ---
phase('Diff')
const diff = await agent(
  [
    'You are given three structured snapshots of Claude Code settings. Produce a DEEP diff.',
    'Do NOT compare only top-level key existence — that misses real drift. Tag every change with depth = top-level | nested | union | meta.',
    'Choose PRIMARY_SCHEMA first: if OFFICIAL.officialSchemaFetchedOk is true, use OFFICIAL.officialSchemaKeys / officialHookCommandTypes / officialHookEventTypes. Otherwise use SCHEMA_STORE.keys / hookCommandTypes / hookEventTypes. If OFFICIAL.officialSchemaUrl is non-empty but officialSchemaFetchedOk=false, continue with schemastore and add the fetch error to conflicts.',
    '1. top-level: PRIMARY_SCHEMA keys vs repo schemaKeys → added / removed. EXCLUDE from "added" every key in REPO.knownExcluded — those are intentionally omitted (managed-only / plugin-internal / deprecated / meta), not gaps. Only list genuinely new keys.',
    '2. scalar meta (existing keys): PRIMARY_SCHEMA default, enum option SET (order-agnostic), and number minimum/maximum/multipleOf vs repo min/max/step.',
    '3. nested object properties: recurse permissions, sandbox.{filesystem,network}, attribution, spinnerVerbs, spinnerTipsOverride, statusLine, fileSuggestion, autoMode, worktree — property set + required/optional + child shape.',
    '4. union types: hookCommand.anyOf variant required/optional props; allowedMcpServers/deniedMcpServers item discriminants.',
    '5. number-range missing: schema has minimum/maximum but repo lacks min/max (depth=meta).',
    '6. env: OFFICIAL.envVars vs REPO.envVars → envChanges. Compare by name for added/removed; compare valueType/defaultStr/sensitive/deprecated/category when both sides provide metadata and use change="changed" for real metadata drift.',
    '7. hook coverage — COMMAND types only: the repo HOOK_COMMAND_SCHEMA union is a FIXED set (command/prompt/agent/http/mcp_tool), so list any PRIMARY_SCHEMA command type it lacks → missingCommandTypes. EVENT types do NOT drift: the repo hooks schema is recordValue keyed by ARBITRARY event names (HooksSection derives types via Object.keys at runtime), so it is dynamically compatible with every event type → missingEventTypes MUST be []. Never enumerate event types as missing.',
    'A key in official docsKeys/changelogSettings but missing from PRIMARY_SCHEMA → add it with source="docs-only". Both present → source="both"; only PRIMARY_SCHEMA → source="schema".',
    'List schema-vs-repo disagreements in conflicts.',
    '',
    'SCHEMA_STORE: ' + JSON.stringify(store),
    'OFFICIAL: ' + JSON.stringify(official),
    'REPO: ' + JSON.stringify(repo),
  ].join('\n'),
  { label: 'diff', phase: 'Diff', schema: DIFF_SCHEMA },
)
log(`Diff: +${diff.added.length} / -${diff.removed.length} / ~${diff.changed.length} · env ${diff.envChanges.length} · conflicts ${diff.conflicts.length}`)

// --- Phase 3: Categorize each presence gap; adversarially verify before "repo-only" ---
phase('Categorize')
const surfaceMapHint = [
  'Sections: env→env; hooks/disableAllHooks→hooks; permissions rules + MCP allow/deny/mcpjson→permissions;',
  'model/effort/agent/language/memory/git/IDE/updates/cleanup/defaultMode→general; view/spinner/notifications/input/teammate→display;',
  'anti-direction (anti-cost / anti-efficiency / anti-user — e.g. forces extra token spend) → advanced; no natural home → advanced.',
  'Never invent a new section.',
].join(' ')

const presenceGaps = [
  ...diff.added.map(g => ({ ...g, kind: 'added' })),
  ...diff.removed.map(g => ({ ...g, kind: 'removed' })),
]

const categorized = presenceGaps.length === 0
  ? []
  : await parallel(presenceGaps.map(g => () =>
    agent(
      [
        'Classify this Claude Code settings gap for the extension UI.',
        'Gap: ' + JSON.stringify(g),
        'Categories: user-facing | anti-direction | managed-only | plugin-internal | deprecated | repo-only | docs-likely-gap | meta.',
        'managed-only = enterprise-admin keys (allowManaged*, sandbox.*ManagedOnly, blockedMarketplaces, policyHelper, ...). plugin-internal = enabledPlugins / extraKnownMarketplaces / pluginConfigs. deprecated = superseded (e.g. includeCoAuthoredBy → attribution). meta = $schema.',
        'If user-facing, also set suggestedSection. ' + surfaceMapHint,
      ].join('\n'),
      { label: `cat:${g.key}`, phase: 'Categorize', schema: CATEGORY_SCHEMA },
    ).then(async cat => {
      if (cat.category !== 'repo-only') return { ...g, ...cat }
      // false-negative guard: only declare repo-only after trying hard to prove it is a docs gap
      const v = await agent(
        [
          `Settings key "${g.key}" is in the repo schema but was NOT found in the primary schema or official docs.`,
          'Try hard to prove it is a REAL feature the docs merely omitted (→ docs-likely-gap), not a mistaken repo addition (→ repo-only).',
          `Search at least two ways: WebSearch "${g.key}" site:code.claude.com ; WebSearch "\\"${g.key}\\"" site:github.com/anthropics/claude-code ; and check for a matching CLAUDE_CODE_* env var in known-env-vars.ts.`,
          'isDocsGap=true ONLY with concrete feature evidence (env var, a GitHub issue using the key as a setting, or a CHANGELOG mention).',
        ].join('\n'),
        { label: `verify:${g.key}`, phase: 'Categorize', schema: VERIFY_SCHEMA },
      )
      return { ...g, ...cat, category: v.isDocsGap ? 'docs-likely-gap' : 'repo-only', evidence: v.evidence }
    })
  ))

const gaps = categorized.filter(Boolean)
const userFacing = gaps.filter(g => g.category === 'user-facing' || g.category === 'anti-direction')
log(`Categorized ${gaps.length} presence gaps — ${userFacing.length} user-facing/anti-direction to apply`)

return {
  // presence gaps with category + section suggestion + repo-only evidence
  gaps,
  userFacing,
  repoOnly: gaps.filter(g => g.category === 'repo-only'),
  docsLikelyGap: gaps.filter(g => g.category === 'docs-likely-gap'),
  // meta drift on existing keys — no categorization needed, apply directly
  changed: diff.changed,
  envChanges: diff.envChanges,
  hookCoverage: diff.hookCoverage,
  conflicts: diff.conflicts,
  // official-source discovery results
  officialSchemaUrl: official?.officialSchemaUrl ?? '',
  officialSchemaFetchedOk: official?.officialSchemaFetchedOk ?? false,
  officialSchemaFetchError: official?.officialSchemaFetchError ?? '',
  primarySchemaSource,
  docsOnlyKeys: diff.added.filter(a => a.source === 'docs-only').map(a => a.key),
}
