/**
 * sync-settings-options — discovery workflow (read-only).
 *
 * Runs the deterministic gap-detection CLI, then categorizes each gap with an
 * LLM pass. Does NOT edit files, ask the user, or run typecheck/test/build —
 * those stay in the main loop, because (1) a background workflow cannot
 * AskUserQuestion and (2) the repo forbids concurrent test/build.
 *
 * Run with: Workflow({ scriptPath: ".../references/scripts/sync-settings.workflow.js" })
 */

export const meta = {
  name: 'sync-settings-options',
  description: 'Discover Claude Code settings drift: run the deterministic CLI to get presence gaps, then categorize each gap for the main loop to confirm + apply. Read-only — returns a gap report.',
  phases: [
    { title: 'Detect', detail: 'run scripts/settings-sync-diff.ts (cwd repo root) and parse its JSON output (gaps + default/storage drift)' },
    { title: 'Categorize', detail: 'classify each settings gap (section + isObjectEditor); env gaps passed through as-is' },
  ],
}

// ─── Schemas ───────────────────────────────────────────────────────────────────

const DETECT_SCHEMA = {
  type: 'object',
  required: ['settingsGaps', 'removedKeys', 'envGaps', 'envRemoved', 'defaultDrift', 'storageDrift', 'counts', 'health'],
  properties: {
    settingsGaps: {
      type: 'array',
      items: { type: 'object', properties: { key: { type: 'string' }, description: { type: 'string' }, topic: { type: 'string' }, scope: { type: 'string' } } },
      description: 'doc keys missing from repo schema (already filtered by KNOWN_EXCLUDED and Scope=Managed), each with its index description, topic and scope',
    },
    removedKeys: { type: 'array', items: { type: 'string' }, description: 'repo schema keys no longer documented (flat-field grain, already filtered by KNOWN_REPO_ONLY) — candidates for the delete-key flow, never auto-applied' },
    envGaps: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } },
      description: 'env var names documented but missing from src/shared/known-env-vars.ts, each with its docs description text',
    },
    envRemoved: { type: 'array', items: { type: 'string' }, description: 'env var names in known-env-vars.ts no longer documented (minus KNOWN_ENV_REPO_ONLY) — candidates for registry removal, never auto-applied' },
    defaultDrift: {
      type: 'array',
      items: { type: 'object', properties: { key: { type: 'string' }, kind: { type: 'string' }, docs: { type: 'string' }, repo: {} } },
      description: 'keys whose schema default disagrees with the docs **Default** bullet (kind: mismatch | repoDefaultDocsUnset | unparsed)',
    },
    storageDrift: {
      type: 'array',
      items: { type: 'object', properties: { key: { type: 'string' }, docsScope: { type: 'string' }, repoStorageFile: { type: 'string' } } },
      description: 'keys whose index Scope (Global config = ~/.claude.json) disagrees with schema storageFile',
    },
    counts: {
      type: 'object',
      properties: {
        docsKeys: { type: 'number' },
        repoKeys: { type: 'number' },
        settingsGaps: { type: 'number' },
        removedKeys: { type: 'number' },
        envKeys: { type: 'number' },
        envGaps: { type: 'number' },
        envRemoved: { type: 'number' },
        defaultDrift: { type: 'number' },
        storageDrift: { type: 'number' },
      },
    },
    health: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        reason: { type: 'string' },
      },
    },
  },
}

const CATEGORY_SCHEMA = {
  type: 'object',
  required: ['key', 'category', 'rationale', 'suggestedSection', 'isObjectEditor'],
  properties: {
    key: { type: 'string' },
    category: {
      type: 'string',
      enum: ['user-facing', 'anti-direction', 'managed-only', 'plugin-internal', 'deprecated', 'meta'],
      description: 'managed-only/plugin-internal/deprecated/meta = non-user-facing; should be added to KNOWN_EXCLUDED. user-facing / anti-direction = needs UI.',
    },
    suggestedSection: {
      type: 'string',
      enum: ['general', 'display', 'permissions', 'env', 'hooks', 'advanced', ''],
      description: 'required when category is user-facing or anti-direction',
    },
    isObjectEditor: {
      type: 'boolean',
      description: 'true when the key likely needs a bespoke object editor (controlType Object), not a scalar SchemaFieldRenderer control',
    },
    rationale: { type: 'string' },
  },
}

// ─── Phase 1: Detect ───────────────────────────────────────────────────────────
phase('Detect')
const detected = await agent(
  [
    'Run the settings gap-detection CLI and return its JSON output verbatim.',
    'Command (run from repo root): npx tsx scripts/settings-sync-diff.ts',
    'The command fetches live docs and compares against the repo schema. It exits 1 on health failure — if it does, throw an error instead of returning null.',
    'Parse stdout as JSON and return it exactly as-is. Do NOT filter, re-derive, or add fields.',
  ].join('\n'),
  { label: 'detect:cli', phase: 'Detect', schema: DETECT_SCHEMA },
)

if (!detected) {
  throw new Error('Detect phase returned null — CLI likely exited 1 (health failure or fetch error). Check the agent transcript.')
}
// health is guaranteed ok: CLI calls process.exit(1) on failure, producing no JSON output.
// A parsed `detected` therefore always has health.ok === true.

log(`Detect: ${detected.counts.settingsGaps} settings gaps · ${detected.counts.removedKeys} removed keys · ${detected.counts.envGaps} env gaps · ${detected.counts.envRemoved} env removed · ${detected.counts.defaultDrift} default drift · ${detected.counts.storageDrift} storage drift · ${detected.counts.docsKeys} docs keys · ${detected.counts.repoKeys} repo keys`)

if (detected.settingsGaps.length === 0) {
  log('No settings gaps — skipping Categorize phase.')
  return {
    categorized: [],
    userFacing: [],
    nonUserFacing: [],
    removedKeys: detected.removedKeys,
    envGaps: detected.envGaps,
    envRemoved: detected.envRemoved,
    defaultDrift: detected.defaultDrift,
    storageDrift: detected.storageDrift,
    counts: detected.counts,
  }
}

// ─── Phase 2: Categorize each settings gap ─────────────────────────────────────
phase('Categorize')
const surfaceMapHint = [
  'Sections: env→env; hooks/disableAllHooks→hooks; permissions rules + MCP allow/deny→permissions;',
  'model/effort/agent/language/memory/git/IDE/updates/cleanup/defaultMode→general; view/spinner/notifications/input/teammate→display;',
  'anti-direction (anti-cost/anti-efficiency/anti-user)→advanced; no natural home→advanced.',
  'managed-only = enterprise-only keys whose scope column did not say Managed (Managed-scope keys are already filtered out).',
  'plugin-internal = enabledPlugins/extraKnownMarketplaces/pluginConfigs etc.',
  'Never invent a new section.',
].join(' ')

const categorized = await parallel(detected.settingsGaps.map(gap => () =>
  agent(
    [
      'Classify this Claude Code settings gap for the extension UI.',
      'REASON ONLY: the key and its docs description are inline below. Do NOT use Bash, Write, Read, WebSearch, or an advisor. Emit the StructuredOutput classification directly.',
      'Key: ' + JSON.stringify(gap.key),
      'Docs description: ' + JSON.stringify(gap.description),
      'Docs topic: ' + JSON.stringify(gap.topic ?? ''),
      'Docs scope: ' + JSON.stringify(gap.scope ?? ''),
      'Scope "Global config" means the key lives in ~/.claude.json (needs storageFile: globalConfig) — still user-facing.',
      'If the key is dotted (e.g. "sandbox.foo", "permissions.bar", "attribution.baz"), it is a nested child — classify by the parent object\'s role and note that in the rationale.',
      'Set isObjectEditor=true if the key likely maps to a complex object value needing a bespoke editor (e.g. array-of-objects). Boolean/string/enum/number keys → isObjectEditor=false.',
      'If category is managed-only/plugin-internal/deprecated/meta, set suggestedSection="" — it will be added to KNOWN_EXCLUDED instead of synced to UI.',
      surfaceMapHint,
    ].join('\n'),
    { label: `cat:${gap.key}`, phase: 'Categorize', schema: CATEGORY_SCHEMA, effort: 'low' },
  )
))

const gaps = categorized.filter(Boolean)
const userFacing = gaps.filter(g => g.category === 'user-facing' || g.category === 'anti-direction')
const nonUserFacing = gaps.filter(g => g.category !== 'user-facing' && g.category !== 'anti-direction')

log(`Categorized ${gaps.length} gaps — ${userFacing.length} user-facing/anti-direction · ${nonUserFacing.length} non-user-facing (add to KNOWN_EXCLUDED)`)

return {
  // categorized gap list with section suggestion + isObjectEditor flag
  categorized: gaps,
  userFacing,
  nonUserFacing,
  // provided by the CLI directly — no LLM categorization needed
  removedKeys: detected.removedKeys,
  envGaps: detected.envGaps,
  envRemoved: detected.envRemoved,
  defaultDrift: detected.defaultDrift,
  storageDrift: detected.storageDrift,
  counts: detected.counts,
}
