---
title: 更新文件
created: 2026-03-13
priority: low
suggested_order: Z99
blockedBy: t01-extension-info-tests
---

# 更新文件

更新專案文件反映新增的 Extension Info 分頁。

## 異動範圍

1. **CLAUDE.md**：
   - Services 表格加 `ExtensionInfoService` 行（資料來源、職責）
   - 架構說明加 Info 頁面描述
   - PanelCategory 說明加 `'info'`

2. **README.md**（如有功能說明段落）：
   - 加上 Extension Info 分頁功能描述

## User Stories

- As a developer or contributor, I want documentation to reflect the latest features, so that I can understand and maintain the codebase

## 驗收條件

- Given CLAUDE.md 已更新，When 開發者閱讀架構章節，Then 能看到 ExtensionInfoService 的職責說明
- Given CLAUDE.md 已更新，When 搜尋 PanelCategory，Then 包含 `'info'`
- Given 所有文件更新完成，When 執行 `npm run typecheck && npm test && npm run build`，Then 全部通過
