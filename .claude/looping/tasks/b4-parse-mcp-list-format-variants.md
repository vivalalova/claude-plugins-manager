---
title: McpService.parseMcpList() 格式變體 integration test
created: 2026-03-15
priority: medium
suggested_order: B4
---

# McpService.parseMcpList() 格式變體 integration test

`parseMcpList()` 以 regex 解析 `claude mcp list` 文字輸出，格式依賴 CLI 版本。目前 integration test 覆蓋正常格式，但缺少邊界變體。

## 修復方向

在 `McpService.integration.test.ts` 或獨立 `parseMcpList.test.ts` 補充：

1. ANSI escape codes 嵌在 server name 中
2. command 含冒號的 server（如 `npx -y @foo/bar:cmd`）
3. 0 results（只有 header 無 server 行）
4. 多行 header 變體
5. 解析 0 results 時加 warning log（若 metadata 有資料）

## User Stories

- As a 維護者, I want CLI 輸出格式微調時解析器不會靜默丟失 server, so that MCP 狀態顯示始終正確

## 驗收條件

- Given ANSI escape codes 嵌入輸出, when parseMcpList(), then server name 正確擷取（不含 escape codes）
- Given command 含冒號（如 `npx -y @foo/bar:cmd`）, when parseMcpList(), then command 欄位完整保留冒號後的部分
- Given 0 results 輸出（只有 header）, when parseMcpList(), then 回傳空陣列且不拋錯
- Given 0 results 且 metadata 有資料, when parseMcpList(), then 輸出 warning log
- Given 修改完成, when `npm run verify`, then 全部通過
