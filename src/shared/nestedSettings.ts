/**
 * 巢狀父物件（`permissions`、`remote`、`env` …）的單一子欄位寫入／刪除純函式。
 * 擴展端（寫回檔案）、webview（樂觀更新）、測試 fake backend 三方共用同一份語意。
 */
import { PERMISSIONS_VALUE_SCHEMA } from './claude-settings-schema';
import type { ArrayValueSchema, CLAUDE_SETTINGS_SCHEMA, SettingsSection } from './claude-settings-schema';

type SchemaNestedUnder = (typeof CLAUDE_SETTINGS_SCHEMA)[SettingsSection][number]['nestedUnder'];

/** 可做子欄位寫入的父 key：schema `nestedUnder` 字面值，加上以變數名為子 key 的 `env` */
export type NestedParentKey = Exclude<SchemaNestedUnder, undefined> | 'env';

type PermissionsProperties = (typeof PERMISSIONS_VALUE_SCHEMA)['properties'];

/** `permissions` 底下的字串清單子欄位（allow／deny／ask／additionalDirectories），只能逐條加刪 */
export type PermissionsListKey = {
  [K in keyof PermissionsProperties]: PermissionsProperties[K]['schema'] extends ArrayValueSchema ? K : never;
}[keyof PermissionsProperties];

/** `permissions` 底下的非清單子欄位，可整值 setNested */
export type PermissionsScalarKey = Exclude<keyof PermissionsProperties, PermissionsListKey>;

/** 由 schema 判定 `permissions` 子欄位是否為清單 */
function isPermissionsListKey(key: string): key is PermissionsListKey {
  return (
    Object.prototype.hasOwnProperty.call(PERMISSIONS_VALUE_SCHEMA.properties, key) &&
    PERMISSIONS_VALUE_SCHEMA.properties[key as keyof PermissionsProperties].schema.kind === 'array'
  );
}

/** 子欄位整值寫入可用的 childKey：permissions 的清單 key 排除在外 */
export type NestedChildKey<P extends NestedParentKey> = P extends 'permissions' ? PermissionsScalarKey : string;

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

/** 設定 `settings[parentKey][childKey] = value`；父 key 缺席時建立；permissions 清單 key 拋錯。不修改輸入。 */
export function applySetNested(
  settings: SettingsObject,
  parentKey: NestedParentKey,
  childKey: string,
  value: unknown,
): NestedApplyResult {
  if (parentKey === 'permissions' && isPermissionsListKey(childKey)) {
    throw new Error(`Setting 'permissions.${childKey}' is a list; add or remove items one at a time`);
  }
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

/** 讀 `permissions[listKey]`；缺席或 null 視為沒有清單，其他非陣列拋錯 */
function readPermissionsList(
  settings: SettingsObject,
  listKey: PermissionsListKey,
): { parent: Record<string, unknown>; list: readonly unknown[] } {
  const parent = readParent(settings, 'permissions') ?? {};
  const list = parent[listKey];
  if (list === undefined || list === null) return { parent, list: [] };
  if (!Array.isArray(list)) {
    throw new Error(`Setting 'permissions.${listKey}' is not an array; cannot update its items`);
  }
  return { parent, list };
}

function withPermissionsList(
  settings: SettingsObject,
  parent: Record<string, unknown>,
  listKey: PermissionsListKey,
  list: unknown[],
): Record<string, unknown> {
  return { ...settings, permissions: { ...parent, [listKey]: list } };
}

/** 在 `permissions[listKey]` 尾端加一條；已有完全相同字串時不變。不修改輸入。 */
export function applyAddPermissionsListItem(
  settings: SettingsObject,
  listKey: PermissionsListKey,
  item: string,
): NestedApplyResult {
  const { parent, list } = readPermissionsList(settings, listKey);
  if (list.includes(item)) return { next: { ...settings }, changed: false };
  return { next: withPermissionsList(settings, parent, listKey, [...list, item]), changed: true };
}

/** 刪掉 `permissions[listKey]` 內所有完全相同的字串；刪到空留 []。不修改輸入。 */
export function applyRemovePermissionsListItem(
  settings: SettingsObject,
  listKey: PermissionsListKey,
  item: string,
): NestedApplyResult {
  const { parent, list } = readPermissionsList(settings, listKey);
  if (!list.includes(item)) return { next: { ...settings }, changed: false };
  return { next: withPermissionsList(settings, parent, listKey, list.filter((r) => r !== item)), changed: true };
}
