---
title: 改造 GeneralSection — schema-driven 渲染
created: 2026-03-14
priority: high
suggested_order: B01
blockedBy: [c01-schema-field-renderer, c02-enum-label-i18n, c03-text-number-i18n]
phase: needs-commit
iteration: 3
max_iterations: 3
review_iterations: 2
---

# 改造 GeneralSection — schema-driven 渲染

將 `GeneralSection` 的硬編碼欄位替換為 schema-driven 渲染。

## 改造範圍

1. **移除 `booleanFields[]` 陣列** — 改為從 `CLAUDE_SETTINGS_SCHEMA` 過濾 `section === 'general' && controlType === 'boolean'` 的 entries
2. **移除手動 `EnumDropdown` 呼叫** — `effortLevel`、`autoUpdatesChannel` 改用 `SchemaFieldRenderer`
3. **移除手動 `TextSetting` 呼叫** — `language`、`outputStyle` 改用 `SchemaFieldRenderer`
4. **移除手動 `NumberSetting` 呼叫** — `cleanupPeriodDays` 改用 `SchemaFieldRenderer`
5. **移除手動 `TagInput` 呼叫** — `availableModels` 改用 `SchemaFieldRenderer`

## 保留不動

- Section title、docs hint 等手寫 JSX
- 欄位順序需與改造前一致（根據 schema 中 key 的定義順序，或在 Section 中明確排序）
- `enableAllProjectMcpServers` 如有特殊行為需保留

## User Stories

- As a developer, I want the General section to derive its fields from the schema so that adding a new general boolean setting requires zero code changes in GeneralSection.

## 驗收條件

- Given GeneralSection renders, when I compare with改造前, then 欄位順序、控制元件類型、label、description 完全一致
- Given `booleanFields` constant, when I search GeneralSection.tsx, then 找不到（已移除）
- Given `KNOWN_EFFORT_LEVELS` constant, when I search GeneralSection.tsx, then 找不到（已移至 schema）
- Given 新增一個 `controlType: 'boolean', section: 'general'` 的 schema entry, when GeneralSection renders, then 自動出現新欄位（zero code change）
- Given `npm run typecheck && npm test`, when I run them, then 全部通過
