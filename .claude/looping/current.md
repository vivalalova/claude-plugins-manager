---
title: SchemaFieldRenderer unit test
created: 2026-03-14
priority: critical
suggested_order: T01
blockedBy: [c01-schema-field-renderer, c02-enum-label-i18n, c03-text-number-i18n]
phase: needs-commit
iteration: 2
max_iterations: 3
review_iterations: 1
---

# SchemaFieldRenderer unit test

在 `src/webview/editor/settings/components/__tests__/SchemaFieldRenderer.test.tsx` 新增測試。

## 測試案例

1. **boolean schema** → renders BooleanToggle，傳入正確 label/description/defaultValue
2. **enum schema** with `options: ['a', 'b']` → renders EnumDropdown with knownValues=['a','b'] 和自動組裝的 knownLabels
3. **text schema** → renders TextSetting with i18n-derived placeholder
4. **number schema** with `min: 0, max: 100, step: 1` → renders NumberSetting with 正確 props
5. **tagInput schema** → renders TagInput
6. **custom schema** → returns null（不渲染任何東西）
7. **i18n key 組裝** — 驗證 label 用 `settings.{section}.{key}.label` 格式
8. **onSave/onDelete callback** — 驗證正確傳遞

需加 `/** @vitest-environment jsdom */`。若測試中引用到 vscode（間接透過 provider 或 hook），依 Section test 慣例 mock `'../../../../vscode'`（測試在 `components/__tests__/`，比 `__tests__/` 多一層）。參考 `SettingControls.test.tsx` 和 `GeneralSection.test.tsx` 確認需要的 providers（I18nProvider、ToastProvider）。

## User Stories

- As a developer, I want comprehensive tests for the schema renderer so that regressions in field dispatch or i18n wiring are caught early.

## 驗收條件

- Given `npm test SchemaFieldRenderer`, when I run it, then 所有案例通過
- Given 每個 controlType, when tested, then 對應的控制元件被渲染
- Given `controlType: 'custom'`, when tested, then component returns null
- Given `npm run verify`, when I run it, then 全部通過
