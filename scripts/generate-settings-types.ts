#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CLAUDE_SETTINGS_SCHEMA, HOOK_COMMAND_SCHEMA, type ObjectProperty, type ValueSchema } from '../src/shared/claude-settings-schema';

const OUTPUT_PATH = resolve(process.cwd(), 'src/shared/claude-settings-types.generated.ts');
const CHECK_MODE = process.argv.includes('--check');

function renderLiteral(value: string | number | boolean | null): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  return String(value);
}

function renderValueSchema(schema: ValueSchema, indent = ''): string {
  switch (schema.kind) {
    case 'string':
      return schema.enum ? schema.enum.map((value) => JSON.stringify(value)).join(' | ') : 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'literal':
      return renderLiteral(schema.value);
    case 'array': {
      const item = renderValueSchema(schema.item, indent);
      return schema.item.kind === 'union' ? `(${item})[]` : `${item}[]`;
    }
    case 'record':
      return `Record<string, ${renderValueSchema(schema.value, indent)}>`;
    case 'object':
      return renderObjectSchema(schema.properties, indent);
    case 'union':
      return schema.anyOf.map((member) => renderValueSchema(member, indent)).join(' | ');
  }
}

function renderObjectSchema(properties: Record<string, ObjectProperty>, indent = ''): string {
  const entries = Object.entries(properties);
  if (entries.length === 0) return '{}';

  const nextIndent = `${indent}  `;
  const lines = entries.map(([key, property]) => (
    `${nextIndent}${key}${property.optional ? '?' : ''}: ${renderValueSchema(property.schema, nextIndent)};`
  ));

  return `{\n${lines.join('\n')}\n${indent}}`;
}

function getTopLevelFieldEntries(): Array<{ key: string; valueSchema: ValueSchema }> {
  const entries: Array<{ key: string; valueSchema: ValueSchema }> = [];
  for (const fields of Object.values(CLAUDE_SETTINGS_SCHEMA)) {
    for (const field of fields) {
      if (field.nestedUnder !== undefined) continue;
      entries.push({ key: field.key, valueSchema: field.valueSchema });
    }
  }
  return entries;
}

function generateContent(): string {
  const topLevelFields = getTopLevelFieldEntries();
  const hookCommand = renderValueSchema(HOOK_COMMAND_SCHEMA);
  const settingsLines = topLevelFields.map(({ key, valueSchema }) => `  ${key}?: ${renderValueSchema(valueSchema, '  ')};`);

  return `/**
 * Generated from src/shared/claude-settings-schema.ts.
 * Do not edit manually.
 */

export type HookCommand = ${hookCommand};

export interface ClaudeSettings {
${settingsLines.join('\n')}
}
`;
}

function main(): void {
  const content = generateContent();

  if (CHECK_MODE) {
    const existing = readFileSync(OUTPUT_PATH, 'utf8');
    if (existing !== content) {
      console.error('Generated settings types are stale. Run: npx tsx scripts/generate-settings-types.ts');
      process.exit(1);
    }
    console.log('✅ Generated settings types are up to date');
    return;
  }

  writeFileSync(OUTPUT_PATH, content);
  console.log(`Generated ${OUTPUT_PATH}`);
}

main();
