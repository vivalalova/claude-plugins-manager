/**
 * SchemaSection — isFieldVisibleForScope / getSchemaFieldBindings scope 過濾測試。
 * 純函式測試，不 render、不需要 jsdom。
 * 驗證 storageFile='globalConfig' 欄位（如 autoConnectIde）只在 scope='user' 可見，
 * project/local scope 完全不渲染、不計入 customized 數量。
 */
import { describe, it, expect } from 'vitest';
import { getFlatFieldSchema } from '../../../../../shared/claude-settings-schema';
import { isFieldVisibleForScope, getSchemaFieldBindings, drillParents } from '../SchemaSection';

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
      onSaveNested: async () => {},
      onDeleteNested: async () => {},
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
      onSaveNested: async () => {},
      onDeleteNested: async () => {},
    });
    expect(result).not.toBeNull();
    expect(result?.value).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// #24 — effectiveScopes 登錄擴充 isFieldVisibleForScope / getSchemaFieldBindings
// ---------------------------------------------------------------------------

describe('isFieldVisibleForScope — #24 effectiveScopes 登錄', () => {
  it('dialogExpiry（USER_SCOPE_ONLY）→ user 可見，project／local 不可見', () => {
    const schema = getFlatFieldSchema('dialogExpiry')!;
    expect(isFieldVisibleForScope(schema, 'user')).toBe(true);
    expect(isFieldVisibleForScope(schema, 'project')).toBe(false);
    expect(isFieldVisibleForScope(schema, 'local')).toBe(false);
  });

  it('useAutoModeDuringPlan（USER_AND_LOCAL_SCOPES）→ user／local 可見，project 不可見', () => {
    const schema = getFlatFieldSchema('useAutoModeDuringPlan')!;
    expect(isFieldVisibleForScope(schema, 'user')).toBe(true);
    expect(isFieldVisibleForScope(schema, 'project')).toBe(false);
    expect(isFieldVisibleForScope(schema, 'local')).toBe(true);
  });

  it('（回歸錨）model 未登錄 effectiveScopes → 三個 scope 皆可見，行為不受本次改動影響', () => {
    const schema = getFlatFieldSchema('model')!;
    expect(isFieldVisibleForScope(schema, 'user')).toBe(true);
    expect(isFieldVisibleForScope(schema, 'project')).toBe(true);
    expect(isFieldVisibleForScope(schema, 'local')).toBe(true);
  });

  it('（回歸錨）autoConnectIde（globalConfig 機制，非 effectiveScopes）→ 行為不受本次改動影響', () => {
    const schema = getFlatFieldSchema('autoConnectIde')!;
    expect(isFieldVisibleForScope(schema, 'user')).toBe(true);
    expect(isFieldVisibleForScope(schema, 'project')).toBe(false);
    expect(isFieldVisibleForScope(schema, 'local')).toBe(false);
  });
});

describe('getSchemaFieldBindings — #24 effectiveScopes 過濾', () => {
  it('scope=project → dialogExpiry 回傳 null', () => {
    const result = getSchemaFieldBindings('dialogExpiry', {
      scope: 'project',
      settings: { dialogExpiry: '10m' } as any,
      parentSettings: {},
      onSave: async () => {},
      onDelete: async () => {},
      onSaveNested: async () => {},
      onDeleteNested: async () => {},
    });
    expect(result).toBeNull();
  });

  it('scope=local → dialogExpiry 回傳 null（user-only，local 也不生效）', () => {
    const result = getSchemaFieldBindings('dialogExpiry', {
      scope: 'local',
      settings: { dialogExpiry: '10m' } as any,
      parentSettings: {},
      onSave: async () => {},
      onDelete: async () => {},
      onSaveNested: async () => {},
      onDeleteNested: async () => {},
    });
    expect(result).toBeNull();
  });

  it('scope=local → useAutoModeDuringPlan 回傳非 null（user+local 生效）', () => {
    const result = getSchemaFieldBindings('useAutoModeDuringPlan', {
      scope: 'local',
      settings: { useAutoModeDuringPlan: false } as any,
      parentSettings: {},
      onSave: async () => {},
      onDelete: async () => {},
      onSaveNested: async () => {},
      onDeleteNested: async () => {},
    });
    expect(result).not.toBeNull();
    expect(result?.value).toBe(false);
  });

  it('scope=project → useAutoModeDuringPlan 回傳 null（project 不生效）', () => {
    const result = getSchemaFieldBindings('useAutoModeDuringPlan', {
      scope: 'project',
      settings: { useAutoModeDuringPlan: false } as any,
      parentSettings: {},
      onSave: async () => {},
      onDelete: async () => {},
      onSaveNested: async () => {},
      onDeleteNested: async () => {},
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// #26 — drillParents：parentSettings undefined 維持未知，不能被 `?? {}` 抹成已知空物件
// ---------------------------------------------------------------------------

describe('drillParents — #26', () => {
  it('parentSettings=undefined → 回傳 undefined（維持未知，非 {}）', () => {
    expect(drillParents(undefined, 'attribution')).toBeUndefined();
  });
});
