/**
 * Claude Code settings schema — thin wrapper over JSON data.
 * Canonical data: claude-settings-schema.json
 * This file: TypeScript types + helpers + re-export.
 */

import schemaData from './claude-settings-schema.json';

export type SettingsSection =
  | 'general'
  | 'display'
  | 'advanced'
  | 'permissions'
  | 'env'
  | 'hooks';

export type ControlType = 'boolean' | 'enum' | 'text' | 'number' | 'tagInput' | 'custom';

export interface SettingFieldSchema {
  /** 預設值（undefined 表示無預設） */
  default?: unknown;
  /** 所屬 UI section */
  section: SettingsSection;
  /** UI 控制元件類型 */
  controlType: ControlType;
  /** enum 的選項陣列 */
  options?: readonly string[];
  /** number 欄位最小值 */
  min?: number;
  /** number 欄位最大值 */
  max?: number;
  /** number 欄位步進值 */
  step?: number;
}

/**
 * Settings schema — key 對應 ClaudeSettings interface 的欄位名稱。
 */
export const CLAUDE_SETTINGS_SCHEMA: Record<string, SettingFieldSchema> =
  schemaData.schema as Record<string, SettingFieldSchema>;

/**
 * Model dropdown 的 fallback 選項。
 * 當 availableModels 未設定時，UI 使用此清單作為建議值。
 */
export const KNOWN_MODEL_OPTIONS: readonly string[] = schemaData.knownModelOptions;

/**
 * 從 schema 取得欄位的預設值。
 * 若 key 不存在，拋出 Error（fail-fast）；無預設則回傳 undefined。
 */
export function getSchemaDefault<T = unknown>(key: string): T | undefined {
  const field = CLAUDE_SETTINGS_SCHEMA[key];
  if (!field) throw new Error(`Schema key "${key}" not found`);
  return field.default as T | undefined;
}

/**
 * 從 schema 取得 enum 欄位的 options 陣列。
 * 若 key 不存在或非 enum，拋出 Error（fail-fast）。
 */
export function getSchemaEnumOptions(key: string): readonly string[] {
  const field = CLAUDE_SETTINGS_SCHEMA[key];
  if (!field) throw new Error(`Schema key "${key}" not found`);
  if (field.controlType !== 'enum' || !field.options) {
    throw new Error(`Schema key "${key}" is not an enum with options`);
  }
  return field.options;
}
