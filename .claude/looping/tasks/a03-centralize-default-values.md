---
title: 集中 defaultValue 到 schema
created: 2026-03-14
priority: high
suggested_order: A03
blockedBy: a01-extend-schema-ui-metadata
---

# 集中 defaultValue 到 schema

目前 `defaultValue` 散落在各 Section 元件：
- `GeneralSection` 的 `booleanFields[].defaultValue`
- `AdvancedSection` 的 `DEFAULT_VALUES`
- `DisplaySection` 的 inline 判斷

將所有 default 值搬到 `CLAUDE_SETTINGS_SCHEMA` 的 `default` 欄位，Section 元件改為讀 schema。

已知 default 值（需確認完整清單）：
- `includeGitInstructions: true`
- `respectGitignore: true`
- `autoMemoryEnabled: true`
- `fastMode: false`
- `fastModePerSessionOptIn: false`
- `effortLevel: 'high'`
- `autoUpdatesChannel: 'latest'`
- `cleanupPeriodDays: 30`
- `plansDirectory: '~/.claude/plans'`（已有）
- `teammateMode: 'auto'`
- Display section boolean defaults

## User Stories

- As a developer, I want all default values defined in one place (the schema) so that renderer and Section components don't drift.

## 驗收條件

- Given `CLAUDE_SETTINGS_SCHEMA`, when I check boolean entries, then 每個都有 `default` 值
- Given `GeneralSection.tsx`, when I search `defaultValue`, then 不再有硬編碼的 default（從 schema 讀取）
- Given `AdvancedSection.tsx`, when I search `DEFAULT_VALUES`, then 已移除或改為從 schema import
- Given `npm run typecheck && npm test`, when I run them, then 全部通過
