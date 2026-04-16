#!/usr/bin/env npx tsx
/**
 * 驗證 claude-settings-schema.ts 自身一致性，
 * 並檢查 nestedUnder/valueSchema/controlType/i18n 是否對齊。
 *
 * 用法：npx tsx scripts/check-settings-schema.ts
 *
 * Exit code:
 *   0 = 全部通過
 *   1 = 有錯誤（輸出到 stdout）
 */

import {
  CLAUDE_SETTINGS_SCHEMA,
  getAllFlatFieldSchemas,
  getValueSchemaEnumOptions,
  getValueSchemaNumberMeta,
  type FlatFieldSchema,
  type SettingFieldEntry,
} from '../src/shared/claude-settings-schema';
import { en } from '../src/webview/i18n/locales/en';

/** 驗證 schema 欄位的 controlType/options/min/max 邏輯一致性 */
export function validateSchemaFields(schema: Record<string, FlatFieldSchema>): string[] {
  const errors: string[] = [];

  for (const [key, field] of Object.entries(schema)) {
    if (!field.valueSchema) {
      errors.push(`${key}: missing valueSchema`);
    }

    // Rule 1: controlType required
    if (!field.controlType) {
      errors.push(`${key}: missing controlType`);
    }

    const enumValues = getValueSchemaEnumOptions(field.valueSchema);
    const numberMeta = getValueSchemaNumberMeta(field.valueSchema);

    // Rule 2: String enum 必須有非空 enum 陣列
    if (field.controlType === String && enumValues && enumValues.length === 0) {
      errors.push(`${key}: String with options requires non-empty options array`);
    }

    // Rule 4: number with min/max → min <= max
    if (field.controlType === Number && numberMeta?.min !== undefined && numberMeta.max !== undefined && numberMeta.min > numberMeta.max) {
      errors.push(`${key}: min (${numberMeta.min}) > max (${numberMeta.max})`);
    }

    // Rule 5: enum/number meta 需與 controlType 合法搭配
    if (field.controlType !== String && enumValues) {
      errors.push(`${key}: non-String controlType should not use string enum valueSchema`);
    }
    if (field.controlType !== Number && numberMeta) {
      errors.push(`${key}: non-Number controlType should not use number valueSchema`);
    }

    // Rule 6: options values must be unique
    if (enumValues) {
      const seen = new Set<string>();
      for (const opt of enumValues) {
        if (seen.has(opt)) {
          errors.push(`${key}: duplicate option value '${opt}'`);
        }
        seen.add(opt);
      }
    }
  }

  return errors;
}

/** Phase 1: nestedUnder 必須指向實際存在的父物件欄位 */
export function validateNestedUnderTargets(schema: Record<string, FlatFieldSchema>): string[] {
  const errors: string[] = [];

  for (const [key, field] of Object.entries(schema)) {
    if (!field.nestedUnder) continue;

    const parent = schema[field.nestedUnder];
    if (!parent) {
      errors.push(`${key}: nestedUnder parent '${field.nestedUnder}' not found`);
      continue;
    }

    if (parent.valueSchema.kind !== 'object') {
      errors.push(`${key}: nestedUnder parent '${field.nestedUnder}' is not an object field`);
      continue;
    }

    if (!(key in parent.valueSchema.properties)) {
      errors.push(`${key}: nestedUnder parent '${field.nestedUnder}' is missing property '${key}'`);
    }
  }

  return errors;
}

/** Phase 3: 跨 section 無重複 key */
export function validateNoDuplicateKeys(schema: Record<string, SettingFieldEntry[]>): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const [section, fields] of Object.entries(schema)) {
    for (const { key } of fields) {
      const prev = seen.get(key);
      if (prev) {
        errors.push(`${key}: duplicate key in sections '${prev}' and '${section}'`);
      }
      seen.set(key, section);
    }
  }
  return errors;
}

/** Phase 4: i18n key completeness — every non-custom schema key must have label/description in en locale */
export function validateI18nKeys(schema: Record<string, FlatFieldSchema>, localeKeys: Set<string>): string[] {
  const errors: string[] = [];

  for (const [key, field] of Object.entries(schema)) {
    // Skip manually-rendered sections, custom controls, and excluded keys
    if (['permissions', 'env', 'hooks'].includes(field.section)) continue;
    if (field.controlType === Object) continue;
    const prefix = `settings.${field.section}.${key}`;
    if (!localeKeys.has(`${prefix}.label`)) {
      errors.push(`i18n missing: ${prefix}.label`);
    }
    if (!localeKeys.has(`${prefix}.description`)) {
      errors.push(`i18n missing: ${prefix}.description`);
    }

    if (field.controlType === String && getValueSchemaEnumOptions(field.valueSchema)) {
      if (!localeKeys.has(`${prefix}.notSet`)) errors.push(`i18n missing: ${prefix}.notSet`);
      if (!localeKeys.has(`${prefix}.unknown`)) errors.push(`i18n missing: ${prefix}.unknown`);
      for (const opt of getValueSchemaEnumOptions(field.valueSchema) ?? []) {
        if (!localeKeys.has(`${prefix}.${opt}`)) errors.push(`i18n missing: ${prefix}.${opt}`);
      }
    }

    if ((field.controlType === String && !getValueSchemaEnumOptions(field.valueSchema)) || field.controlType === Number) {
      if (!localeKeys.has(`${prefix}.placeholder`)) errors.push(`i18n missing: ${prefix}.placeholder`);
    }
  }

  return errors;
}

function main(): void {
  const errors: string[] = [];
  const flatSchema = getAllFlatFieldSchemas();
  const schemaKeys = new Set(Object.keys(flatSchema));

  // Phase 1: nestedUnder validation
  errors.push(...validateNestedUnderTargets(flatSchema));

  // Phase 2: field validation
  errors.push(...validateSchemaFields(flatSchema));

  // Phase 3: duplicate key check
  errors.push(...validateNoDuplicateKeys(CLAUDE_SETTINGS_SCHEMA));

  // Phase 4: i18n key completeness
  const enKeys = new Set(Object.keys(en));
  errors.push(...validateI18nKeys(flatSchema, enKeys));

  if (errors.length === 0) {
    console.log('✅ Schema check passed (%d keys, %d phases, all constraints valid)', schemaKeys.size, 4);
    process.exit(0);
  }

  console.log('❌ Schema check failed (%d errors):\n', errors.length);
  for (const e of errors) console.log(`  • ${e}`);
  console.log();
  process.exit(1);
}

// Auto-execute only when run directly (not imported by tests)
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) main();
