---
title: PluginPage.tsx 拆分子元件
created: 2026-03-15
priority: low
suggested_order: C3
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# PluginPage.tsx 拆分子元件

`PluginPage.tsx` 704 行，已拆 4 個 hooks（usePluginData/Filters/Operations/Translation），但 render 部分仍約 500 行含多個 inline Dialog 和 bulk 操作 UI。

## 修復方向

1. 拆出 `PluginDialogs.tsx`（install/uninstall/bulk enable scope dialog + translate dialog）
2. 拆出 `PluginToolbar.tsx`（搜尋框 + filter chips + bulk 操作按鈕）
3. PluginPage 只保留 state 管理 + layout 組合

## User Stories

- As a 開發者, I want 修改某個 dialog 行為時不需在 700 行的檔案裡來回跳轉, so that 開發效率更高

## 驗收條件

- Given 拆分後, when PluginPage.tsx 行數, then < 400 行
- Given 拆分後, when 所有 PluginPage 相關測試, then 全部通過
- Given 修改完成, when `npm run verify`, then 全部通過
