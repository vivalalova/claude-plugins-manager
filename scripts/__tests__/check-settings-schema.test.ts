import { describe, it, expect } from 'vitest';
import type { SettingFieldSchema } from '../../src/shared/claude-settings-schema';
import { validateSchemaFields, validateFieldOrders, validateI18nKeys } from '../check-settings-schema';
import { CLAUDE_SETTINGS_SCHEMA } from '../../src/shared/claude-settings-schema';
import { en } from '../../src/webview/i18n/locales/en';

const base: SettingFieldSchema = {
  type: 'boolean',
  description: 'test',
  section: 'general',
  controlType: 'boolean',
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

  it('valid enum with options → no errors', () => {
    expect(validateSchemaFields({
      ok: { ...base, controlType: 'enum', options: ['a', 'b'] as const },
    })).toEqual([]);
  });

  it('enum missing options → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: 'enum' },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('bad');
    expect(errors[0]).toContain('enum');
  });

  it('enum with empty options → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: 'enum', options: [] as unknown as readonly string[] },
    });
    expect(errors).toHaveLength(1);
  });

  it('number with valid min/max → no errors', () => {
    expect(validateSchemaFields({
      ok: { ...base, controlType: 'number', min: 0, max: 100, step: 1 },
    })).toEqual([]);
  });

  it('number with min > max → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: 'number', min: 10, max: 5 },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('min');
    expect(errors[0]).toContain('max');
  });

  it('number with only min (no max) → no errors', () => {
    expect(validateSchemaFields({
      ok: { ...base, controlType: 'number', min: 0 },
    })).toEqual([]);
  });

  it('custom clean → no errors', () => {
    expect(validateSchemaFields({
      ok: { ...base, controlType: 'custom' },
    })).toEqual([]);
  });

  it('custom with options → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: 'custom', options: ['x'] as const },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('options');
  });

  it('custom with min → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: 'custom', min: 0 },
    });
    expect(errors).toHaveLength(1);
  });

  it('custom with max → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: 'custom', max: 10 },
    });
    expect(errors).toHaveLength(1);
  });

  it('duplicate options → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: 'enum', options: ['a', 'b', 'a'] as const },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('duplicate');
  });

  it('multiple errors in one entry → all reported', () => {
    const errors = validateSchemaFields({
      bad: { ...base, controlType: 'custom', options: ['x'] as const, min: 0, max: 10 },
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
});

describe('validateI18nKeys', () => {
  it('real schema + en locale → 0 errors', () => {
    const enKeys = new Set(Object.keys(en));
    expect(validateI18nKeys(CLAUDE_SETTINGS_SCHEMA, enKeys)).toEqual([]);
  });

  it('missing label → error', () => {
    const enKeys = new Set(Object.keys(en));
    // Remove one label
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

  it('custom controlType → skipped', () => {
    const schema = {
      testCustom: { ...base, controlType: 'custom' as const, section: 'advanced' as const },
    };
    expect(validateI18nKeys(schema, new Set())).toEqual([]);
  });
});
