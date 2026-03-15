#!/usr/bin/env npx tsx
/**
 * 驗證 claude-settings-schema.ts 與 ClaudeSettings interface 欄位一致，
 * 並檢查 schema 欄位的 controlType/options/min/max 邏輯一致性。
 *
 * 用法：npx tsx scripts/check-settings-schema.ts
 *
 * Exit code:
 *   0 = 全部通過
 *   1 = 有錯誤（輸出到 stdout）
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { CLAUDE_SETTINGS_SCHEMA } from '../src/shared/claude-settings-schema';
import type { SettingFieldSchema } from '../src/shared/claude-settings-schema';
import { GENERAL_FIELD_ORDER, DISPLAY_FIELD_ORDER, ADVANCED_FIELD_ORDER, EXCLUDED_FROM_FIELD_ORDER } from '../src/shared/field-orders';
import { en } from '../src/webview/i18n/locales/en';

const TYPES_PATH = join(__dirname, '..', 'src', 'shared', 'types.ts');

/** 從 types.ts 解析 ClaudeSettings interface 的欄位名稱 */
function parseClaudeSettingsKeys(source: string): Set<string> {
  const keys = new Set<string>();

  const interfaceMatch = source.match(/export\s+interface\s+ClaudeSettings\s*\{([\s\S]*?)^\}/m);
  if (!interfaceMatch) {
    throw new Error('ClaudeSettings interface not found in types.ts');
  }

  const body = interfaceMatch[1];
  const fieldRegex = /^ {2}(\w+)\??:/gm;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(body)) !== null) {
    keys.add(match[1]);
  }

  return keys;
}

/** 驗證 schema 欄位的 controlType/options/min/max 邏輯一致性 */
export function validateSchemaFields(schema: Record<string, SettingFieldSchema>): string[] {
  const errors: string[] = [];

  for (const [key, field] of Object.entries(schema)) {
    // Rule 1: controlType required
    if (!field.controlType) {
      errors.push(`${key}: missing controlType`);
    }

    // Rule 2: enum must have non-empty options
    if (field.controlType === 'enum' && (!field.options || field.options.length === 0)) {
      errors.push(`${key}: controlType 'enum' requires non-empty options array`);
    }

    // Rule 3: number with min/max → min <= max
    if (field.controlType === 'number' && field.min !== undefined && field.max !== undefined && field.min > field.max) {
      errors.push(`${key}: min (${field.min}) > max (${field.max})`);
    }

    // Rule 4: custom must not have options/min/max
    if (field.controlType === 'custom') {
      if (field.options) errors.push(`${key}: controlType 'custom' should not have options`);
      if (field.min !== undefined) errors.push(`${key}: controlType 'custom' should not have min`);
      if (field.max !== undefined) errors.push(`${key}: controlType 'custom' should not have max`);
    }

    // Rule 5: options values must be unique
    if (field.options) {
      const seen = new Set<string>();
      for (const opt of field.options) {
        if (seen.has(opt)) {
          errors.push(`${key}: duplicate option value '${opt}'`);
        }
        seen.add(opt);
      }
    }
  }

  return errors;
}

/** Phase 3: FIELD_ORDER completeness — every schema key in general/display/advanced must appear */
export function validateFieldOrders(schema: Record<string, SettingFieldSchema>): string[] {
  const errors: string[] = [];

  const sectionToFieldOrder: Record<string, readonly string[]> = {
    general: GENERAL_FIELD_ORDER,
    display: DISPLAY_FIELD_ORDER,
    advanced: ADVANCED_FIELD_ORDER,
  };

  // Forward: schema key → FIELD_ORDER
  for (const [key, field] of Object.entries(schema)) {
    const order = sectionToFieldOrder[field.section];
    if (!order) continue; // permissions/env/hooks — 手動渲染
    if (EXCLUDED_FROM_FIELD_ORDER.has(key as keyof import('../src/shared/types').ClaudeSettings)) continue;
    if (!order.includes(key)) {
      errors.push(`${key}: in schema section '${field.section}' but missing from ${field.section.toUpperCase()}_FIELD_ORDER`);
    }
  }

  // Reverse: FIELD_ORDER key → schema (catch stale/typo entries)
  for (const [section, order] of Object.entries(sectionToFieldOrder)) {
    for (const key of order) {
      if (!schema[key]) {
        errors.push(`${key}: in ${section.toUpperCase()}_FIELD_ORDER but not found in schema`);
      } else if (schema[key].section !== section) {
        errors.push(`${key}: in ${section.toUpperCase()}_FIELD_ORDER but schema section is '${schema[key].section}'`);
      }
    }
  }

  return errors;
}

/** Phase 4: i18n key completeness — every non-custom schema key must have label/description in en locale */
export function validateI18nKeys(schema: Record<string, SettingFieldSchema>, localeKeys: Set<string>): string[] {
  const errors: string[] = [];

  for (const [key, field] of Object.entries(schema)) {
    // Skip manually-rendered sections, custom controls, and excluded keys
    if (['permissions', 'env', 'hooks'].includes(field.section)) continue;
    if (field.controlType === 'custom') continue;
    if (EXCLUDED_FROM_FIELD_ORDER.has(key as keyof import('../src/shared/types').ClaudeSettings)) continue;

    const prefix = `settings.${field.section}.${key}`;
    if (!localeKeys.has(`${prefix}.label`)) {
      errors.push(`i18n missing: ${prefix}.label`);
    }
    if (!localeKeys.has(`${prefix}.description`)) {
      errors.push(`i18n missing: ${prefix}.description`);
    }

    if (field.controlType === 'enum' && field.options) {
      if (!localeKeys.has(`${prefix}.notSet`)) errors.push(`i18n missing: ${prefix}.notSet`);
      if (!localeKeys.has(`${prefix}.unknown`)) errors.push(`i18n missing: ${prefix}.unknown`);
      for (const opt of field.options) {
        if (!localeKeys.has(`${prefix}.${opt}`)) errors.push(`i18n missing: ${prefix}.${opt}`);
      }
    }

    if (field.controlType === 'text' || field.controlType === 'number') {
      if (!localeKeys.has(`${prefix}.placeholder`)) errors.push(`i18n missing: ${prefix}.placeholder`);
    }
  }

  return errors;
}

function main(): void {
  const errors: string[] = [];

  // Phase 1: key sync
  const source = readFileSync(TYPES_PATH, 'utf-8');
  const typesKeys = parseClaudeSettingsKeys(source);
  const schemaKeys = new Set(Object.keys(CLAUDE_SETTINGS_SCHEMA));

  const inTypesOnly = [...typesKeys].filter((k) => !schemaKeys.has(k)).sort();
  const inSchemaOnly = [...schemaKeys].filter((k) => !typesKeys.has(k)).sort();

  for (const k of inTypesOnly) errors.push(`Key in ClaudeSettings but missing from schema: ${k}`);
  for (const k of inSchemaOnly) errors.push(`Key in schema but missing from ClaudeSettings: ${k}`);

  // Phase 2: field validation
  errors.push(...validateSchemaFields(CLAUDE_SETTINGS_SCHEMA));

  // Phase 3: FIELD_ORDER completeness
  errors.push(...validateFieldOrders(CLAUDE_SETTINGS_SCHEMA));

  // Phase 4: i18n key completeness
  const enKeys = new Set(Object.keys(en));
  errors.push(...validateI18nKeys(CLAUDE_SETTINGS_SCHEMA, enKeys));

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
