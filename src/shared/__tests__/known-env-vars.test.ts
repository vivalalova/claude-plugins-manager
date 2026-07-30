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
        expect(entry.name).toMatch(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|HEADERS|CERT|PASSPHRASE/i);
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

  it('covers newly documented env vars with category/type metadata', () => {
    expect(getKnownEnvVar('ANTHROPIC_AWS_API_KEY')).toMatchObject({
      category: 'provider',
      valueType: String,
      sensitive: true,
    });
    expect(getKnownEnvVar('CLAUDE_CODE_SESSION_ID')).toMatchObject({
      category: 'shell',
      valueType: String,
    });
    expect(getKnownEnvVar('OTEL_METRICS_INCLUDE_ENTRYPOINT')).toMatchObject({
      category: 'telemetry',
      valueType: Boolean,
    });
    expect(getKnownEnvVar('MCP_CONNECT_TIMEOUT_MS')).toMatchObject({
      category: 'timeout',
      valueType: Number,
    });
    expect(getKnownEnvVar('CLAUDE_CODE_HIDE_CWD')).toMatchObject({
      category: 'ui',
      valueType: Boolean,
    });
    expect(getKnownEnvVar('CLAUDE_CLIENT_PRESENCE_FILE')).toMatchObject({
      category: 'feature',
      valueType: String,
    });
  });

  it('BASH_MAX_TIMEOUT_MS default matches official docs (600000, not 3600000)', () => {
    expect(getKnownEnvVar('BASH_MAX_TIMEOUT_MS')?.default).toBe('600000');
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

// ─── 批次 R：3 個新 env var ────────────────────────────────────────────────────
//
// 先紅測試：這 3 個 var 尚未加進 KNOWN_ENV_VARS。
// 斷言 registry metadata（valueType / category / default）。
// i18n description key 由 batch-r-i18n.test.ts 覆蓋。

describe('批次 R — 新增 env var registry entries（先紅）', () => {
  it('CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS：Number / limits / default 20', () => {
    expect(getKnownEnvVar('CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS')).toMatchObject({
      name: 'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',
      valueType: Number,
      category: 'limits',
      default: '20',
    });
  });

  it('CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH：Number / limits / default 3', () => {
    expect(getKnownEnvVar('CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH')).toMatchObject({
      name: 'CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH',
      valueType: Number,
      category: 'limits',
      default: '3',
    });
  });

  it('VERTEX_REGION_CLAUDE_5_OPUS：String，category 與既有 VERTEX_REGION_* 一致', () => {
    // category 不寫死字面值：以既有 VERTEX_REGION_* entry 為權威來源（single source of truth）
    const siblingCategory = getKnownEnvVar('VERTEX_REGION_CLAUDE_4_6_OPUS')?.category;
    expect(siblingCategory).toBeTruthy();
    expect(getKnownEnvVar('VERTEX_REGION_CLAUDE_5_OPUS')).toMatchObject({
      name: 'VERTEX_REGION_CLAUDE_5_OPUS',
      valueType: String,
      category: siblingCategory,
    });
  });
});
