import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CLAUDE_SETTINGS_SCHEMA } from '../claude-settings-schema';

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
  const schemaKeys = new Set(Object.keys(CLAUDE_SETTINGS_SCHEMA));

  it('schema 包含 ClaudeSettings 所有欄位', () => {
    const missing = [...typesKeys].filter((k) => !schemaKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('schema 不含 ClaudeSettings 以外的多餘欄位', () => {
    const extra = [...schemaKeys].filter((k) => !typesKeys.has(k));
    expect(extra).toEqual([]);
  });

  it('每個 schema entry 都有 type、description、section', () => {
    for (const [key, field] of Object.entries(CLAUDE_SETTINGS_SCHEMA)) {
      expect(field.type, `${key}.type`).toBeTruthy();
      expect(field.description, `${key}.description`).toBeTruthy();
      expect(field.section, `${key}.section`).toBeTruthy();
    }
  });

  it('schema 新增 key → 測試偵測到 drift', () => {
    // 模擬新增一個 schema key，驗證 diff 機制有效
    const extendedSchema = { ...CLAUDE_SETTINGS_SCHEMA, testKey: { type: 'string', description: 'test', section: 'general' as const, controlType: 'text' as const } };
    const extendedKeys = new Set(Object.keys(extendedSchema));
    const extra = [...extendedKeys].filter((k) => !typesKeys.has(k));
    expect(extra).toEqual(['testKey']);
  });

  it('每個 schema entry 都有 controlType', () => {
    for (const [key, field] of Object.entries(CLAUDE_SETTINGS_SCHEMA)) {
      expect(field.controlType, `${key} 缺少 controlType`).toBeTruthy();
    }
  });

  it('controlType 為 enum 的 entry 必須有 options 陣列', () => {
    for (const [key, field] of Object.entries(CLAUDE_SETTINGS_SCHEMA)) {
      if (field.controlType === 'enum') {
        expect(Array.isArray(field.options), `${key} controlType=enum 但缺少 options`).toBe(true);
        expect(field.options!.length, `${key} options 不可為空`).toBeGreaterThan(0);
      }
    }
  });

  it('controlType 非 enum 的 entry 不應有 options', () => {
    for (const [key, field] of Object.entries(CLAUDE_SETTINGS_SCHEMA)) {
      if (field.controlType !== 'enum') {
        expect(field.options, `${key} controlType=${field.controlType} 不應有 options`).toBeUndefined();
      }
    }
  });

  it('number 欄位的 min <= max', () => {
    for (const [key, field] of Object.entries(CLAUDE_SETTINGS_SCHEMA)) {
      if (field.min !== undefined && field.max !== undefined) {
        expect(field.min, `${key} min(${field.min}) > max(${field.max})`).toBeLessThanOrEqual(field.max);
      }
    }
  });

  it('min/max/step 只出現在 controlType=number', () => {
    for (const [key, field] of Object.entries(CLAUDE_SETTINGS_SCHEMA)) {
      if (field.controlType !== 'number') {
        expect(field.min, `${key} 非 number 不應有 min`).toBeUndefined();
        expect(field.max, `${key} 非 number 不應有 max`).toBeUndefined();
        expect(field.step, `${key} 非 number 不應有 step`).toBeUndefined();
      }
    }
  });
});
