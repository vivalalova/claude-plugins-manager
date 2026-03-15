---
title: MCP polling 僅 MCP 頁可見時執行
created: 2026-03-15
priority: medium
suggested_order: A4
---

# MCP polling 僅 MCP 頁可見時執行

McpService 的 status polling 用 `setInterval` 定期呼叫 `claude mcp list`，即使 webview 切到其他頁面（plugin、settings 等）仍持續執行。應在離開 MCP 頁時暫停 polling，切回時恢復。

## 設計方向

- `EditorPanelManager` 已有 `openPanel(category)` 方法，可在 category 切換時通知 polling 狀態
- 或在 webview 端由 `McpPage` mount/unmount 時發送 `mcp.startPoll` / `mcp.stopPoll` message
- 需確保 panel dispose 時也 stopPolling（已有此邏輯）

## User Stories

- As a 使用者, I want 離開 MCP 頁面後不再持續 poll CLI, so that 節省系統資源。

## 驗收條件

- Given 使用者開啟 MCP 頁面, when 切換到 plugin 頁面, then polling 停止（不再呼叫 `claude mcp list`）
- Given 使用者從 plugin 頁切回 MCP 頁, when MCP 頁顯示, then polling 重新啟動
- Given 使用者關閉 editor panel, when panel dispose, then polling 停止（既有行為不 regress）
