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

  if (errors.length === 0) {
    console.log('✅ Schema check passed (%d keys, all constraints valid)', schemaKeys.size);
    process.exit(0);
  }

  console.log('❌ Schema check failed (%d errors):\n', errors.length);
  for (const e of errors) console.log(`  • ${e}`);
  console.log();
  process.exit(1);
}

// Auto-execute only when run directly (not imported by tests)
const isDirectRun = process.argv[1]?.includes('check-settings-schema');
if (isDirectRun) main();
