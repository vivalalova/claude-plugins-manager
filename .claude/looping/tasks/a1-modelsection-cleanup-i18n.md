---
title: ModelSection 硬編碼清除 + toast i18n
created: 2026-03-15
priority: high
suggested_order: A1
---

# ModelSection 硬編碼清除 + toast i18n

`SettingsPage.tsx` 的 `ModelSection` 有兩個問題：

1. `KNOWN_MODELS` 硬編碼 3 個模型名稱（claude-opus-4-6 等），與 schema 系統分離。應將 model fallback 清單統一到 `claude-settings-schema.ts` 的 `model` entry（如 `options` 欄位），直接打包進 source code。注意：schema 是 source code 內建的靜態定義，UI 直接 import 使用，不需動態抓取。
2. `addToast('Model saved', 'success')` / `addToast('Model cleared', 'success')` 為硬編碼英文，應改用 `t()` i18n key，三語言檔同步新增。

## User Stories

- As a 非英語使用者, I want 儲存/清除模型時看到翻譯後的提示訊息, so that UI 語言一致無英文混入。
- As a 維護者, I want 模型清單集中在 schema 定義, so that 新模型推出時只改一處。

## 驗收條件

- Given ModelSection 的模型 select dropdown, when 檢視 source code, then `KNOWN_MODELS` 常數已移除，改從 schema 或 shared 常數取得
- Given 使用者儲存模型, when toast 顯示, then toast 文字使用 `t()` 且三語言檔皆有對應 key
- Given 使用者清除模型, when toast 顯示, then toast 文字使用 `t()` 且三語言檔皆有對應 key
- Given `npm run check:schema`, when 執行, then 無新錯誤
