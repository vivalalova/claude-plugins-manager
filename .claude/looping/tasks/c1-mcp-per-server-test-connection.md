---
title: McpService.testServer() + UI loading 提示（Test Connection 單一 server）
created: 2026-03-15
priority: medium
suggested_order: C1
---

# McpService.testServer() + UI loading 提示（Test Connection 單一 server）

`McpPage.handleTestConnection()` 對單一 server 點擊 Test 時，發送 `mcp.refreshStatus` 觸發全量 `claude mcp list`（30s timeout），測試所有 server 再從結果中 find 對應 server。server 數量多時延遲高。

## 修復方向

1. 先確認 CLI 是否支援 `claude mcp list <name>` 或其他單一 server 狀態查詢
2. 若支援：新增 `mcp.testServer` protocol message + `McpService.testServer(name, scope)` method
3. 若不支援：維持現狀但加 UI 提示「正在檢查所有 server 狀態...」，避免使用者誤以為卡住

## User Stories

- As a 使用者, I want 點擊單一 server 的 Test Connection 時只等該 server 的結果, so that 不用等全部 server 檢查完

## 驗收條件

- Given CLI 支援 `claude mcp list <name>`, when 新增 `McpService.testServer(name, scope)`, then method 呼叫 `claude mcp list <name>` 而非全量 `claude mcp list`
- Given CLI 支援, when 點擊 Test Connection, then 只更新該 server 的狀態，其他 server loading 狀態不變
- Given CLI 不支援單一查詢, when 點擊 Test Connection, then button/狀態列顯示「正在檢查所有 server 狀態...」文字（可用 DOM 斷言）
- Given 修改完成, when `npm run verify`, then 全部通過
