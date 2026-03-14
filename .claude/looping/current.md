---
title: Schema 完整性測試 — controlType 覆蓋所有 key
created: 2026-03-14
priority: medium
suggested_order: T03
blockedBy: a01-extend-schema-ui-metadata
phase: needs-commit
iteration: 2
max_iterations: 3
review_iterations: 1
---

# Schema 完整性測試 — controlType 覆蓋所有 key

新增 vitest 測試，斷言 `CLAUDE_SETTINGS_SCHEMA` 的每個 key 都有 `controlType`，且值屬於合法 enum。這是 A04 驗證腳本的 runtime 補充。

## 測試案例

1. 每個 key 都有 `controlType` 欄位
2. `controlType` 值屬於 `['boolean', 'enum', 'text', 'number', 'tagInput', 'custom']`
3. `controlType: 'enum'` 的 entry 都有 `options` 陣列且 length > 0
4. `controlType: 'number'` 有 `min`/`max` 時，`min <= max`
5. 所有 `section` 值屬於合法 enum

測試位置建議：`src/shared/__tests__/claude-settings-schema.test.ts`

## User Stories

- As a developer, I want a test that fails when someone adds a new setting key without specifying its controlType.

## 驗收條件

- Given 正確的 schema, when I run test, then 全部通過
- Given 新增一個沒有 controlType 的 key, when I run test, then 失敗並指出該 key
- Given `npm run verify`, when I run it, then 全部通過
