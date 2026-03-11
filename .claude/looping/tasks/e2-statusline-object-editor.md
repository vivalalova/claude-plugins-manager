---
title: Advanced section — statusLine 物件編輯器
created: 2026-03-11
priority: low
suggested_order: E2
blockedBy: [a1-extract-shared-setting-components, a2-number-setting-component, a3-display-advanced-nav-sections]
---

# Advanced section — statusLine 物件編輯器

在 Advanced section 加入 statusLine 設定（自訂狀態列命令 + padding）。

## User Stories

- As a power user, I want to configure a custom status line command.

## 實作範圍

- `ClaudeSettings` 加 `statusLine?: { type: 'command'; command: string; padding?: number }`
- Compound editor：text input for command, NumberSetting for padding, type 固定 'command'
- Save 整個 statusLine object
- i18n 加 label + description + placeholder
- 更新 AdvancedSection 測試

## 驗收條件

- Given Advanced section, when 載入, then 顯示 statusLine 區塊
- Given statusLine 未設定, when 只輸入 command 並儲存（padding 留空）, then onSave('statusLine', { type: 'command', command: '...' }) 被呼叫（無 padding key）
- Given statusLine 未設定, when 輸入 command + padding=2 並儲存, then onSave('statusLine', { type: 'command', command: '...', padding: 2 }) 被呼叫
- Given statusLine 有值, when 清除, then onDelete('statusLine') 被呼叫
