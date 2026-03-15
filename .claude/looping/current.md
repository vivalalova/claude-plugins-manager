---
title: 更新 CLAUDE.md 文件
created: 2026-03-15
priority: low
suggested_order: Z99
blockedBy: [c2-styles-css-modularize, c3-plugin-page-split, c1-mcp-per-server-test-connection]
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# 更新 CLAUDE.md 文件

上述任務完成後，更新 CLAUDE.md 反映架構變更。

## 更新項目

1. styles.css 拆分後的新結構說明（C2 完成後）
2. PluginPage 拆分後的子元件清單（C3 完成後）
3. 若 MCP per-server test 實現，更新 MCP service 描述（C1 完成後）
4. 其他因任務執行而產生的架構變更

## User Stories

- As a 新進開發者, I want CLAUDE.md 反映最新架構, so that 快速上手專案

## 驗收條件

- Given C2 完成, when grep `styles/` CLAUDE.md, then 出現子檔案結構說明（base.css/sidebar.css/... 至少 3 個）
- Given C3 完成, when grep `PluginDialogs\|PluginToolbar` CLAUDE.md, then 出現子元件名稱
- Given C1 完成且 testServer 實作, when grep `testServer` CLAUDE.md, then McpService 描述有對應說明
- Given CLAUDE.md 更新, when `npm run verify`, then 全部通過
