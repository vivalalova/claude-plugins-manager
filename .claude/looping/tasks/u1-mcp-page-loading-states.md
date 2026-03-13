---
title: MCP 頁面 loading 狀態
created: 2026-03-13
priority: medium
suggested_order: U1
---

# MCP 頁面 loading 狀態

McpService 操作（add、remove、refreshStatus）執行中 MCP 頁面無 loading indicator。CLI 可能跑 30-60 秒，使用者無回饋。

為 McpPage 加 loading/spinner：add 操作（dialog submit button）、remove（card button）、refresh（toolbar button）。參考 PluginPage `updating {current}/{total}` 模式。

## User Stories

- As a user, I want MCP 操作時看到 loading indicator，so that 知道正在處理、不會重複觸發

## 驗收條件

- Given add MCP server, when CLI 執行中, then dialog submit button 顯示 spinner + disabled
- Given remove MCP server, when CLI 執行中, then card button 顯示 loading + disabled
- Given refresh, when 執行中, then toolbar button 顯示 loading
- Given 操作完成, when CLI 回傳, then loading 消失、列表更新
