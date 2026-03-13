#!/usr/bin/env npx tsx
/**
 * 驗證 claude-settings-schema.ts 與 ClaudeSettings interface 欄位一致。
 * 用法：npx tsx scripts/check-settings-schema.ts [--dry-run]
 *
 * --dry-run：僅輸出 diff，不做任何修改（預設行為）
 *
 * Exit code:
 *   0 = schema 與 types.ts 一致
 *   1 = 有差異（輸出到 stdout）
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { CLAUDE_SETTINGS_SCHEMA } from '../src/shared/claude-settings-schema';

const TYPES_PATH = join(__dirname, '..', 'src', 'shared', 'types.ts');

/** 從 types.ts 解析 ClaudeSettings interface 的欄位名稱 */
function parseClaudeSettingsKeys(source: string): Set<string> {
  const keys = new Set<string>();

  // 找到 interface ClaudeSettings { ... } 區塊
  const interfaceMatch = source.match(/export\s+interface\s+ClaudeSettings\s*\{([\s\S]*?)^\}/m);
  if (!interfaceMatch) {
    throw new Error('ClaudeSettings interface not found in types.ts');
  }

  const body = interfaceMatch[1];
  // 只匹配第一層欄位（2 spaces indent），排除 inline object 內的巢狀欄位
  const fieldRegex = /^ {2}(\w+)\??:/gm;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(body)) !== null) {
    keys.add(match[1]);
  }

  return keys;
}

function main(): void {
  const source = readFileSync(TYPES_PATH, 'utf-8');
  const typesKeys = parseClaudeSettingsKeys(source);
  const schemaKeys = new Set(Object.keys(CLAUDE_SETTINGS_SCHEMA));

  const inTypesOnly = [...typesKeys].filter((k) => !schemaKeys.has(k)).sort();
  const inSchemaOnly = [...schemaKeys].filter((k) => !typesKeys.has(k)).sort();

  if (inTypesOnly.length === 0 && inSchemaOnly.length === 0) {
    console.log('✅ Schema and ClaudeSettings are in sync (%d keys)', schemaKeys.size);
    process.exit(0);
  }

  console.log('❌ Schema drift detected:\n');

  if (inTypesOnly.length > 0) {
    console.log('Keys in ClaudeSettings but missing from schema:');
    for (const k of inTypesOnly) {
      console.log(`  + ${k}`);
    }
    console.log();
  }

  if (inSchemaOnly.length > 0) {
    console.log('Keys in schema but missing from ClaudeSettings:');
    for (const k of inSchemaOnly) {
      console.log(`  - ${k}`);
    }
    console.log();
  }

  process.exit(1);
}

main();
