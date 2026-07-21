/**
 * SchemaSection — isFieldVisibleForScope / getSchemaFieldBindings scope 過濾測試。
 * 純函式測試，不 render、不需要 jsdom。
 * 驗證 storageFile='globalConfig' 欄位（如 autoConnectIde）只在 scope='user' 可見，
 * project/local scope 完全不渲染、不計入 customized 數量。
 */
import { describe, it, expect } from 'vitest';
import { getFlatFieldSchema } from '../../../../../shared/claude-settings-schema';
import { isFieldVisibleForScope, getSchemaFieldBindings } from '../SchemaSection';

describe('isFieldVisibleForScope', () => {
  it('storageFile=globalConfig 欄位（autoConnectIde）→ 只在 scope=user 可見', () => {
    const schema = getFlatFieldSchema('autoConnectIde')!;
    expect(isFieldVisibleForScope(schema, 'user')).toBe(true);
    expect(isFieldVisibleForScope(schema, 'project')).toBe(false);
    expect(isFieldVisibleForScope(schema, 'local')).toBe(false);
  });

  it('非 globalConfig 欄位（model）→ 三個 scope 皆可見', () => {
    const schema = getFlatFieldSchema('model')!;
    expect(isFieldVisibleForScope(schema, 'user')).toBe(true);
    expect(isFieldVisibleForScope(schema, 'project')).toBe(true);
    expect(isFieldVisibleForScope(schema, 'local')).toBe(true);
  });
});

describe('getSchemaFieldBindings — scope 過濾', () => {
  it('scope=project → globalConfig 欄位（autoConnectIde）回傳 null（完全不渲染）', () => {
    const result = getSchemaFieldBindings('autoConnectIde', {
      scope: 'project',
      settings: { autoConnectIde: true } as any,
      parentSettings: {},
      onSave: async () => {},
      onDelete: async () => {},
    });
    expect(result).toBeNull();
  });

  it('scope=user → globalConfig 欄位回傳非 null，value 正確', () => {
    const result = getSchemaFieldBindings('autoConnectIde', {
      scope: 'user',
      settings: { autoConnectIde: true } as any,
      parentSettings: {},
      onSave: async () => {},
      onDelete: async () => {},
    });
    expect(result).not.toBeNull();
    expect(result?.value).toBe(true);
  });
});
