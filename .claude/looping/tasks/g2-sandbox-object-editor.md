---
title: Advanced section — sandbox 設定編輯器
created: 2026-03-11
priority: low
suggested_order: G2
blockedBy: [a1-extract-shared-setting-components, a3-display-advanced-nav-sections]
---

# Advanced section — sandbox 設定編輯器

在 Advanced section 加入 sandbox 設定（複雜 nested object，用 JSON editor）。

## User Stories

- As a power user, I want to configure sandbox settings from the UI.

## 前置作業（執行前必做）

查閱 `https://www.schemastore.org/claude-code-settings.json` 中 `sandbox` 欄位的完整 schema 定義，確認已知子欄位，更新 type 為精確 interface（如有固定欄位）。若 schema 為開放式 object，維持 `Record<string, unknown>` 並記錄理由。

## 實作範圍

- `ClaudeSettings` 加 `sandbox?: SandboxConfig`（型別根據前置作業確認後定義）
- JSON textarea editor + 語法驗證（通用 JsonEditor 元件，可與 g1 共用）
- 顯示目前值為 formatted JSON，可編輯後 save
- i18n + 測試

## 驗收條件

- Given Advanced section, when 載入, then 顯示 sandbox JSON editor
- Given sandbox 未設定, when 輸入合法 JSON 並儲存, then onSave('sandbox', parsedObject) 被呼叫
- Given sandbox editor, when 輸入非法 JSON, then 顯示錯誤提示且無法儲存
