---
title: 更新文件
created: 2026-03-15
priority: low
suggested_order: Z99
phase: needs-commit
iteration: 2
max_iterations: 3
review_iterations: 1
---

# 更新文件

同步 CLAUDE.md、README.md 與專案現況，確保文件反映所有 task 完成後的最新架構與功能。

## 範圍

- CLAUDE.md：更新架構表、Service 依賴、Settings 頁面分區、已知陷阱、新增 Setting Checklist 等
- README.md：更新功能列表、截圖（若有 UI 變更）
- i18n 文件：確認三語言 key 完整性

## User Stories

- As a 新成員, I want 文件反映最新架構, so that 能快速上手專案。

## 驗收條件

- Given 所有 task 完成後, when 讀 CLAUDE.md, then 內容與 source code 一致
- Given `npm run verify`, when 執行, then 通過（含 check:schema i18n 驗證）
