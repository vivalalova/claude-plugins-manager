import { describe, expect, it } from 'vitest';
import {
  KNOWN_ENV_VARS,
  CATEGORY_ORDER,
  getKnownEnvVar,
  getKnownEnvVarNames,
  getKnownEnvVarsByCategory,
  type EnvVarCategory,
  type EnvVarValueType,
} from '../known-env-vars';

const VALID_CATEGORIES: EnvVarCategory[] = CATEGORY_ORDER;
const VALID_VALUE_TYPES: EnvVarValueType[] = [String, Number, Boolean];

describe('KNOWN_ENV_VARS registry', () => {
  it('is non-empty', () => {
    expect(Object.keys(KNOWN_ENV_VARS).length).toBeGreaterThan(0);
  });

  it('every entry has required fields with valid values', () => {
    for (const [key, entry] of Object.entries(KNOWN_ENV_VARS)) {
      expect(entry.name).toBe(key);
      expect(VALID_CATEGORIES).toContain(entry.category);
      expect(VALID_VALUE_TYPES).toContain(entry.valueType);
    }
  });

  it('key matches UPPER_CASE pattern', () => {
    for (const key of Object.keys(KNOWN_ENV_VARS)) {
      expect(key).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  it('no duplicate names', () => {
    const names = Object.values(KNOWN_ENV_VARS).map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('sensitive flag only on auth-like keys', () => {
    for (const entry of Object.values(KNOWN_ENV_VARS)) {
      if (entry.sensitive) {
        expect(entry.name).toMatch(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|HEADERS/i);
      }
    }
  });
});

describe('getKnownEnvVar()', () => {
  it('returns entry for known var', () => {
    const result = getKnownEnvVar('ANTHROPIC_MODEL');
    expect(result).toBeDefined();
    expect(result!.category).toBe('model');
  });

  it('returns undefined for unknown var', () => {
    expect(getKnownEnvVar('NOT_A_REAL_VAR')).toBeUndefined();
  });
});

describe('getKnownEnvVarsByCategory()', () => {
  it('returns all categories', () => {
    const map = getKnownEnvVarsByCategory();
    for (const cat of VALID_CATEGORIES) {
      expect(map.has(cat)).toBe(true);
    }
  });

  it('every category has at least one entry', () => {
    const map = getKnownEnvVarsByCategory();
    for (const [, entries] of map) {
      expect(entries.length).toBeGreaterThan(0);
    }
  });

  it('total entries equals registry size', () => {
    const map = getKnownEnvVarsByCategory();
    let total = 0;
    for (const entries of map.values()) {
      total += entries.length;
    }
    expect(total).toBe(Object.keys(KNOWN_ENV_VARS).length);
  });
});

describe('getKnownEnvVarNames()', () => {
  it('returns sorted list', () => {
    const names = getKnownEnvVarNames();
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('length matches registry size', () => {
    expect(getKnownEnvVarNames().length).toBe(Object.keys(KNOWN_ENV_VARS).length);
  });
});
