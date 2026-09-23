/**
 * 巢狀父物件（`permissions`、`remote`、`env` …）的單一子欄位寫入／刪除純函式。
 * 擴展端（寫回檔案）、webview（樂觀更新）、測試 fake backend 三方共用同一份語意。
 */
import type { CLAUDE_SETTINGS_SCHEMA, SettingsSection } from './claude-settings-schema';

type SchemaNestedUnder = (typeof CLAUDE_SETTINGS_SCHEMA)[SettingsSection][number]['nestedUnder'];

/** 可做子欄位寫入的父 key：schema `nestedUnder` 字面值，加上以變數名為子 key 的 `env` */
export type NestedParentKey = Exclude<SchemaNestedUnder, undefined> | 'env';

type SettingsObject = Readonly<Record<string, unknown>>;

export interface NestedApplyResult {
  next: Record<string, unknown>;
  changed: boolean;
}

/** 父 key 的值能否當巢狀父物件（plain object，排除 null 與陣列） */
export function isNestedParentShape(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 父 key 缺席回 undefined；存在但形狀不符直接拋錯（不把字串／陣列展開成物件） */
function readParent(settings: SettingsObject, parentKey: NestedParentKey): Record<string, unknown> | undefined {
  const parent = settings[parentKey];
  if (parent === undefined) return undefined;
  if (!isNestedParentShape(parent)) {
    throw new Error(`Setting '${parentKey}' is not an object; cannot update its nested fields`);
  }
  return parent;
}

/** 設定 `settings[parentKey][childKey] = value`；父 key 缺席時建立。不修改輸入。 */
export function applySetNested(
  settings: SettingsObject,
  parentKey: NestedParentKey,
  childKey: string,
  value: unknown,
): NestedApplyResult {
  const parent = readParent(settings, parentKey) ?? {};
  return {
    next: { ...settings, [parentKey]: { ...parent, [childKey]: value } },
    changed: true,
  };
}

/** 刪除 `settings[parentKey][childKey]`；刪到父物件變空時連父 key 一起刪。不修改輸入。 */
export function applyDeleteNested(
  settings: SettingsObject,
  parentKey: NestedParentKey,
  childKey: string,
): NestedApplyResult {
  const parent = readParent(settings, parentKey);
  if (parent === undefined || !Object.hasOwn(parent, childKey)) {
    return { next: { ...settings }, changed: false };
  }
  const nextParent = { ...parent };
  delete nextParent[childKey];
  const next: Record<string, unknown> = { ...settings };
  if (Object.keys(nextParent).length === 0) {
    delete next[parentKey];
  } else {
    next[parentKey] = nextParent;
  }
  return { next, changed: true };
}
