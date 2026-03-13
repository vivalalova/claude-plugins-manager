---
title: 遷移 PushMessage 型別 (protocol.ts)
created: 2026-03-13
priority: medium
suggested_order: A3
---

# 遷移 PushMessage 型別

`protocol.ts` 有 TODO：將 `ResponseMessage` 中的 push broadcast（`mcp.statusUpdate`、`mcp.pollUnavailable`、`plugin.refresh`、`marketplace.refresh`、`settings.refresh`）遷入 `PushMessage` union。這些不是 request/response pair，是單向推送。

更新所有 producer（McpService events、FileWatcherService）與 consumer（webview message handler）。

## User Stories

- As a developer, I want protocol types 正確區分 push broadcast 與 request/response，so that pattern match 安全無歧義

## 驗收條件

- Given PushMessage, when 檢查 union variants, then 包含所有 push broadcast type
- Given ResponseMessage, when 檢查, then 不含任何 push broadcast type
- Given webview handler, when 收到 push message, then 正確處理新型別
- Given `npm run typecheck`, when 執行, then 無錯誤
