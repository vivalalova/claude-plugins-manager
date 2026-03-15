---
title: MCP per-server 測試連線按鈕
created: 2026-03-15
priority: medium
suggested_order: B2
---

# MCP per-server 測試連線按鈕

MCP 頁面目前只能被動等待 polling 更新 server 狀態。應在 McpServerCard 上加「Test Connection」按鈕，主動觸發單一 server 的連線測試。

## 設計方向

- McpService 新增 `testConnection(name: string): Promise<McpServer>` 方法
- 實作方式：呼叫 `claude mcp list` 解析單一 server 結果，或直接 `claude mcp serve` 測試
- MessageRouter 新增 `mcp.testConnection` route
- McpServerCard 加 Test 按鈕 + loading 狀態
- Test 結果更新該 server 的 status，不影響其他 server

## User Stories

- As a 使用者, I want 新增 MCP server 後能立即測試連線, so that 不需等待下一次 poll cycle。

## 驗收條件

- Given 一個 status=failed 的 MCP server, when 點擊 Test Connection, then 按鈕顯示 loading 狀態
- Given Test Connection 成功, when 結果回傳, then server status 更新為 connected
- Given Test Connection 失敗, when 結果回傳, then 顯示錯誤訊息
