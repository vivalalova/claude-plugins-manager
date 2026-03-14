---
title: 建立 SchemaFieldRenderer 核心元件
created: 2026-03-14
priority: critical
suggested_order: C01
blockedBy: [a01-extend-schema-ui-metadata, a02-enum-options-to-schema, a03-centralize-default-values]
---

# 建立 SchemaFieldRenderer 核心元件

在 `src/webview/editor/settings/components/` 新增 `SchemaFieldRenderer.tsx`。

## 功能

接收 props：
- `settingKey: string` — settings key name
- `schema: SettingFieldSchema` — 該 key 的 schema 定義
- `value: unknown` — 目前的值
- `scope: PluginScope` — 設定的 scope（僅 text/number/tagInput 需要；boolean/enum 不傳）
- `onSave: (key, value) => void`
- `onDelete: (key) => void`

注意：`BooleanToggle` 和 `EnumDropdown` 的 props 無 `scope` 欄位（見 SettingControls.tsx），SchemaFieldRenderer 只在 `controlType` 為 `'text'`、`'number'`、`'tagInput'` 時才傳 `scope` 給子元件。

根據 `schema.controlType` 分派到現有控制元件：
- `'boolean'` → `BooleanToggle`
- `'enum'` → `EnumDropdown`（options 從 schema.options 取）
- `'text'` → `TextSetting`
- `'number'` → `NumberSetting`（min/max/step 從 schema 取）
- `'tagInput'` → `TagInput`
- `'custom'` → return null（由 Section 自行 render）

## i18n Convention-based 自動組裝

i18n key 依慣例自動推斷：
- label: `settings.{section}.{key}.label`
- description: `settings.{section}.{key}.description`
- placeholder: `settings.{section}.{key}.placeholder`（text/number）
- save/clear: fallback 到 `settings.common.save` / `settings.common.clear`
- enum option label: `settings.{section}.{key}.{optionValue}`
- notSet: `settings.{section}.{key}.notSet`
- unknown template: `settings.{section}.{key}.unknown`

section 從 `schema.section` 取得。

## User Stories

- As a developer, I want a single component that reads the schema and renders the correct control so that Section components can replace boilerplate with a one-liner.

## 驗收條件

- Given `controlType: 'boolean'`, when SchemaFieldRenderer renders, then 產出 BooleanToggle 並傳入正確 props
- Given `controlType: 'enum'` with `options: ['a', 'b']`, when it renders, then 產出 EnumDropdown with knownValues=['a','b']
- Given `controlType: 'text'`, when it renders, then 產出 TextSetting with i18n-derived placeholder
- Given `controlType: 'number'` with `min: 0, step: 1`, when it renders, then 產出 NumberSetting with min=0, step=1
- Given `controlType: 'tagInput'`, when it renders, then 產出 TagInput
- Given `controlType: 'custom'`, when it renders, then return null
- Given any controlType, when checking i18n keys, then label 用 `settings.{section}.{key}.label` 格式
