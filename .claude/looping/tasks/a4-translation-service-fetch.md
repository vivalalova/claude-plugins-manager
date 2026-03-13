---
title: TranslationService https → fetch (TranslationService)
created: 2026-03-13
priority: low
suggested_order: A4
---

# TranslationService https → fetch

`TranslationService.callApi()` 用 Node.js `https.request` + 手動 body 累積 / timeout / stream callbacks（~40 行）。Node 20+ 有 native `fetch` + `AbortSignal.timeout()`。

替換為 `fetch` 減少 boilerplate，符合專案 TypeScript 規範（Fetch API preferred）。

## User Stories

- As a developer, I want HTTP 呼叫用 modern fetch，so that 程式碼更短、更易測試、一致

## 驗收條件

- Given TranslationService, when `callApi()`, then 用 `fetch` 非 `https.request`
- Given timeout 設定, when API 回應超時, then 正確 abort + 拋錯
- Given 現有測試, when `npm test`, then 全部通過
