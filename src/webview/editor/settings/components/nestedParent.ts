/**
 * Nested 父物件（`permissions`、`autoMode`、`remote` …）寫入的共用出口。
 *
 * 兩條路徑共用：`getSchemaFieldBindings`（schema-driven，`nestedUnder` 欄位）與
 * `PermissionsSection.updatePermissions`（手寫路徑）。
 */

interface ParentWriteHandlers {
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void | boolean>;
}

/**
 * 父物件變空 → 刪掉整個父 key，避免 settings.json 殘留 `"permissions": {}`；
 * 還有其他 key → 照常寫入剩餘物件（行為不變）。
 */
export async function saveOrDeleteParent(
  parentKey: string,
  updatedParent: Record<string, unknown>,
  { onSave, onDelete }: ParentWriteHandlers,
): Promise<void> {
  if (Object.keys(updatedParent).length === 0) {
    await onDelete(parentKey);
    return;
  }
  await onSave(parentKey, updatedParent);
}
