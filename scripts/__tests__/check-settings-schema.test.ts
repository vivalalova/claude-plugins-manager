import { describe, it, expect } from 'vitest';
import type { SettingFieldSchema } from '../../src/shared/claude-settings-schema';
import { validateSchemaFields, validateFieldOrders, validateI18nKeys } from '../check-settings-schema';
import { CLAUDE_SETTINGS_SCHEMA } from '../../src/shared/claude-settings-schema';
import { en } from '../../src/webview/i18n/locales/en';

const base: SettingFieldSchema = {
  section: 'general',
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
    expect(validateSchemaFields(CLAUDE_SETTINGS_SCHEMA)).toEqual([]);
  });
});

describe('validateFieldOrders', () => {
  it('real schema → 0 errors', () => {
    expect(validateFieldOrders(CLAUDE_SETTINGS_SCHEMA)).toEqual([]);
  });

  it('schema key missing from FIELD_ORDER → error', () => {
    const schema = {
      ...CLAUDE_SETTINGS_SCHEMA,
      testMissing: { ...base, section: 'general' as const },
    };
    const errors = validateFieldOrders(schema);
    expect(errors.some(e => e.includes('testMissing'))).toBe(true);
  });

  it('excluded keys (model) → no error', () => {
    const errors = validateFieldOrders(CLAUDE_SETTINGS_SCHEMA);
    expect(errors.some(e => e.includes('model'))).toBe(false);
  });

  it('FIELD_ORDER key not in schema → error (reverse check)', () => {
    const { effortLevel: _, ...withoutEffort } = CLAUDE_SETTINGS_SCHEMA;
    const errors = validateFieldOrders(withoutEffort);
    expect(errors.some(e => e.includes('effortLevel') && e.includes('not found in schema'))).toBe(true);
  });

  it('FIELD_ORDER key with wrong section → error (reverse check)', () => {
    const schema = {
      ...CLAUDE_SETTINGS_SCHEMA,
      effortLevel: { ...CLAUDE_SETTINGS_SCHEMA.effortLevel, section: 'display' as const },
    };
    const errors = validateFieldOrders(schema);
    expect(errors.some(e => e.includes('effortLevel') && e.includes('GENERAL_FIELD_ORDER') && e.includes('display'))).toBe(true);
  });
});

describe('validateI18nKeys', () => {
  it('real schema + en locale → 0 errors', () => {
    const enKeys = new Set(Object.keys(en));
    expect(validateI18nKeys(CLAUDE_SETTINGS_SCHEMA, enKeys)).toEqual([]);
  });

  it('missing label → error', () => {
    const enKeys = new Set(Object.keys(en));
    enKeys.delete('settings.general.effortLevel.label');
    const errors = validateI18nKeys(CLAUDE_SETTINGS_SCHEMA, enKeys);
    expect(errors.some(e => e.includes('effortLevel') && e.includes('label'))).toBe(true);
  });

  it('enum missing option i18n → error', () => {
    const enKeys = new Set(Object.keys(en));
    enKeys.delete('settings.general.effortLevel.high');
    const errors = validateI18nKeys(CLAUDE_SETTINGS_SCHEMA, enKeys);
    expect(errors.some(e => e.includes('effortLevel') && e.includes('high'))).toBe(true);
  });

  it('Object controlType → skipped', () => {
    const schema = {
      testCustom: { ...base, controlType: Object, section: 'advanced' as const },
    };
    expect(validateI18nKeys(schema, new Set())).toEqual([]);
  });
});
