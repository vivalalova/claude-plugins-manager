/**
 * Meta drift between settings-reference.md and the repo schema for keys both
 * sides already have: schema `default` vs each entry's `**Default**` bullet,
 * `storageFile` vs the index Scope column, and `effectiveScopes` vs the same column, Deprecated／Removed Warnings, and Type enum values.
 */

import { USER_AND_LOCAL_SCOPES, USER_SCOPE_ONLY, childEffectiveScopes } from '../claude-settings-schema';
import type { EffectiveScope, EffectiveScopes, FlatFieldSchema, ValueSchema } from '../claude-settings-schema';

const DETAIL_HEADING_RE = /^###\s+`([^`]+)`\s*$/;
const HEADING_RE = /^#{1,6}\s/;
const FENCE_RE = /^\s*```/;
const DEFAULT_BULLET_RE = /^\*\s+\*\*Default\*\*:\s*(.*)$/;
const TYPE_BULLET_RE = /^\*\s+\*\*Type\*\*:\s*(.*)$/;
const SUB_BULLET_RE = /^\s+\*\s+(.*)$/;
const WARNING_OPEN_RE = /^\s*<Warning>\s*$/;
const WARNING_CLOSE_RE = /^\s*<\/Warning>\s*$/;
const UNSET_RE = /^(unset|none|not locked)\b/i;
const LEADING_LITERAL_RE = /^`([^`]+)`(.*)$/;
const ALTERNATIVE_TAIL_RE = /^,?\s*or\b/;
/** A run of `"value"` literals joined by commas and/or "or". */
const LITERAL_LIST_RE = /^`"[^"`]*"`(?:,?\s+(?:or\s+)?`"[^"`]*"`|,\s*`"[^"`]*"`)*/;
const QUOTED_RE = /`"([^"`]*)"`/g;
const LIST_TAIL_RE = /^($|[.;,:]|\s+which\b)/;

const GLOBAL_CONFIG_SCOPE = 'Global config';

export type DocsWarning = { kind: 'deprecated' | 'removed'; text: string };

export type DocsEntry = {
  default?: string;
  warning?: DocsWarning;
  /** Fixed string values from the `**Type**` bullet; undefined when it is not a parsed string enum. */
  typeOptions?: string[];
  /** The Type also accepts free-form values beyond `typeOptions` (a pattern or `<placeholder>` template). */
  openType?: boolean;
};

function classifyWarning(text: string): DocsWarning | undefined {
  if (/^Removed in\b/.test(text)) return { kind: 'removed', text };
  if (/^Deprecated\b/.test(text)) return { kind: 'deprecated', text };
  return undefined;
}

/** Leading `"a"`, `"b"`, or `"c"` literals of `text`, if the list is all the text says there. */
function leadingLiterals(text: string): string[] | undefined {
  const match = LITERAL_LIST_RE.exec(text);
  if (!match || !LIST_TAIL_RE.test(text.slice(match[0].length))) return undefined;
  return [...match[0].matchAll(QUOTED_RE)].map((m) => m[1]);
}

type TypeParse = { options?: string[]; subBullets: boolean };

/** Formats: `string, one of:` (+ sub-bullets), `string, one of \`"a"\`, …`, `string, \`"a"\` or \`"b"\``, `the string \`"x"\``. */
function parseTypeText(raw: string): TypeParse {
  if (/^string, one of:$/.test(raw)) return { options: [], subBullets: true };
  const single = /^the string `"([^"`]*)"`$/.exec(raw);
  if (single) return { options: [single[1]], subBullets: false };
  const inline = /^string, (?:one of )?(.*)$/.exec(raw);
  const options = inline ? leadingLiterals(inline[1]) : undefined;
  return options ? { options, subBullets: true } : { subBullets: false };
}

type EntryState = {
  entry: DocsEntry;
  sawContent: boolean;
  warningLines: string[] | null;
  type: TypeParse | null;
  inTypeBullet: boolean;
};

function addOptions(entry: DocsEntry, values: string[]): void {
  const options = entry.typeOptions ?? [];
  for (const value of values) {
    if (!value.includes('<') && !options.includes(value)) options.push(value);
  }
  entry.typeOptions = options;
}

/** One record per `### \`key\`` entry: first Default bullet, leading Warning, and Type enum values. */
export function parseSettingsEntries(md: string): Map<string, DocsEntry> {
  const entries = new Map<string, DocsEntry>();
  let state: EntryState | null = null;
  let inFence = false;

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trimEnd();
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      if (state) state.sawContent = true;
      continue;
    }
    if (inFence) continue;

    const heading = DETAIL_HEADING_RE.exec(line);
    if (heading || HEADING_RE.test(line)) {
      state = null;
      if (heading) {
        const entry: DocsEntry = {};
        entries.set(heading[1], entry);
        state = { entry, sawContent: false, warningLines: null, type: null, inTypeBullet: false };
      }
      continue;
    }
    if (!state || line.trim() === '') continue;

    if (state.warningLines) {
      if (WARNING_CLOSE_RE.test(line)) {
        state.entry.warning = classifyWarning(state.warningLines.join(' '));
        state.warningLines = null;
      } else {
        state.warningLines.push(line.trim());
      }
      continue;
    }
    if (!state.sawContent && WARNING_OPEN_RE.test(line)) {
      state.sawContent = true;
      state.warningLines = [];
      continue;
    }
    state.sawContent = true;

    const sub = SUB_BULLET_RE.exec(line);
    if (sub) {
      if (state.inTypeBullet && state.type?.subBullets) {
        const values = leadingLiterals(sub[1]);
        if (!sub[1].startsWith('`"') || values?.some((value) => value.includes('<'))) state.entry.openType = true;
        if (values) addOptions(state.entry, values);
      }
      continue;
    }
    state.inTypeBullet = false;

    const typeBullet = TYPE_BULLET_RE.exec(line);
    if (typeBullet && !state.type) {
      state.type = parseTypeText(typeBullet[1].trim());
      state.inTypeBullet = true;
      if (state.type.options?.length) addOptions(state.entry, state.type.options);
      continue;
    }
    const bullet = DEFAULT_BULLET_RE.exec(line);
    if (bullet && state.entry.default === undefined) {
      state.entry.default = bullet[1].trim();
    }
  }

  for (const entry of entries.values()) {
    if (entry.typeOptions?.length === 0) delete entry.typeOptions;
  }
  return entries;
}

/** False when the md has a Deprecated／Removed Warning block but no entry got a classified warning. */
export function warningParseHealthy(md: string, entries: Map<string, DocsEntry>): boolean {
  const blocks = md.match(/<Warning>[\s\S]*?<\/Warning>/g) ?? [];
  if (!blocks.some((block) => /Removed in|Deprecated/.test(block))) return true;
  return [...entries.values()].some((entry) => entry.warning);
}

/** Drop docs keys whose entry is marked Deprecated／Removed. */
export function excludeDeprecatedGaps(keys: string[], entries: Map<string, DocsEntry>): string[] {
  return keys.filter((key) => !entries.get(key)?.warning);
}

export type DocsDefault =
  | { kind: 'unset' }
  | { kind: 'literal'; value: unknown }
  | { kind: 'conditional' }
  | { kind: 'unparsed' };

/** Interpret a `**Default**` text: unset wording, a JSON literal, "`A`, or `B` when …", or none of these. */
export function parseDocsDefault(raw: string): DocsDefault {
  if (UNSET_RE.test(raw)) return { kind: 'unset' };
  const literal = LEADING_LITERAL_RE.exec(raw);
  if (!literal) return { kind: 'unparsed' };
  let value: unknown;
  try {
    value = JSON.parse(literal[1]);
  } catch {
    return { kind: 'unparsed' };
  }
  return ALTERNATIVE_TAIL_RE.test(literal[2]) ? { kind: 'conditional' } : { kind: 'literal', value };
}

export type DefaultDrift = {
  key: string;
  kind: 'mismatch' | 'repoDefaultDocsUnset' | 'conditional' | 'unparsed';
  docs: string;
  repo: unknown;
};

/** Docs list a nestedUnder key by its prefixed or its bare form; prefer the prefixed one. */
function lookupDocs<T>(key: string, field: FlatFieldSchema, docs: Map<string, T>): [string, T] | undefined {
  const prefixed = field.nestedUnder ? `${field.nestedUnder}.${key}` : undefined;
  if (prefixed !== undefined && docs.has(prefixed)) return [prefixed, docs.get(prefixed) as T];
  return docs.has(key) ? [key, docs.get(key) as T] : undefined;
}

/**
 * Compare non-object flat fields that have a docs entry. `vettedEquivalent`
 * maps a key to the exact docs Default text under which its repo default was
 * judged equivalent to "unset"; any docs rewording resurfaces the key.
 */
export function diffDefaults(
  flatSchemas: Record<string, FlatFieldSchema>,
  docsDefaults: Map<string, string>,
  vettedEquivalent: ReadonlyMap<string, string>,
): DefaultDrift[] {
  const drift: DefaultDrift[] = [];

  for (const [key, field] of Object.entries(flatSchemas)) {
    if (field.valueSchema.kind === 'object') continue;
    const found = lookupDocs(key, field, docsDefaults);
    if (!found) continue;
    const [docsKey, docs] = found;

    const repo: unknown = (field as { default?: unknown }).default;
    const parsed = parseDocsDefault(docs);
    if (parsed.kind === 'unparsed') {
      drift.push({ key: docsKey, kind: 'unparsed', docs, repo });
    } else if (parsed.kind === 'literal') {
      if (JSON.stringify(parsed.value) !== JSON.stringify(repo)) {
        drift.push({ key: docsKey, kind: 'mismatch', docs, repo });
      }
    } else if (parsed.kind === 'conditional') {
      if (repo !== undefined) drift.push({ key: docsKey, kind: 'conditional', docs, repo });
    } else if (repo !== undefined && vettedEquivalent.get(docsKey) !== docs) {
      drift.push({ key: docsKey, kind: 'repoDefaultDocsUnset', docs, repo });
    }
  }

  return drift.sort((a, b) => a.key.localeCompare(b.key));
}

export type StorageDrift = {
  key: string;
  docsScope: string;
  repoStorageFile: FlatFieldSchema['storageFile'];
};

/** Keys whose index Scope and repo `storageFile` disagree about living in `~/.claude.json`. */
export function diffStorage(
  flatSchemas: Record<string, FlatFieldSchema>,
  docsScopes: Map<string, string>,
): StorageDrift[] {
  const drift: StorageDrift[] = [];

  for (const [key, field] of Object.entries(flatSchemas)) {
    const found = lookupDocs(key, field, docsScopes);
    if (!found) continue;
    const [docsKey, docsScope] = found;

    const docsGlobal = docsScope === GLOBAL_CONFIG_SCOPE;
    const repoGlobal = field.storageFile === 'globalConfig';
    if (docsGlobal !== repoGlobal) {
      drift.push({ key: docsKey, docsScope, repoStorageFile: field.storageFile });
    }
  }

  return drift.sort((a, b) => a.key.localeCompare(b.key));
}

export type ScopeDrift = {
  key: string;
  docsScope: string;
  repoEffectiveScopes: EffectiveScopes | undefined;
  kind: 'mismatch' | 'unrecognized';
};

/** Index Scope → expected `effectiveScopes`; `null` = not compared (Managed／Global config). */
const DOCS_SCOPE_TO_EFFECTIVE: ReadonlyMap<string, readonly EffectiveScope[] | undefined | null> = new Map([
  ['Any file', undefined],
  ['User or managed', USER_SCOPE_ONLY],
  ['User, local, or managed', USER_AND_LOCAL_SCOPES],
  ['Managed', null],
  [GLOBAL_CONFIG_SCOPE, null],
]);

function sameScopes(a: EffectiveScopes | undefined, b: EffectiveScopes | undefined): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((scope) => b.includes(scope));
}

/**
 * Keys (flat and object children, by dotted path) whose index Scope and repo
 * `effectiveScopes` disagree; children inherit their nearest ancestor's registration.
 */
export function diffScopes(
  flatSchemas: Record<string, FlatFieldSchema>,
  docsScopes: Map<string, string>,
): ScopeDrift[] {
  const drift = new Map<string, ScopeDrift>();

  const check = (docsKey: string, docsScope: string, repo: EffectiveScopes | undefined): void => {
    if (!DOCS_SCOPE_TO_EFFECTIVE.has(docsScope)) {
      drift.set(docsKey, { key: docsKey, docsScope, repoEffectiveScopes: repo, kind: 'unrecognized' });
      return;
    }
    const expected = DOCS_SCOPE_TO_EFFECTIVE.get(docsScope);
    if (expected === null) return;
    if (!sameScopes(expected, repo)) {
      drift.set(docsKey, { key: docsKey, docsScope, repoEffectiveScopes: repo, kind: 'mismatch' });
    }
  };

  const walk = (prefix: string, schema: ValueSchema, inherited: EffectiveScopes | undefined): void => {
    if (schema.kind !== 'object') return;
    for (const [name, property] of Object.entries(schema.properties)) {
      const path = `${prefix}.${name}`;
      const resolved = childEffectiveScopes(property, inherited);
      const docsScope = docsScopes.get(path);
      if (docsScope !== undefined) check(path, docsScope, resolved);
      walk(path, property.schema, resolved);
    }
  };

  for (const [key, field] of Object.entries(flatSchemas)) {
    const found = lookupDocs(key, field, docsScopes);
    if (found) check(found[0], found[1], field.effectiveScopes);
    walk(key, field.valueSchema, field.effectiveScopes);
  }

  return [...drift.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Visit every flat field and object child by its docs key (flat via lookupDocs, children by dotted path). */
function forEachDocsKey<T>(
  flatSchemas: Record<string, FlatFieldSchema>,
  docs: Map<string, T>,
  visit: (docsKey: string, schema: ValueSchema, docsValue: T) => void,
): void {
  const walk = (prefix: string, schema: ValueSchema): void => {
    if (schema.kind !== 'object') return;
    for (const [name, property] of Object.entries(schema.properties)) {
      const path = `${prefix}.${name}`;
      const docsValue = docs.get(path);
      if (docsValue !== undefined) visit(path, property.schema, docsValue);
      walk(path, property.schema);
    }
  };
  for (const [key, field] of Object.entries(flatSchemas)) {
    const found = lookupDocs(key, field, docs);
    if (found) visit(found[0], field.valueSchema, found[1]);
    walk(key, field.valueSchema);
  }
}

export type DeprecatedSurfaced = { key: string; kind: DocsWarning['kind']; docs: string };

/** Repo keys whose docs entry opens with a Deprecated／Removed in Warning. */
export function diffDeprecated(
  flatSchemas: Record<string, FlatFieldSchema>,
  entries: Map<string, DocsEntry>,
): DeprecatedSurfaced[] {
  const found = new Map<string, DeprecatedSurfaced>();
  forEachDocsKey(flatSchemas, entries, (key, _schema, entry) => {
    if (entry.warning) found.set(key, { key, kind: entry.warning.kind, docs: entry.warning.text });
  });
  return [...found.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export type EnumDrift = {
  key: string;
  kind: 'mismatch' | 'unparsed' | 'repoNotEnum';
  docsOnly: string[];
  repoOnly: string[];
};

/** Repo string fields vs the docs Type enum values. */
export function diffEnumOptions(
  flatSchemas: Record<string, FlatFieldSchema>,
  entries: Map<string, DocsEntry>,
): EnumDrift[] {
  const drift = new Map<string, EnumDrift>();
  forEachDocsKey(flatSchemas, entries, (key, schema, entry) => {
    if (schema.kind !== 'string') return;
    const repo: readonly string[] | undefined = schema.enum;
    const docs = entry.typeOptions;
    if (!repo) {
      if (docs && !entry.openType) drift.set(key, { key, kind: 'repoNotEnum', docsOnly: [...docs], repoOnly: [] });
      return;
    }
    if (!docs) {
      drift.set(key, { key, kind: 'unparsed', docsOnly: [], repoOnly: [...repo] });
      return;
    }
    const docsOnly = docs.filter((value) => !repo.includes(value));
    const repoOnly = entry.openType ? [] : repo.filter((value) => !docs.includes(value));
    if (docsOnly.length || repoOnly.length) drift.set(key, { key, kind: 'mismatch', docsOnly, repoOnly });
  });
  return [...drift.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Repo defaults vetted as equivalent to the docs "unset" behavior, keyed by the
 * exact docs Default text they were checked against (2026-09-23).
 */
export const KNOWN_DEFAULT_EQUIVALENT: ReadonlyMap<string, string> = new Map([
  ['alwaysThinkingEnabled', 'unset, so thinking is on for models that support it'],
  ['autoUpdatesChannel', 'unset, so Claude Code follows `"latest"`'],
  ['awaySummaryEnabled', 'unset, so the recap is on'],
  ['axScreenReader', 'unset, so screen-reader mode is off'],
  ['disableAgentView', 'unset, so agent view is available'],
  ['disableAllHooks', 'unset, so hooks run'],
  ['disableBundledSkills', 'unset, so bundled skills load'],
  ['disableSkillShellExecution', 'unset, so inline shell runs'],
  ['enableAllProjectMcpServers', 'unset, so Claude Code asks you to approve each server'],
  ['env', 'unset'],
  ['fastMode', 'unset, so fast mode is off'],
  ['plansDirectory', 'unset, so Claude Code uses `~/.claude/plans`'],
  ['skipDangerousModePermissionPrompt', 'unset, so the dialog appears'],
  ['skipWebFetchPreflight', 'unset, so the check runs before the first fetch to each hostname in a session'],
]);
