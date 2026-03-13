---
title: McpService integration test
created: 2026-03-13
priority: high
suggested_order: T2
---

# McpService integration test

McpService 有 1081 行 unit test（heavy mock）但零 integration test。`buildServerMetadata()` 讀 `~/.claude.json`、`{workspace}/.mcp.json`、`installed_plugins.json`，file reading/parsing bug 對 unit test 不可見。

用 temp directory + 真實檔案寫 integration test，覆蓋：`listFromFiles()` 多種 config 組合、`parseMcpList()` 已知輸出格式、`buildServerMetadata()` scope resolution。

## User Stories

- As a developer, I want McpService 有 integration test 覆蓋真實 file read，so that config parsing bug 不會到使用者手上

## 驗收條件

- Given temp dir 同時含 `~/.claude.json`（user scope）+ `{workspace}/.mcp.json`（project scope），when `listFromFiles()`，then 兩個 scope 的 server 皆出現且 scope 欄位正確
- Given temp dir 僅含 `~/.claude.json`，when `listFromFiles()`，then 只回傳 user scope entries，不拋錯
- Given temp dir 無任何 config 檔，when `listFromFiles()`，then 回傳空陣列不拋錯
- Given `parseMcpList()` 輸入：(1) 空字串 (2) 單一 server 正常輸出 (3) 多 server 含 running/stopped 狀態，when 解析，then 回傳正確 server 數量與狀態
- Given `installed_plugins.json` 含 plugin 有 MCP config，when `buildServerMetadata()`，then plugin 來源 server 的 `fromPlugin` 欄位正確填入
- Given `npm test`，when 執行，then 全部通過
