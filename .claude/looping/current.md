---
title: styles.css 模組化拆分
created: 2026-03-15
priority: medium
suggested_order: C2
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# styles.css 模組化拆分

`src/webview/styles.css` 單一檔案 2286 行，內含 27+ section（Animations、Sidebar、Editor Pages、Cards、Filter Chips、Scope Badges、Plugin Contents、MCP Status、Buttons、Settings、Dialogs、Toast 等）。難以定位、class name 衝突風險高。

## 修復方向

1. 建立 `src/webview/styles/` 目錄
2. 按現有 section comment 拆分為子檔案：`base.css`（全域 reset + animations）、`sidebar.css`、`cards.css`、`mcp.css`、`settings.css`、`dialogs.css`、`common.css`（buttons/toast/badges）
3. `styles.css` 改為 `@import` 彙總
4. 確認 esbuild 配置支援 CSS import

## User Stories

- As a 開發者, I want 修改特定 domain 的樣式時只需看對應檔案, so that 不用在 2286 行的大檔案裡搜索

## 驗收條件

- Given 拆分後, when `npm run build`, then CSS bundle 產出且 bundle size 與拆分前差異 < 1%
- Given 拆分後, when `grep -r "class=" src/webview/` 抽出所有 class name 對比拆分前的 CSS 選擇器, then 0 個 class 找不到對應樣式定義
- Given 拆分後, when `src/webview/styles.css` 行數, then 只剩 @import 行（< 20 行）
- Given 修改完成, when `npm run verify`, then 全部通過
