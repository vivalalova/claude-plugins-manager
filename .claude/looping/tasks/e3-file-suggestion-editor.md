---
title: Advanced section — fileSuggestion 命令設定
created: 2026-03-11
priority: low
suggested_order: E3
blockedBy: [a1-extract-shared-setting-components, a3-display-advanced-nav-sections]
---

# Advanced section — fileSuggestion 命令設定

在 Advanced section 加入 fileSuggestion 設定（自訂 @ 檔案建議命令）。

## User Stories

- As a user, I want to customize the @ file autocomplete behavior with a custom command.

## 實作範圍

- `ClaudeSettings` 加 `fileSuggestion?: { type: 'command'; command: string }`
- 單一 text input for command, type 固定 'command'
- Save 整個 fileSuggestion object
- i18n + 測試

## 驗收條件

- Given Advanced section, when 載入, then 顯示 fileSuggestion text input
- Given fileSuggestion 未設定, when 輸入 command 並儲存, then onSave('fileSuggestion', { type: 'command', command: '...' }) 被呼叫
