---
title: SchemaFieldRenderer text/number i18n 自動組裝
created: 2026-03-14
priority: high
suggested_order: C03
blockedBy: c01-schema-field-renderer
phase: needs-commit
iteration: 3
max_iterations: 3
review_iterations: 2
---

# SchemaFieldRenderer text/number i18n 自動組裝

`TextSetting` 和 `NumberSetting` 需要 `placeholder`、`saveLabel`、`clearLabel` 等 props。在 `SchemaFieldRenderer` 中自動從 i18n 組裝。

## 規則

- placeholder: `t('settings.{section}.{key}.placeholder')`
- save button: `t('settings.common.save')` （共用 fallback）
- clear button: `t('settings.common.clear')` （共用 fallback）
- number min error: `t('settings.common.minError')` （共用 fallback）
- number max error: `t('settings.common.maxError')` （共用 fallback）

需新增 `settings.common.*` 共用 i18n keys（如果不存在）。若特定欄位需要覆蓋，可用 `settings.{section}.{key}.save` 等。

## User Stories

- As a developer, I want text/number field labels auto-resolved from i18n convention so that adding a new text setting only requires schema + i18n entries, not code changes.

## 驗收條件

- Given a text field with existing placeholder i18n key, when SchemaFieldRenderer renders, then placeholder 正確顯示
- Given `settings.common.save` i18n key exists, when TextSetting renders via SchemaFieldRenderer, then save 按鈕顯示共用文字
- Given a number field with min constraint, when validation fails, then 顯示 `settings.common.minError` 的翻譯
- Given 新增的 common i18n keys, when I check en.ts / zh-TW.ts, then 都有對應翻譯
- Given `npm run typecheck && npm test`, when I run them, then 全部通過
