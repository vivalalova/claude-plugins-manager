---
title: TranslationService retry + exponential backoff
created: 2026-03-15
priority: medium
suggested_order: A3
phase: needs-commit
iteration: 2
max_iterations: 3
review_iterations: 1
---

# TranslationService retry + exponential backoff

`TranslationService.callApi()` 對暫時性錯誤（timeout、5xx、網路斷線）無 retry 機制，直接靜默跳過。應加入 exponential backoff retry。

## 規格

- 最多 retry 3 次，間隔 1s → 2s → 4s
- 429（quota exceeded）維持現有邏輯：break 停止後續批次，不 retry
- HTTP 5xx / timeout / network error → retry
- HTTP 4xx（非 429）→ 不 retry（client error）
- retry 邏輯封裝在 `callApi` 內，不影響外部介面

## User Stories

- As a 使用者, I want 網路瞬斷時翻譯能自動重試, so that 不會留下未翻譯的 description。

## 驗收條件

- Given API 第一次回傳 503、第二次回傳 200, when translate 執行, then 翻譯成功（retry 生效）
- Given API 連續 4 次 timeout, when translate 執行, then 最終 fallback 空結果（最多 retry 3 次）
- Given API 回傳 429, when translate 執行, then 不 retry、warning 回傳「quota」
- Given API 回傳 400, when translate 執行, then 不 retry、靜默跳過
