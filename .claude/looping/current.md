---
title: 改造 AdvancedSection — schema-driven 渲染
created: 2026-03-14
priority: high
suggested_order: B03
blockedBy: [c01-schema-field-renderer, c02-enum-label-i18n, c03-text-number-i18n]
phase: needs-commit
iteration: 2
max_iterations: 3
review_iterations: 1
---

# 改造 AdvancedSection — schema-driven 渲染

將 `AdvancedSection` 的硬編碼 text、boolean、enum 欄位替換為 schema-driven 渲染。

## 改造範圍

1. **移除 `TEXT_FIELD_KEYS[]` 陣列** — text 欄位改用 SchemaFieldRenderer（從 schema 過濾 `section === 'advanced' && controlType === 'text'`）
2. **移除 `DEFAULT_VALUES` 常數** — default 值已在 schema
3. **移除 `KNOWN_FORCE_LOGIN_METHODS` 常數** — `forceLoginMethod` enum 改用 SchemaFieldRenderer
4. **`skipWebFetchPreflight` boolean** — 改用 SchemaFieldRenderer

涉及的 text 欄位：`forceLoginOrgUUID`、`plansDirectory`、`apiKeyHelper`、`otelHeadersHelper`、`awsCredentialExport`、`awsAuthRefresh`（確認實際清單）

## 保留不動

- `AttributionEditor` — `controlType: 'custom'`
- `StatusLineEditor` — `controlType: 'custom'`
- `SandboxEditor` — `controlType: 'custom'`
- `CompanyAnnouncementsEditor` — `controlType: 'custom'`
- `fileSuggestion` — 目前用 `TextSetting` + wrapper onSave（將 string 包成 `{ type: 'command', command }`），保持 `controlType: 'custom'` 不改動

## User Stories

- As a developer, I want the Advanced section to eliminate its TEXT_FIELD_KEYS/DEFAULT_VALUES arrays and read everything from the schema.

## 驗收條件

- Given AdvancedSection renders, when I compare with改造前, then 所有欄位 UI 行為一致
- Given `TEXT_FIELD_KEYS`, when I search AdvancedSection.tsx, then 找不到
- Given `DEFAULT_VALUES`, when I search AdvancedSection.tsx, then 找不到
- Given attribution/statusLine/sandbox, when I check render, then 仍用 custom editor
- Given `npm run typecheck && npm test`, when I run them, then 全部通過
