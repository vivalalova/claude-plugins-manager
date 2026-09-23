/**
 * Meta drift between settings-reference.md and the repo schema for keys both
 * sides already have: schema `default` vs each entry's `**Default**` bullet,
 * and `storageFile` vs the index Scope column.
 */

import type { FlatFieldSchema } from '../claude-settings-schema';

const DETAIL_HEADING_RE = /^###\s+`([^`]+)`\s*$/;
const HEADING_RE = /^#{1,6}\s/;
const FENCE_RE = /^\s*```/;
const DEFAULT_BULLET_RE = /^\*\s+\*\*Default\*\*:\s*(.*)$/;
const UNSET_RE = /^(unset|none|not locked)\b/i;
const LEADING_LITERAL_RE = /^`([^`]+)`(.*)$/;
const ALTERNATIVE_TAIL_RE = /^,?\s*or\b/;

const GLOBAL_CONFIG_SCOPE = 'Global config';

/** Map each `### \`key\`` entry to the raw text of its first `**Default**` bullet. */
export function parseSettingsDetails(md: string): Map<string, string> {
  const defaults = new Map<string, string>();
  let current: string | null = null;
  let inFence = false;

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trimEnd();
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = DETAIL_HEADING_RE.exec(line);
    if (heading) {
      current = heading[1];
      continue;
    }
    if (HEADING_RE.test(line)) {
      current = null;
      continue;
    }

    const bullet = current ? DEFAULT_BULLET_RE.exec(line) : null;
    if (current && bullet && !defaults.has(current)) {
      defaults.set(current, bullet[1].trim());
    }
  }

  return defaults;
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

/**
 * Repo defaults vetted as equivalent to the docs "unset" behavior, keyed by the
 * exact docs Default text they were checked against (2026-09-23).
 */
export const KNOWN_DEFAULT_EQUIVALENT: ReadonlyMap<string, string> = new Map([
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
