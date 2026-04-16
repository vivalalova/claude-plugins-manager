import { describe, it, expect } from 'vitest';
import type { FlatFieldSchema } from '../../src/shared/claude-settings-schema';
import { validateSchemaFields, validateNoDuplicateKeys, validateI18nKeys } from '../check-settings-schema';
import { CLAUDE_SETTINGS_SCHEMA, getAllFlatFieldSchemas } from '../../src/shared/claude-settings-schema';
import { en } from '../../src/webview/i18n/locales/en';

const base: FlatFieldSchema = {
  valueSchema: { kind: 'boolean' },
  controlType: Boolean,
  nestedUnder: undefined,
  section: 'general',
};

describe('validateSchemaFields', () => {
  it('valid boolean → no errors', () => {
    expect(validateSchemaFields({ ok: { ...base } })).toEqual([]);
  });

  it('missing controlType → error', () => {
    const { controlType: _, ...noControlType } = base;
    const errors = validateSchemaFields({ bad: noControlType as FlatFieldSchema });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('bad');
    expect(errors[0]).toContain('controlType');
  });

  it('valid String with options → no errors', () => {
    expect(validateSchemaFields({
      ok: {
        ...base,
        valueSchema: { kind: 'string', enum: ['a', 'b'] as const },
        controlType: String,
      },
    })).toEqual([]);
  });

  it('String with empty options → error', () => {
    const errors = validateSchemaFields({
      bad: {
        ...base,
        valueSchema: { kind: 'string', enum: [] as const },
        controlType: String,
      },
    });
    expect(errors).toHaveLength(1);
  });

  it('number with valid min/max → no errors', () => {
    expect(validateSchemaFields({
      ok: {
        ...base,
        valueSchema: { kind: 'number', min: 0, max: 100, step: 1 },
        controlType: Number,
      },
    })).toEqual([]);
  });

  it('number with min > max → error', () => {
    const errors = validateSchemaFields({
      bad: {
        ...base,
        valueSchema: { kind: 'number', min: 10, max: 5 },
        controlType: Number,
      },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('min');
    expect(errors[0]).toContain('max');
  });

  it('number with only min (no max) → no errors', () => {
    expect(validateSchemaFields({
      ok: { ...base, valueSchema: { kind: 'number', min: 0 }, controlType: Number },
    })).toEqual([]);
  });

  it('Object clean → no errors', () => {
    expect(validateSchemaFields({
      ok: { ...base, valueSchema: { kind: 'object', properties: {} }, controlType: Object },
    })).toEqual([]);
  });

  it('Object with options → error', () => {
    const errors = validateSchemaFields({
      bad: {
        ...base,
        valueSchema: { kind: 'string', enum: ['x'] as const },
        controlType: Object,
      },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('non-String');
  });

  it('Object with min → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, valueSchema: { kind: 'number', min: 0 }, controlType: Object },
    });
    expect(errors).toHaveLength(1);
  });

  it('Object with max → error', () => {
    const errors = validateSchemaFields({
      bad: { ...base, valueSchema: { kind: 'number', max: 10 }, controlType: Object },
    });
    expect(errors).toHaveLength(1);
  });

  it('duplicate options → error', () => {
    const errors = validateSchemaFields({
      bad: {
        ...base,
        valueSchema: { kind: 'string', enum: ['a', 'b', 'a'] as const },
        controlType: String,
      },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('duplicate');
  });

  it('multiple errors in one entry → all reported', () => {
    const errors = validateSchemaFields({
      bad: {
        ...base,
        valueSchema: { kind: 'number', min: 0, max: 10 },
        controlType: Object,
      },
    });
    expect(errors).toHaveLength(1);
  });

  it('real CLAUDE_SETTINGS_SCHEMA → 0 errors', () => {
    expect(validateSchemaFields(getAllFlatFieldSchemas())).toEqual([]);
  });
});

describe('validateNoDuplicateKeys', () => {
  it('real schema → 0 errors', () => {
    expect(validateNoDuplicateKeys(CLAUDE_SETTINGS_SCHEMA)).toEqual([]);
  });

  it('duplicate key across sections → error', () => {
    const schema = {
      ...CLAUDE_SETTINGS_SCHEMA,
      testSection: [{ key: 'effortLevel', controlType: Boolean, valueSchema: { kind: 'boolean' }, nestedUnder: undefined }],
    };
    const errors = validateNoDuplicateKeys(schema as any);
    expect(errors.some(e => e.includes('effortLevel') && e.includes('duplicate'))).toBe(true);
  });
});

describe('validateI18nKeys', () => {
  it('real schema + en locale → 0 errors', () => {
    const enKeys = new Set(Object.keys(en));
    expect(validateI18nKeys(getAllFlatFieldSchemas(), enKeys)).toEqual([]);
  });

  it('missing label → error', () => {
    const enKeys = new Set(Object.keys(en));
    enKeys.delete('settings.general.effortLevel.label');
    const errors = validateI18nKeys(getAllFlatFieldSchemas(), enKeys);
    expect(errors.some(e => e.includes('effortLevel') && e.includes('label'))).toBe(true);
  });

  it('enum missing option i18n → error', () => {
    const enKeys = new Set(Object.keys(en));
    enKeys.delete('settings.general.effortLevel.high');
    const errors = validateI18nKeys(getAllFlatFieldSchemas(), enKeys);
    expect(errors.some(e => e.includes('effortLevel') && e.includes('high'))).toBe(true);
  });

  it('Object controlType → skipped', () => {
    const schema = {
      testCustom: {
        valueSchema: { kind: 'object', properties: {} },
        controlType: Object,
        nestedUnder: undefined,
        section: 'advanced' as const,
      },
    };
    expect(validateI18nKeys(schema, new Set())).toEqual([]);
  });
});
