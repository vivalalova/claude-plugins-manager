/**
 * Known Claude Code environment variables registry — thin wrapper over JSON data.
 * Canonical data: known-env-vars.json
 * Source: https://code.claude.com/docs/en/env-vars
 * 同步維護：sync-settings-options skill Phase 1d
 */

import envVarData from './known-env-vars.json';

export type EnvVarCategory = 'model' | 'auth' | 'effort' | 'timeout' | 'feature' | 'telemetry';
export type EnvVarValueType = 'string' | 'number' | 'boolean';

export interface KnownEnvVar {
  name: string;
  valueType: EnvVarValueType;
  category: EnvVarCategory;
  default?: string;
  sensitive?: boolean;
}

// Build typed record from JSON, injecting `name` from key
export const KNOWN_ENV_VARS: Record<string, KnownEnvVar> = Object.fromEntries(
  Object.entries(envVarData).map(([key, val]) => [
    key,
    { ...val, name: key } as KnownEnvVar,
  ]),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getKnownEnvVar(name: string): KnownEnvVar | undefined {
  return KNOWN_ENV_VARS[name];
}

export const CATEGORY_ORDER: EnvVarCategory[] = ['model', 'auth', 'effort', 'timeout', 'feature', 'telemetry'];

export function getKnownEnvVarsByCategory(): Map<EnvVarCategory, KnownEnvVar[]> {
  const map = new Map<EnvVarCategory, KnownEnvVar[]>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, []);
  }
  for (const v of Object.values(KNOWN_ENV_VARS)) {
    map.get(v.category)!.push(v);
  }
  return map;
}

const VALUE_TYPE_ORDER: EnvVarValueType[] = ['boolean', 'number', 'string'];

export function getKnownEnvVarsByValueType(): Map<EnvVarValueType, KnownEnvVar[]> {
  const map = new Map<EnvVarValueType, KnownEnvVar[]>();
  for (const vt of VALUE_TYPE_ORDER) {
    map.set(vt, []);
  }
  for (const v of Object.values(KNOWN_ENV_VARS)) {
    map.get(v.valueType)!.push(v);
  }
  return map;
}

let _cachedNames: string[] | null = null;

export function getKnownEnvVarNames(): string[] {
  if (!_cachedNames) {
    _cachedNames = Object.keys(KNOWN_ENV_VARS).sort();
  }
  return _cachedNames;
}
