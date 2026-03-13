---
title: 拆分 AdvancedSection 子編輯器 (AdvancedSection)
created: 2026-03-13
priority: medium
suggested_order: A2
---

# 拆分 AdvancedSection 子編輯器

AdvancedSection.tsx 590+ 行，含 4 個內嵌子元件（`AttributionEditor`、`StatusLineEditor`、`SandboxEditor`、`CompanyAnnouncementsEditor`）。各子元件有獨立 state 與 save 邏輯。

提取至 `src/webview/editor/settings/components/`，AdvancedSection 變薄層 orchestrator。

## User Stories

- As a developer, I want 各複雜編輯器獨立檔案，so that 導覽、測試、維護不需翻 600 行

## 驗收條件

- Given AdvancedSection render，when 與拆分前相同 props，then 產出 HTML 結構不變（4 個子編輯器皆出現）
- Given `AttributionEditor`、`StatusLineEditor`、`SandboxEditor`、`CompanyAnnouncementsEditor` 各自檔案，when 查看，then 各自 ≤ 150 行
- Given AdvancedSection.tsx，when 查看，then ≤ 100 行（薄層 orchestrator）
- Given 拆分後 `src/webview/editor/settings/components/` 目錄，when `npm run typecheck`，then 無錯誤
- Given 現有測試（或新增 smoke test），when `npm test`，then 全部通過
