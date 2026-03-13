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
    const extendedSchema = { ...CLAUDE_SETTINGS_SCHEMA, testKey: { type: 'string', description: 'test', section: 'general' as const } };
    const extendedKeys = new Set(Object.keys(extendedSchema));
    const extra = [...extendedKeys].filter((k) => !typesKeys.has(k));
    expect(extra).toEqual(['testKey']);
  });
});
