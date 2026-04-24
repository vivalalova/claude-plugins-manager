import { describe, it, expect } from 'vitest';
import type { ClaudeSettings, HookCommand } from '../claude-settings-schema';
import {
  CLAUDE_SETTINGS_SCHEMA,
  getAllFlatFieldSchemas,
  getSchemaDefault,
  getSchemaEnumOptions,
  SETTINGS_SECTION_KEYS,
  getSettingsSections,
  getValueSchemaEnumOptions,
  getValueSchemaNumberMeta,
} from '../claude-settings-schema';

type Assert<T extends true> = T;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type _ClaudeSettingsCompileTimeChecks = [
  Assert<IsEqual<ClaudeSettings['viewMode'], 'default' | 'verbose' | 'focus' | undefined>>,
  Assert<IsEqual<ClaudeSettings['forceLoginOrgUUID'], string | string[] | undefined>>,
  Assert<IsEqual<NonNullable<ClaudeSettings['permissions']>['disableBypassPermissionsMode'], 'disable' | undefined>>,
  Assert<IsEqual<NonNullable<ClaudeSettings['spinnerVerbs']>['verbs'], string[]>>,
  Assert<IsEqual<NonNullable<ClaudeSettings['companyAnnouncements']>, string[]>>,
  Assert<IsEqual<ClaudeSettings['hooks'], Record<string, Array<{ matcher?: string; hooks: HookCommand[] }>> | undefined>>,
];

const flatSchema = getAllFlatFieldSchemas();

describe('claude-settings-schema', () => {
  const schemaKeys = new Set(Object.keys(flatSchema));
  const topLevelKeys = Object.entries(flatSchema)
    .filter(([, field]) => field.nestedUnder === undefined)
    .map(([key]) => key);

  it('top-level setting keys 不重複（nestedUnder 欄位除外）', () => {
    expect(new Set(topLevelKeys).size).toBe(topLevelKeys.length);
  });

  it('top-level schema keys 與 type source map keys 一致', () => {
    expect(topLevelKeys).not.toContain('defaultMode');
    expect(topLevelKeys).toContain('permissions');
    expect(topLevelKeys).toContain('hooks');
    expect(topLevelKeys).toContain('worktree');
  });

  it('每個 schema entry 都有 section', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      expect(field.section, `${key}.section`).toBeTruthy();
    }
  });

  it('nestedUnder key 對應到父物件中的同名 property', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      if (!field.nestedUnder) continue;
      const parent = flatSchema[field.nestedUnder];
      expect(parent, `${key} nestedUnder parent not found`).toBeTruthy();
      expect(parent.valueSchema.kind, `${key} parent must be object`).toBe('object');
      if (parent.valueSchema.kind === 'object') {
        expect(parent.valueSchema.properties[key], `${key} missing in parent object schema`).toBeTruthy();
      }
    }
  });

  it('每個 schema entry 都有 valueSchema 與 controlType', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      expect(field.valueSchema, `${key} 缺少 valueSchema`).toBeTruthy();
      expect(field.controlType, `${key} 缺少 controlType`).toBeTruthy();
    }
  });

  it('String + options 的 entry 必須有非空 options 陣列', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      const enumValues = getValueSchemaEnumOptions(field.valueSchema);
      if (field.controlType === String && enumValues) {
        expect(enumValues.length, `${key} options 不可為空`).toBeGreaterThan(0);
      }
    }
  });

  it('非 String 的 entry 不應有 options', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      if (field.controlType !== String) {
        expect(getValueSchemaEnumOptions(field.valueSchema), `${key} controlType=${field.controlType.name} 不應有 options`).toBeUndefined();
      }
    }
  });

  it('number 欄位的 min <= max', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      const numberMeta = getValueSchemaNumberMeta(field.valueSchema);
      if (numberMeta?.min !== undefined && numberMeta.max !== undefined) {
        expect(numberMeta.min, `${key} min(${numberMeta.min}) > max(${numberMeta.max})`).toBeLessThanOrEqual(numberMeta.max);
      }
    }
  });

  it('min/max/step 只出現在 controlType=Number', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      if (field.controlType !== Number) {
        const numberMeta = getValueSchemaNumberMeta(field.valueSchema);
        expect(numberMeta?.min, `${key} 非 Number 不應有 min`).toBeUndefined();
        expect(numberMeta?.max, `${key} 非 Number 不應有 max`).toBeUndefined();
        expect(numberMeta?.step, `${key} 非 Number 不應有 step`).toBeUndefined();
      }
    }
  });

  it('controlType 值屬於合法 ControlType', () => {
    const validControlTypes = [String, Number, Boolean, Array, Object];
    for (const [key, field] of Object.entries(flatSchema)) {
      expect(
        validControlTypes.includes(field.controlType),
        `${key} 的 controlType 不是合法值`,
      ).toBe(true);
    }
  });

  it('section 值屬於合法 SettingsSection', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      expect(
        SETTINGS_SECTION_KEYS.includes(field.section),
        `${key} 的 section "${field.section}" 不是合法值`,
      ).toBe(true);
    }
  });

  it('settings section 順序直接來自 schema 宣告順序', () => {
    expect(getSettingsSections()).toEqual(SETTINGS_SECTION_KEYS);
    expect(getSettingsSections()).toEqual(Object.keys(CLAUDE_SETTINGS_SCHEMA));
  });

  it('controlType 預設由 valueSchema 推導，僅少數欄位保留 override', () => {
    expect(flatSchema.effortLevel?.controlType).toBe(String);
    expect(flatSchema.cleanupPeriodDays?.controlType).toBe(Number);
    expect(flatSchema.permissions?.controlType).toBe(Object);
    expect(flatSchema.availableModels?.controlType).toBe(Array);

    // Override: array/union 欄位刻意用 custom renderer 或 string selector
    expect(flatSchema.companyAnnouncements?.valueSchema.kind).toBe('array');
    expect(flatSchema.companyAnnouncements?.controlType).toBe(Object);
    expect(flatSchema.forceLoginOrgUUID?.valueSchema.kind).toBe('union');
    expect(flatSchema.forceLoginOrgUUID?.controlType).toBe(String);
  });
});

describe('getSchemaEnumOptions', () => {
  it('回傳已知 enum key 的 options', () => {
    expect(getSchemaEnumOptions('effortLevel')).toEqual(['xhigh', 'high', 'medium', 'low']);
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
    for (const [key, field] of Object.entries(flatSchema)) {
      if (field.controlType === Boolean) {
        expect(field.default, `${key} Boolean entry 缺少 default`).not.toBeUndefined();
        expect(typeof field.default, `${key} default 應為 boolean`).toBe('boolean');
      }
    }
  });

  it('String + options 的 default 值在 options 中', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      const enumValues = getValueSchemaEnumOptions(field.valueSchema);
      if (field.controlType === String && enumValues && field.default !== undefined) {
        expect(enumValues).toContain(field.default);
      }
    }
  });
});
