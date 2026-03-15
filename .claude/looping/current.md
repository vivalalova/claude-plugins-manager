---
title: SandboxEditor 獨立 component test
created: 2026-03-15
priority: medium
suggested_order: B2
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# SandboxEditor 獨立 component test

`SandboxEditor.tsx`（335 行）是近期新增的複雜 sub-editor，支援結構化模式和 JSON 雙模式切換。目前測試散在 `AdvancedSection.test.tsx`，覆蓋基本渲染和 save，但缺少獨立邊界測試。

## 修復方向

新增 `SandboxEditor.test.tsx`，覆蓋：

1. 結構化模式各 checkbox/path 新增刪除互動
2. JSON 模式無效 JSON 輸入的錯誤提示
3. 模式切換時資料保留/轉換正確性
4. 空值 vs undefined vs `{}` 的行為差異

## User Stories

- As a 維護者, I want SandboxEditor 的複雜互動有獨立測試, so that 重構時模式切換和無效輸入不會壞掉

## 驗收條件

- Given SandboxEditor.test.tsx, when `npm test`, then 全部通過
- Given 結構化模式, when 新增/刪除 allow path, then onSave 收到正確結構
- Given JSON 模式輸入無效 JSON, when blur, then 顯示錯誤提示且不觸發 onSave
- Given 從結構化切換到 JSON, when 查看 JSON 內容, then 反映結構化模式的值
- Given value 為 `undefined`（未設定）, when 渲染, then 結構化模式顯示空狀態不拋錯
