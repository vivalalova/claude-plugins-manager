---
title: SchemaFieldRenderer enum label i18n 自動組裝
created: 2026-03-14
priority: high
suggested_order: C02
blockedBy: c01-schema-field-renderer
---

# SchemaFieldRenderer enum label i18n 自動組裝

`EnumDropdown` 需要 `knownLabels: Record<string, string>`。在 `SchemaFieldRenderer` 中，對 enum 欄位自動用 convention-based i18n key 組裝 labels。

## 規則

- option label: `t('settings.{section}.{key}.{optionValue}')`
- notSet label: `t('settings.{section}.{key}.notSet')`
- unknown template: `t('settings.{section}.{key}.unknown')`

例如 `effortLevel` 在 `general` section：
- `t('settings.general.effortLevel.high')` → "High"
- `t('settings.general.effortLevel.notSet')` → "Not set"

Section 元件不再需要手動建立 `xxxLabels` Record。

確保現有的 i18n key 結構與此 convention 一致。若有不一致需調整 i18n 檔案。

## User Stories

- As a developer, I want enum labels to be automatically derived from i18n keys following a convention so that I never forget to wire up translations for new enum values.

## 驗收條件

- Given `effortLevel` enum, when SchemaFieldRenderer renders it, then `knownLabels` 自動從 i18n 組裝，包含 high/medium/low 的翻譯
- Given 每個 enum 欄位, when SchemaFieldRenderer renders, then `notSetLabel` 和 `unknownTemplate` 也自動從 i18n 取得
- Given 現有 i18n 檔案, when checking key 結構, then 符合 `settings.{section}.{key}.{value}` 慣例（不一致的已調整）
- Given `npm run typecheck && npm test`, when I run them, then 全部通過
