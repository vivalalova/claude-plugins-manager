#!/usr/bin/env npx tsx
/**
 * CLI: fetch live settings.md + env-vars.md from docs, compare against repo schema,
 * and output a JSON report of gaps.
 *
 * Usage:
 *   npx tsx scripts/settings-sync-diff.ts
 *   npx tsx scripts/settings-sync-diff.ts --settings-md ./path/to/settings.md --env-vars-md ./path/to/env-vars.md
 *
 * Exit code:
 *   0 = OK
 *   1 = env-vars health check failed, or fetch error
 */

import { execFile } from 'child_process';
import { readFileSync } from 'fs';
import { promisify } from 'util';

import {
  getAllFlatFieldSchemas,
  type FlatFieldSchema,
  type ObjectValueSchema,
} from '../src/shared/claude-settings-schema';
import {
  parseSettingsDocs,
  parseEnvDocs,
  collectRepoSettingKeys,
  diffKeys,
  checkEnvDocsHealth,
  checkSettingsDocsHealth,
  KNOWN_EXCLUDED,
} from '../src/shared/settings-sync/settings-diff';

const execFileAsync = promisify(execFile);

const SETTINGS_MD_URL = 'https://code.claude.com/docs/en/settings.md';
const ENV_VARS_MD_URL = 'https://code.claude.com/docs/en/env-vars.md';

// ─── CLI argument parsing ──────────────────────────────────────────────────────

function parseArgs(): { settingsMdPath?: string; envVarsMdPath?: string } {
  const args = process.argv.slice(2);
  let settingsMdPath: string | undefined;
  let envVarsMdPath: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--settings-md' && args[i + 1]) {
      settingsMdPath = args[++i];
    } else if (args[i] === '--env-vars-md' && args[i + 1]) {
      envVarsMdPath = args[++i];
    }
  }
  return { settingsMdPath, envVarsMdPath };
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchUrl(url: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('curl', ['-fsSL', '--max-time', '30', url]);
    return stdout;
  } catch (err) {
    throw new Error(`Failed to fetch ${url}: ${String(err)}`);
  }
}

async function loadContent(pathOrUrl: string | undefined, url: string): Promise<string> {
  if (pathOrUrl) {
    return readFileSync(pathOrUrl, 'utf8');
  }
  return fetchUrl(url);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { settingsMdPath, envVarsMdPath } = parseArgs();

  // Load docs content
  const [settingsMd, envVarsMd] = await Promise.all([
    loadContent(settingsMdPath, SETTINGS_MD_URL),
    loadContent(envVarsMdPath, ENV_VARS_MD_URL),
  ]);

  // Parse docs
  const { keys: docsKeys } = parseSettingsDocs(settingsMd);
  const envKeys = parseEnvDocs(envVarsMd);

  // Health check — fail-fast on suspicious settings docs
  const settingsHealth = checkSettingsDocsHealth(docsKeys);
  if (!settingsHealth.ok) {
    console.error(`[settings-sync-diff] settings health check failed: ${settingsHealth.reason}`);
    process.exit(1);
  }

  // Health check — fail-fast on suspicious env-vars
  const health = checkEnvDocsHealth(envKeys);
  if (!health.ok) {
    console.error(`[settings-sync-diff] env-vars health check failed: ${health.reason}`);
    process.exit(1);
  }

  // Collect repo keys from live schema
  const flatSchemas = getAllFlatFieldSchemas() as Record<string, FlatFieldSchema>;
  const objectValueSchemas: Record<string, ObjectValueSchema> = {};
  const repoKeys = collectRepoSettingKeys(flatSchemas, objectValueSchemas);

  // Compute gaps
  const { missing: settingsGaps } = diffKeys(docsKeys, repoKeys, KNOWN_EXCLUDED);

  // env gaps: not applicable in this script (we have no repo env-var registry to diff against)
  const envGaps: string[] = [];

  const result = {
    settingsGaps,
    envGaps,
    counts: {
      docsKeys: docsKeys.size,
      repoKeys: repoKeys.size,
      settingsGaps: settingsGaps.length,
      envKeys: envKeys.size,
    },
    health,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
  console.error('[settings-sync-diff]', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
