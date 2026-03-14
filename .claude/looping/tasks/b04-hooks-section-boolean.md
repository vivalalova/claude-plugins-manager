---
title: HooksSection disableAllHooks boolean 用 SchemaFieldRenderer
created: 2026-03-14
priority: medium
suggested_order: B04
blockedBy: c01-schema-field-renderer
---

# HooksSection disableAllHooks boolean 用 SchemaFieldRenderer

`HooksSection` 整體是 custom editor，但 `disableAllHooks` 是一個獨立的 boolean toggle。將這個單一 boolean 改為用 `SchemaFieldRenderer` 渲染，保持一致性。

## 改造範圍

僅 `disableAllHooks` 的 `BooleanToggle` 呼叫改為 `SchemaFieldRenderer`。其餘 hooks 編輯器完全不動。

## User Stories

- As a developer, I want even the simple boolean fields inside complex sections to use the schema renderer for consistency.

## 驗收條件

- Given HooksSection renders, when I check `disableAllHooks` toggle, then 它由 SchemaFieldRenderer 渲染
- Given HooksSection, when I check hooks editor, then 其餘 UI 完全不變
- Given `npm run typecheck && npm test`, when I run them, then 全部通過
