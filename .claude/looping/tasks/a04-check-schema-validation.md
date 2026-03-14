---
title: check:schema 腳本擴充 — 驗證 controlType 與 options
created: 2026-03-14
priority: high
suggested_order: A04
blockedBy: a01-extend-schema-ui-metadata
---

# check:schema 腳本擴充 — 驗證 controlType 與 options

擴充 `scripts/check-settings-schema.ts`，除了比對 key 一致性外，新增驗證規則：

1. 每個 schema entry 必須有 `controlType`
2. `controlType: 'enum'` 必須有 `options` 陣列且長度 > 0
3. `controlType: 'number'` 有 `min`/`max` 時，`min <= max`
4. `controlType: 'custom'` 不該有 `options`/`min`/`max`（防誤設）
5. `options` 內的值不能有重複

失敗時 exit 1 並列出所有錯誤（不只第一個）。

## User Stories

- As a developer, I want the CI validation script to catch schema inconsistencies (missing controlType, enum without options) so bugs are found before runtime.

## 驗收條件

- Given a schema entry without `controlType`, when I run `npm run check:schema`, then exit 1 並報錯
- Given `controlType: 'enum'` without `options`, when I run check, then exit 1
- Given `controlType: 'number'` with `min: 10, max: 5`, when I run check, then exit 1
- Given 正確的 schema, when I run `npm run check:schema`, then exit 0
- Given `package.json` verify script, when I run `npm run verify`, then 包含 check:schema（需將 `npm run check:schema` 加入 verify 指令）
