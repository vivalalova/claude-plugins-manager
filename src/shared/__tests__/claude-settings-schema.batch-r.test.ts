/**
 * 批次 R schema 先紅測試
 *
 * 3 個新 scalar setting key 的 flat schema entry（section / default / nestedUnder）
 * ＋ SANDBOX_VALUE_SCHEMA 兩個新 nested boolean property。
 *
 * 全部斷言在執行者補 schema 前應紅。
 *
 * 刻意不走 getSchemaDefault()：該函數對不存在的 key 直接拋錯（fail-fast），
 * 紅因會變成 thrown Error 而非斷言 diff。改為直接讀 flat schema record。
 */
import { describe, it, expect } from 'vitest';
import { getAllFlatFieldSchemas } from '../claude-settings-schema';

interface FlatEntryProbe {
  section?: string;
  default?: unknown;
  nestedUnder?: string;
  valueSchema?: unknown;
}

const flat = getAllFlatFieldSchemas() as unknown as Record<string, FlatEntryProbe | undefined>;

// ---------------------------------------------------------------------------
// 1. scalar keys — section / default / nestedUnder
// ---------------------------------------------------------------------------

describe('批次 R — 新 scalar setting keys 的 flat schema entry（先紅）', () => {
  it('emojiCompletionEnabled：display section、default true、boolean control', () => {
    expect(flat['emojiCompletionEnabled']).toMatchObject({
      section: 'display',
      default: true,
    });
    expect(flat['emojiCompletionEnabled']?.nestedUnder).toBeUndefined();
  });

  it('switchModelsOnFlag：general section、default true、boolean control', () => {
    expect(flat['switchModelsOnFlag']).toMatchObject({
      section: 'general',
      default: true,
    });
    expect(flat['switchModelsOnFlag']?.nestedUnder).toBeUndefined();
  });

  it('defaultEnvironmentId：advanced section、nestedUnder "remote"（寫入 settings.remote.defaultEnvironmentId）', () => {
    // nestedUnder 漏加 → UI 會寫到 settings.defaultEnvironmentId 頂層，CLI 讀不到（silent bug）
    expect(flat['defaultEnvironmentId']).toMatchObject({
      section: 'advanced',
      nestedUnder: 'remote',
    });
  });
});

// ---------------------------------------------------------------------------
// 2. sandbox nested object schema 新 property
// ---------------------------------------------------------------------------
//
// SANDBOX_VALUE_SCHEMA 未 export，透過 flat entry 的 valueSchema 走訪：
// objectValue → { kind: 'object', properties: { <name>: { schema, optional } } }

interface ObjectSchemaProbe {
  kind?: string;
  properties?: Record<string, { schema?: ObjectSchemaProbe; optional?: boolean } | undefined>;
}

function sandboxProperty(path: string[]): { schema?: ObjectSchemaProbe; optional?: boolean } | undefined {
  let node = flat['sandbox']?.valueSchema as ObjectSchemaProbe | undefined;
  let entry: { schema?: ObjectSchemaProbe; optional?: boolean } | undefined;
  for (const name of path) {
    entry = node?.properties?.[name];
    node = entry?.schema;
  }
  return entry;
}

describe('批次 R — SANDBOX_VALUE_SCHEMA 新 nested boolean property（先紅）', () => {
  it('sandbox schema 本身是 object kind（前提檢查）', () => {
    expect((flat['sandbox']?.valueSchema as ObjectSchemaProbe | undefined)?.kind).toBe('object');
  });

  it('filesystem.disabled 存在且為 optional boolean', () => {
    const entry = sandboxProperty(['filesystem', 'disabled']);
    expect(entry).toBeDefined();
    expect(entry?.optional).toBe(true);
    expect(entry?.schema?.kind).toBe('boolean');
  });

  it('network.strictAllowlist 存在且為 optional boolean', () => {
    const entry = sandboxProperty(['network', 'strictAllowlist']);
    expect(entry).toBeDefined();
    expect(entry?.optional).toBe(true);
    expect(entry?.schema?.kind).toBe('boolean');
  });
});
