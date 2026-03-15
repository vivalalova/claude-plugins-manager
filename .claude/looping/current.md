---
title: Sandbox 結構化 sub-editor
created: 2026-03-15
priority: low
suggested_order: B5
phase: needs-commit
iteration: 2
max_iterations: 3
review_iterations: 1
max_review_iterations: 2
---

# Sandbox 結構化 sub-editor

`SandboxEditor` 目前是 raw JSON textarea，用戶需手動編寫 JSON。應改為結構化表單，同時保留 raw JSON 模式作為進階切換。

## 前置步驟

執行前**必須**先查官方文件確認 sandbox schema 完整欄位：
- 參考 https://code.claude.com/docs/en/settings（CLAUDE.md 中的設定頁參數參考）
- 確認 `sandbox` 的實際 type 欄位值、`writePaths`、`network` 等完整結構後再動工
- 若文件未記載 sandbox schema，以現有 `SandboxEditor.tsx` 解析的結構為準

## 設計方向

- 根據確認的 sandbox schema 實作結構化表單
- 結構化模式：type selector（linux/docker 等）、writePaths tag input、network 設定等
- Raw JSON 模式：保留現有 textarea
- 切換按鈕：「結構化」/「JSON」
- JSON 模式修改的內容在切換到結構化模式時需正確解析

## User Stories

- As a 使用者, I want 透過表單 UI 設定 sandbox, so that 不需手動編寫 JSON 並擔心格式錯誤。
- As a 進階使用者, I want 仍可切換到 raw JSON 模式, so that 能直接編輯完整配置。

## 驗收條件

- Given Sandbox 結構化模式, when 選擇 type 並填入 writePaths, then 儲存時寫入正確 JSON 結構
- Given Sandbox 有既有 JSON 值, when 開啟結構化模式, then 正確解析並顯示各欄位
- Given 結構化模式中修改, when 切到 JSON 模式, then JSON 反映結構化的修改
- Given JSON 模式中修改, when 切到結構化模式, then 正確解析新 JSON
