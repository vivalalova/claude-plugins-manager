---
title: 改造 DisplaySection — schema-driven 渲染
created: 2026-03-14
priority: high
suggested_order: B02
blockedBy: [c01-schema-field-renderer, c02-enum-label-i18n]
---

# 改造 DisplaySection — schema-driven 渲染

將 `DisplaySection` 的硬編碼 boolean 和 enum 欄位替換為 schema-driven 渲染。

## 改造範圍

1. **移除 `booleanFields[]` 陣列** — 改為從 schema 過濾 `section === 'display' && controlType === 'boolean'`
2. **移除 `KNOWN_TEAMMATE_MODES` 常數** — `teammateMode` 改用 `SchemaFieldRenderer`（options 從 schema 取）

## 保留不動

- `SpinnerVerbsEditor` — schema 中 `spinnerVerbs` 為 `controlType: 'custom'`
- `SpinnerTipsOverrideEditor` — schema 中 `spinnerTipsOverride` 為 `controlType: 'custom'`
- Section 手動 render custom editor 的邏輯

## User Stories

- As a developer, I want the Display section to use schema-driven rendering for simple fields while keeping custom editors for complex ones.

## 驗收條件

- Given DisplaySection renders, when I compare with改造前, then 所有欄位的 UI 行為完全一致
- Given `booleanFields` constant, when I search DisplaySection.tsx, then 找不到
- Given `KNOWN_TEAMMATE_MODES`, when I search DisplaySection.tsx, then 找不到
- Given `spinnerVerbs`/`spinnerTipsOverride`, when I check render, then 仍用 custom editor（未被 SchemaFieldRenderer 取代）
- Given `npm run typecheck && npm test`, when I run them, then 全部通過
