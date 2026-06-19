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
    nested: { type: 'string', description: 'dotted path of the immediate parent object if this is a nested property (e.g. "sandbox" for sandbox.allowAppleEvents, "sandbox.filesystem" for a deep child), else empty for top-level keys' },
    optional: { type: 'boolean', description: 'for nested children: true if the property is optional in its parent object, false if required' },
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
          nestedUnder: { type: 'string', description: 'repo write-path: the key is stored at settings[nestedUnder][key] (e.g. defaultMode → permissions). Surfacing mechanism, NOT a diff marker.' },
          nested: { type: 'string', description: 'diff marker: dotted path of the immediate parent object for expanded nested children (e.g. "sandbox", "sandbox.filesystem", "permissions"); empty for top-level keys' },
          optional: { type: 'boolean', description: 'for nested children: true if optional in its parent object schema, false if required' },
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
        properties: { key: { type: 'string' }, type: { type: 'string' }, defaultStr: { type: 'string' }, source: { type: 'string', description: 'schema | docs-only | both' }, nested: { type: 'string', description: 'dotted parent path if this is a nested-object child (e.g. "sandbox", "sandbox.filesystem"), else empty for top-level keys' } },
      },
    },
    removed: { type: 'array', items: { type: 'object', required: ['key'], properties: { key: { type: 'string' }, repoSection: { type: 'string' }, nested: { type: 'string', description: 'dotted parent path if this is a nested-object child, else empty for top-level keys' } } } },
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
      'For nested objects (permissions; sandbox plus sandbox.filesystem/network/ripgrep; attribution; statusLine; subagentStatusLine; worktree; autoMode; spinnerVerbs; spinnerTipsOverride; fileSuggestion; voice), emit each nested property as its OWN key entry: key = the bare property name, nested = the dotted path of its IMMEDIATE parent (e.g. allowAppleEvents → nested="sandbox"; a sandbox.filesystem child → nested="sandbox.filesystem"). Set optional=false only if the schema marks the property required, else optional=true. Recurse into nested objects. Top-level keys keep nested="".',
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
      'Single source of truth: src/shared/claude-settings-schema.ts → CLAUDE_SETTINGS_SCHEMA. For each top-level entry return: key, its section (general/display/permissions/env/hooks/advanced), valueSchema.kind, stringified default (defaultStr), enum options, nestedUnder, hasNumberRange (true if a number field declares min/max), and nested="".',
      'CRITICAL — expand object shapes, otherwise objects are opaque and the diff silently skips nested drift. For every entry whose valueSchema.kind is "object" (permissions, sandbox, attribution, statusLine, subagentStatusLine, fileSuggestion, worktree, autoMode, spinnerVerbs, spinnerTipsOverride, voice): emit the object key itself as a top-level entry (kind="object", nested=""), THEN recurse its valueSchema properties and emit each child as its own schemaKeys entry — key = bare property name, nested = dotted path of the IMMEDIATE parent (sandbox child → nested="sandbox"; sandbox.filesystem/network/ripgrep child → nested="sandbox.filesystem" etc), kind/enum/defaultStr from the child schema, optional=true unless the property is required(). Recurse into nested objects.',
      'DEDUP — defaultMode, disableAutoMode, disableBypassPermissionsMode are standalone entries carrying nestedUnder="permissions" AND also appear inside PERMISSIONS_VALUE_SCHEMA.properties. Emit each such child EXACTLY ONCE, as a nested entry (key = bare name, nested = its nestedUnder parent, e.g. defaultMode → nested="permissions"); do NOT also emit it as a bare top-level entry, and when recursing the parent object skip any (nested,key) pair already emitted. Net: every nested child appears once with nested set; no top-level duplicate.',
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

// --- Phase 2: Diff (single reasoning pass over all three structured snapshots) ---
// REASON-ONLY: every input is inline, so the only correct action is the StructuredOutput call.
// Guard rail: a prior run handed this agent the full tool set and it treated the diff as a
// compute task (12 Bash + 8 Write + advisor, 0 StructuredOutput) — 23 tool turns, then a
// stream idle timeout. The ~23K-token prompt was never the problem; tool thrashing was. The
// inline constraint + low effort keep it to one pass; the retry + null guard turn a transient
// timeout into a clear error instead of a downstream "null is not an object".
phase('Diff')
const diffPrompt = [
  'You are given three structured snapshots of Claude Code settings. Produce a DEEP diff.',
  'REASON ONLY: every input you need is inline below. Do NOT use Bash, Write, Read, WebSearch, or an advisor, and do NOT write any file or script. Your FIRST and ONLY action is the StructuredOutput tool call — reason internally, then emit it.',
  'Do NOT compare only top-level key existence — that misses real drift. Tag every change with depth = top-level | nested | union | meta.',
  'Choose PRIMARY_SCHEMA first: if OFFICIAL.officialSchemaFetchedOk is true, use OFFICIAL.officialSchemaKeys / officialHookCommandTypes / officialHookEventTypes. Otherwise use SCHEMA_STORE.keys / hookCommandTypes / hookEventTypes. If OFFICIAL.officialSchemaUrl is non-empty but officialSchemaFetchedOk=false, continue with schemastore and add the fetch error to conflicts.',
  '1. top-level presence: compare ONLY entries with nested="" on both sides (nested children belong to step 3). added = PRIMARY_SCHEMA top-level keys missing from repo top-level keys; EXCLUDE from "added" every key in REPO.knownExcluded (intentionally omitted: managed-only / plugin-internal / deprecated / meta). removed = repo top-level keys missing from PRIMARY_SCHEMA — BUT first subtract every key that appears in OFFICIAL.docsKeys OR OFFICIAL.changelogSettings: those are docs-confirmed keys the repo synced ahead of a lagging schemastore, so they are NOT removals — emit a conflicts entry "schemastore lags docs: <key>" for each instead. A key is a genuine removed candidate only when absent from PRIMARY_SCHEMA AND docsKeys AND changelogSettings.',
  '2. scalar meta (existing keys): PRIMARY_SCHEMA default, enum option SET (order-agnostic), and number minimum/maximum/multipleOf vs repo min/max/step.',
  '3. nested object properties: both sides now emit nested children as flat entries with nested=dotted parent path (e.g. nested="sandbox" / "sandbox.filesystem" / "permissions"). Match by the (nested, key) pair. A child in PRIMARY_SCHEMA but missing from repo → added with depth=nested, EXCEPT drop any whose dotted path `${nested}.${key}` is in REPO.knownExcluded (managed-only nested like sandbox.bwrapPath, sandbox.filesystem.allowManagedReadPathsOnly, sandbox.enabledPlatforms). A child in repo but missing from PRIMARY_SCHEMA → apply the SAME docsKeys/changelogSettings subtraction as step 1 (a docs-confirmed nested key is a schemastore-lag conflict, not removed). For matched pairs compare child kind and optional/required → changed with depth=nested.',
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
].join('\n')

let diff = null
for (let attempt = 1; attempt <= 2 && !diff; attempt++) {
  diff = await agent(diffPrompt, {
    label: attempt === 1 ? 'diff' : 'diff:retry',
    phase: 'Diff',
    schema: DIFF_SCHEMA,
    effort: 'low',
  })
}
if (!diff) {
  throw new Error('Diff phase returned null after 2 attempts (likely a stream idle timeout). The diff agent must emit StructuredOutput in a single reasoning pass without using tools — check its transcript for tool thrashing.')
}
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
        'REASON ONLY: the gap is inline below. Do NOT use Bash, Write, Read, WebSearch, or an advisor, and do NOT write any file; emit the StructuredOutput classification directly.',
        'Gap: ' + JSON.stringify(g),
        'Categories: user-facing | anti-direction | managed-only | plugin-internal | deprecated | repo-only | docs-likely-gap | meta.',
        'managed-only = enterprise-admin keys (allowManaged*, sandbox.*ManagedOnly, blockedMarketplaces, policyHelper, ...). plugin-internal = enabledPlugins / extraKnownMarketplaces / pluginConfigs. deprecated = superseded (e.g. includeCoAuthoredBy → attribution). meta = $schema.',
        'If the gap has a non-empty "nested" field it is a child of that object (e.g. nested="sandbox" → a sandbox sub-option): classify by the parent object\'s role and put it in the parent\'s section.',
        'If user-facing, also set suggestedSection. ' + surfaceMapHint,
      ].join('\n'),
      { label: `cat:${g.key}`, phase: 'Categorize', schema: CATEGORY_SCHEMA, effort: 'low' },
    ).then(async cat => {
      if (cat.category !== 'repo-only') return { ...g, ...cat }
      // false-negative guard: only declare repo-only after trying hard to prove it is a docs gap.
      // Nested children search by their dotted path (a bare child name like "allowRead" is unsearchable).
      const fullKey = g.nested ? `${g.nested}.${g.key}` : g.key
      const v = await agent(
        [
          `Settings key "${fullKey}" is in the repo schema but was NOT found in the primary schema or official docs.`,
          'Use WebSearch to gather evidence, then emit the StructuredOutput verdict directly. WebSearch is the ONLY tool you may use — do NOT use Bash, Write, Read, or an advisor, and do NOT write any file or script.',
          'Try hard to prove it is a REAL feature the docs merely omitted (→ docs-likely-gap), not a mistaken repo addition (→ repo-only).',
          `Search at least two ways: WebSearch "${fullKey}" site:code.claude.com ; WebSearch "\\"${fullKey}\\"" site:github.com/anthropics/claude-code ; and search for a matching CLAUDE_CODE_* environment variable.`,
          'isDocsGap=true ONLY with concrete feature evidence (env var, a GitHub issue using the key as a setting, or a CHANGELOG mention).',
        ].join('\n'),
        { label: `verify:${fullKey}`, phase: 'Categorize', schema: VERIFY_SCHEMA },
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
