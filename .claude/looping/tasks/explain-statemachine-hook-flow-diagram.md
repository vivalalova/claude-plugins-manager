---
title: 「解釋」功能：狀態機 hook 以 flow 圖取代文字說明
created: 2026-03-14
priority: medium
---

# 「解釋」功能：狀態機 hook 以 flow 圖取代文字說明

當使用「解釋」功能（或任何需要說明 hook 行為的場景）遇到 hook 設計為狀態機模式時，應以 flow diagram（流程圖）呈現，而非純文字描述。

狀態機 hook 的特徵：具有多個 phase/state（如 `executing → needs-review → needs-commit → completed/failed`）、狀態轉換條件、迭代計數器等。這類設計用文字描述容易遺漏轉換路徑，flow 圖能一目了然。

## User Stories

- As a 開發者, I want 狀態機 hook 的解釋以 flow 圖呈現, so that 我能快速理解所有狀態轉換路徑而不遺漏分支

## 驗收條件

- Given hook 程式碼包含狀態機設計（多 phase、狀態轉換邏輯）, when 使用「解釋」功能, then 輸出包含 Mermaid/ASCII flow diagram 而非純文字列舉
- Given hook 程式碼是簡單的線性邏輯（無狀態機）, when 使用「解釋」功能, then 維持原有文字說明方式不變
