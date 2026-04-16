import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CLAUDE_SETTINGS_SCHEMA, SETTINGS_FLAT_SCHEMA, getSchemaDefault, getSchemaEnumOptions } from '../claude-settings-schema';

const TYPES_PATH = join(__dirname, '..', 'types.ts');

/** 從 types.ts 解析 ClaudeSettings interface 的第一層欄位名稱 */
function parseClaudeSettingsKeys(): Set<string> {
  const source = readFileSync(TYPES_PATH, 'utf-8');
  const interfaceMatch = source.match(/export\s+interface\s+ClaudeSettings\s*\{([\s\S]*?)^\}/m);
  if (!interfaceMatch) throw new Error('ClaudeSettings interface not found');

  const keys = new Set<string>();
  const fieldRegex = /^ {2}(\w+)\??:/gm;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(interfaceMatch[1])) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

describe('claude-settings-schema', () => {
  const typesKeys = parseClaudeSettingsKeys();
  const schemaKeys = new Set(Object.keys(SETTINGS_FLAT_SCHEMA));

  it('schema 包含 ClaudeSettings 所有欄位', () => {
    const missing = [...typesKeys].filter((k) => !schemaKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('schema 不含 ClaudeSettings 以外的多餘欄位（nestedUnder 欄位除外）', () => {
    // nestedUnder 欄位（如 defaultMode）位於父物件內，不是頂層 ClaudeSettings key
    const extra = [...schemaKeys].filter((k) => !typesKeys.has(k) && !SETTINGS_FLAT_SCHEMA[k]?.nestedUnder);
    expect(extra).toEqual([]);
  });

  it('每個 schema entry 都有 section', () => {
    for (const [key, field] of Object.entries(SETTINGS_FLAT_SCHEMA)) {
      expect(field.section, `${key}.section`).toBeTruthy();
    }
  });

  it('schema 新增 key → 測試偵測到 drift（nestedUnder 欄位除外）', () => {
    const extendedFlat = { ...SETTINGS_FLAT_SCHEMA, testKey: { section: 'general' as const, controlType: String } };
    const extendedKeys = new Set(Object.keys(extendedFlat));
    const extra = [...extendedKeys].filter((k) => !typesKeys.has(k) && !extendedFlat[k]?.nestedUnder);
    expect(extra).toEqual(['testKey']);
  });

  it('每個 schema entry 都有 controlType', () => {
    for (const [key, field] of Object.entries(SETTINGS_FLAT_SCHEMA)) {
      expect(field.controlType, `${key} 缺少 controlType`).toBeTruthy();
    }
  });

  it('String + options 的 entry 必須有非空 options 陣列', () => {
    for (const [key, field] of Object.entries(SETTINGS_FLAT_SCHEMA)) {
      if (field.controlType === String && field.options) {
        expect(field.options.length, `${key} options 不可為空`).toBeGreaterThan(0);
      }
    }
  });

  it('非 String 的 entry 不應有 options', () => {
    for (const [key, field] of Object.entries(SETTINGS_FLAT_SCHEMA)) {
      if (field.controlType !== String) {
        expect(field.options, `${key} controlType=${field.controlType.name} 不應有 options`).toBeUndefined();
      }
    }
  });

  it('number 欄位的 min <= max', () => {
    for (const [key, field] of Object.entries(SETTINGS_FLAT_SCHEMA)) {
      if (field.min !== undefined && field.max !== undefined) {
        expect(field.min, `${key} min(${field.min}) > max(${field.max})`).toBeLessThanOrEqual(field.max);
      }
    }
  });

  it('min/max/step 只出現在 controlType=Number', () => {
    for (const [key, field] of Object.entries(SETTINGS_FLAT_SCHEMA)) {
      if (field.controlType !== Number) {
        expect(field.min, `${key} 非 Number 不應有 min`).toBeUndefined();
        expect(field.max, `${key} 非 Number 不應有 max`).toBeUndefined();
        expect(field.step, `${key} 非 Number 不應有 step`).toBeUndefined();
      }
    }
  });

  it('controlType 值屬於合法 ControlType', () => {
    const validControlTypes = [String, Number, Boolean, Array, Object];
    for (const [key, field] of Object.entries(SETTINGS_FLAT_SCHEMA)) {
      expect(
        validControlTypes.includes(field.controlType),
        `${key} 的 controlType 不是合法值`,
      ).toBe(true);
    }
  });

  it('section 值屬於合法 SettingsSection', () => {
    const validSections = ['general', 'display', 'advanced', 'permissions', 'env', 'hooks'];
    for (const [key, field] of Object.entries(SETTINGS_FLAT_SCHEMA)) {
      expect(
        validSections.includes(field.section),
        `${key} 的 section "${field.section}" 不是合法值`,
      ).toBe(true);
    }
  });
});

describe('getSchemaEnumOptions', () => {
  it('回傳已知 enum key 的 options', () => {
    expect(getSchemaEnumOptions('effortLevel')).toEqual(['high', 'medium', 'low']);
    expect(getSchemaEnumOptions('autoUpdatesChannel')).toEqual(['stable', 'latest']);
    expect(getSchemaEnumOptions('teammateMode')).toEqual(['auto', 'in-process', 'tmux']);
    expect(getSchemaEnumOptions('forceLoginMethod')).toEqual(['claudeai', 'console']);
  });

  it('不存在的 key → 拋出 Error', () => {
    expect(() => getSchemaEnumOptions('nonExistent')).toThrow('not found');
  });

  it('非 enum 的 key → 拋出 Error', () => {
    expect(() => getSchemaEnumOptions('model')).toThrow('not an enum');
  });
});

describe('getSchemaDefault', () => {
  it('有 default 的 key 回傳正確值', () => {
    expect(getSchemaDefault('fastMode')).toBe(false);
    expect(getSchemaDefault('autoMemoryEnabled')).toBe(true);
    expect(getSchemaDefault('effortLevel')).toBe('high');
    expect(getSchemaDefault('cleanupPeriodDays')).toBe(30);
    expect(getSchemaDefault('plansDirectory')).toBe('~/.claude/plans');
    expect(getSchemaDefault('prefersReducedMotion')).toBe(false);
    expect(getSchemaDefault('teammateMode')).toBe('auto');
  });

  it('無 default 的 key 回傳 undefined', () => {
    expect(getSchemaDefault('model')).toBeUndefined();
    expect(getSchemaDefault('language')).toBeUndefined();
  });

  it('不存在的 key → 拋出 Error', () => {
    expect(() => getSchemaDefault('nonExistent')).toThrow('not found');
  });

  it('所有 Boolean entry 都有 default 值', () => {
    for (const [key, field] of Object.entries(SETTINGS_FLAT_SCHEMA)) {
      if (field.controlType === Boolean) {
        expect(field.default, `${key} Boolean entry 缺少 default`).not.toBeUndefined();
        expect(typeof field.default, `${key} default 應為 boolean`).toBe('boolean');
      }
    }
  });

  it('String + options 的 default 值在 options 中', () => {
    for (const [key, field] of Object.entries(SETTINGS_FLAT_SCHEMA)) {
      if (field.controlType === String && field.options && field.default !== undefined) {
        expect(field.options).toContain(field.default);
      }
    }
  });
});
