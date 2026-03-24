import { describe, it, expect } from 'vitest';
import type { SettingFieldSchema } from '../../src/shared/claude-settings-schema';
import { validateSchemaFields, validateNoDuplicateKeys, validateI18nKeys } from '../check-settings-schema';
import { CLAUDE_SETTINGS_SCHEMA, SETTINGS_FLAT_SCHEMA } from '../../src/shared/claude-settings-schema';
import { en } from '../../src/webview/i18n/locales/en';

const base: SettingFieldSchema = {
  controlType: Boolean,
};

describe('validateSchemaFields', () => {
  it('valid boolean → no errors', () => {
    expect(validateSchemaFields({ ok: { ...base } })).toEqual([]);
  });

  it('missing controlType → error', () => {
    const { controlType: _, ...noControlType } = base;
    const errors = validateSchemaFields({ bad: noControlType as SettingFieldSchema });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('bad');
    expect(errors[0]).toContain('controlType');
  });

  it('valid String with options → no errors', () => {
    expect(validateSchemaFields({
      ok: { ...base, controlType: String, options: ['a', 'b'] as const },
    })).toEqual([]);
  });

  it('String with empty options → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: String, options: [] as unknown as readonly string[] },
    });
    expect(errors).toHaveLength(1);
  });

  it('number with valid min/max → no errors', () => {
    expect(validateSchemaFields({
      ok: { ...base, controlType: Number, min: 0, max: 100, step: 1 },
    })).toEqual([]);
  });

  it('number with min > max → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: Number, min: 10, max: 5 },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('min');
    expect(errors[0]).toContain('max');
  });

  it('number with only min (no max) → no errors', () => {
    expect(validateSchemaFields({
      ok: { ...base, controlType: Number, min: 0 },
    })).toEqual([]);
  });

  it('Object clean → no errors', () => {
    expect(validateSchemaFields({
      ok: { ...base, controlType: Object },
    })).toEqual([]);
  });

  it('Object with options → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: Object, options: ['x'] as const },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('options');
  });

  it('Object with min → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: Object, min: 0 },
    });
    expect(errors).toHaveLength(1);
  });

  it('Object with max → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: Object, max: 10 },
    });
    expect(errors).toHaveLength(1);
  });

  it('duplicate options → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: String, options: ['a', 'b', 'a'] as const },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('duplicate');
  });

  it('multiple errors in one entry → all reported', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: Object, options: ['x'] as const, min: 0, max: 10 },
    });
    expect(errors).toHaveLength(3);
  });

  it('real CLAUDE_SETTINGS_SCHEMA → 0 errors', () => {
    expect(validateSchemaFields(SETTINGS_FLAT_SCHEMA)).toEqual([]);
  });
});

describe('validateNoDuplicateKeys', () => {
  it('real schema → 0 errors', () => {
    expect(validateNoDuplicateKeys(CLAUDE_SETTINGS_SCHEMA)).toEqual([]);
  });

  it('duplicate key across sections → error', () => {
    const schema = {
      ...CLAUDE_SETTINGS_SCHEMA,
      testSection: [{ key: 'effortLevel', controlType: Boolean }],
    };
    const errors = validateNoDuplicateKeys(schema as any);
    expect(errors.some(e => e.includes('effortLevel') && e.includes('duplicate'))).toBe(true);
  });
});

describe('validateI18nKeys', () => {
  it('real schema + en locale → 0 errors', () => {
    const enKeys = new Set(Object.keys(en));
    expect(validateI18nKeys(SETTINGS_FLAT_SCHEMA, enKeys)).toEqual([]);
  });

  it('missing label → error', () => {
    const enKeys = new Set(Object.keys(en));
    enKeys.delete('settings.general.effortLevel.label');
    const errors = validateI18nKeys(SETTINGS_FLAT_SCHEMA, enKeys);
    expect(errors.some(e => e.includes('effortLevel') && e.includes('label'))).toBe(true);
  });

  it('enum missing option i18n → error', () => {
    const enKeys = new Set(Object.keys(en));
    enKeys.delete('settings.general.effortLevel.high');
    const errors = validateI18nKeys(SETTINGS_FLAT_SCHEMA, enKeys);
    expect(errors.some(e => e.includes('effortLevel') && e.includes('high'))).toBe(true);
  });

  it('Object controlType → skipped', () => {
    const schema = {
      testCustom: { controlType: Object, section: 'advanced' as const },
    };
    expect(validateI18nKeys(schema, new Set())).toEqual([]);
  });
});
