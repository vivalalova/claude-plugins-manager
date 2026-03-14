---
title: 擴充 SettingFieldSchema — 加入 UI metadata
created: 2026-03-14
priority: critical
suggested_order: A01
---

# 擴充 SettingFieldSchema — 加入 UI metadata

在 `src/shared/claude-settings-schema.ts` 的 `SettingFieldSchema` interface 新增 optional UI 欄位，讓 schema 可驅動 UI 渲染。

新增欄位：
- `controlType`: `'boolean' | 'enum' | 'text' | 'number' | 'tagInput' | 'custom'` — 決定渲染哪種控制元件
- `options?`: `readonly string[]` — enum 的選項陣列
- `min?` / `max?` / `step?`: `number` — number 欄位的驗證約束

在 `CLAUDE_SETTINGS_SCHEMA` 的每個 key 補上 `controlType`：
- boolean 欄位 → `'boolean'`
- union 字串欄位 → `'enum'`
- 純 string → `'text'`
- number → `'number'`
- string[] → `'tagInput'`
- 複雜物件（spinnerVerbs、sandbox、hooks 等）→ `'custom'`

所有新增欄位皆 optional，向後相容。`default` 欄位已存在，語意不變。

## User Stories

- As a developer maintaining the settings UI, I want each schema entry to declare its control type and UI constraints so that a generic renderer can automatically pick the right component without hardcoding.

## 驗收條件

- Given `SettingFieldSchema` interface, when I check the type definition, then `controlType`, `options`, `min`, `max`, `step` 皆為 optional 欄位
- Given `CLAUDE_SETTINGS_SCHEMA`, when I inspect any key, then 它有 `controlType` 值
- Given a `controlType: 'enum'` entry, when I check its definition, then 它有 `options` 陣列
- Given a `controlType: 'number'` entry with min/max, when I check, then `min <= max`
- Given `npm run check:schema`, when I run it, then 通過（key 一致性不受影響）
- Given `npm run typecheck`, when I run it, then 通過
