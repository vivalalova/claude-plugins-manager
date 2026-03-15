---
title: Settings 重置為 schema default 按鈕
created: 2026-03-15
priority: medium
suggested_order: B1
---

# Settings 重置為 schema default 按鈕

SchemaFieldRenderer 的子控件應統一支援「重置為 schema default」功能。目前 `BooleanToggle` 已有 Reset 按鈕（當值不等於 default 時顯示），需推廣至 `EnumDropdown`、`TextSetting`、`NumberSetting`。

## 規格

- 有明確 `schema.default` 的欄位，當用戶設定了非 default 值時，顯示 Reset 按鈕
- 點擊 Reset → 呼叫 `onDelete(key)` 移除該 key（使其回歸 default）
- 無 `schema.default` 的欄位（如 `language`）不顯示 Reset 按鈕
- SchemaFieldRenderer 統一傳遞 `defaultValue={schema.default}` 給所有子控件

## User Stories

- As a 使用者, I want 能一鍵將某個設定恢復為預設值, so that 不需手動查文件找 default。

## 驗收條件

- Given `effortLevel` 設為 `'low'`（default 為 `'high'`）, when 畫面渲染, then EnumDropdown 旁顯示 Reset 按鈕
- Given 點擊 Reset, when 操作完成, then `onDelete('effortLevel')` 被呼叫
- Given `effortLevel` 未設定（使用 default）, when 畫面渲染, then 無 Reset 按鈕
- Given `language` 欄位（無 schema default）, when 任何值, then 不顯示 Reset 按鈕
