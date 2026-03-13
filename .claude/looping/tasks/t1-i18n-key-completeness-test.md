---
title: i18n key 完整性測試
created: 2026-03-13
priority: medium
suggested_order: T1
---

# i18n key 完整性測試

`ja.ts` 與 `zh-TW.ts` 型別為 `Partial<Record<TranslationKey, string>>`，缺少翻譯 key 靜默 fallback English。無 CI 檢查。

在 `src/webview/i18n/__tests__/` 加測試，驗證每個 locale 都涵蓋 `en.ts` 的所有 key，失敗時列出缺少的 key。

## User Stories

- As a contributor 新增 i18n key, I want CI 告知缺少翻譯, so that 不會意外出貨不完整翻譯

## 驗收條件

- Given en.ts 有 key "foo", when ja.ts 缺少 "foo", then 測試失敗並列出 "foo"
- Given 所有 locale 都完整, when `npm test`, then 測試通過
