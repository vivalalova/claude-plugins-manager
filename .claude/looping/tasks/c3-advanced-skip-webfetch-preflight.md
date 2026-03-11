---
title: Advanced section — skipWebFetchPreflight toggle
created: 2026-03-11
priority: low
suggested_order: C3
blockedBy: [a1-extract-shared-setting-components, a3-display-advanced-nav-sections]
phase: needs-review
iteration: 2
max_iterations: 3
---

# Advanced section — skipWebFetchPreflight toggle

在 Advanced section 加入 skipWebFetchPreflight boolean toggle。

## User Stories

- As an enterprise user, I want to skip the WebFetch blocklist check.

## 實作範圍

- `ClaudeSettings` 加 `skipWebFetchPreflight?: boolean`
- AdvancedSection 用 BooleanToggle 渲染
- i18n 加 label + description
- 更新 AdvancedSection 測試

## 驗收條件

- Given Advanced section, when 載入, then 顯示 skipWebFetchPreflight toggle
- Given skipWebFetchPreflight 未設定, when toggle on, then onSave('skipWebFetchPreflight', true) 被呼叫
