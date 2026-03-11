---
title: Display section — spinner 動詞 + 提示自訂
created: 2026-03-11
priority: low
suggested_order: G1
blockedBy: [a1-extract-shared-setting-components, a3-display-advanced-nav-sections]
---

# Display section — spinner 動詞 + 提示自訂

在 Display section 加入 spinnerVerbs 和 spinnerTipsOverride 自訂。

**前置研究：** 先確認 Claude Code 設定檔中 spinnerVerbs 和 spinnerTipsOverride 的確切型別（key 結構、value 格式），再決定 UI 方案。

## User Stories

- As a user, I want to customize spinner verbs and tip messages.

## 前置作業（執行前必做）

1. 查閱 Claude Code JSON schema（`https://www.schemastore.org/claude-code-settings.json`）中 spinnerVerbs 和 spinnerTipsOverride 的完整 schema 定義
2. 確認 key 是固定枚舉（如 effortLevel）還是任意字串
3. 根據型別決定 UI 方案：
   - 固定 key → 結構化 key-value editor
   - 任意 Record → JSON textarea editor（同 g2 sandbox 方案）
   - string[] → TagInput

## 實作範圍

- `ClaudeSettings` 加 `spinnerVerbs?: Record<string, string[]>`, `spinnerTipsOverride?: Record<string, string[]>`（型別待前置確認後調整）
- DisplaySection 根據確認的 UI 方案實作
- i18n + 測試

## 驗收條件（根據前置確認的型別填入具體值）

- Given Display section, when 載入, then 顯示 spinnerVerbs 和 spinnerTipsOverride 編輯器
- Given spinnerVerbs 的確切結構已確認, when 用戶編輯並儲存, then onSave('spinnerVerbs', &lt;具體 payload&gt;) 被呼叫
- Given 輸入非法值（如 JSON 格式錯誤）, when 儲存, then 顯示錯誤且不儲存
