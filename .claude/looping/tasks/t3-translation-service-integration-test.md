---
title: TranslationService integration test
created: 2026-03-13
priority: medium
suggested_order: T3
blockedBy: [a4-translation-service-fetch]
---

# TranslationService integration test

`TranslationService.test.ts` 只有 unit test（mock https）。Service 有真實 filesystem 操作（cache load/save `~/.claude/plugins/.cache/translations.json`）。

用 temp directory 驗證：cache persistence across `translate()` calls、batch splitting with real data、concurrent save safety（`pendingSave` queue）。

## User Stories

- As a developer, I want TranslationService cache 操作以真實 filesystem 驗證，so that cache corruption bug 能被抓到

## 驗收條件

- Given temp cache dir（空），when 第一次 `translate(['hello'])`，then cache 檔被建立且內容為有效 JSON、含 'hello' 對應翻譯
- Given cache 已存在含 'hello' 翻譯，when 再次 `translate(['hello'])`，then API 不被呼叫（cache hit）
- Given 25 個不同 key，when `translate()`，then batch split 後所有 25 個 key 皆出現在回傳結果（無遺漏）
- Given 同時發出 3 個並行 `translate()` 呼叫，when 全部完成，then cache 檔為有效 JSON（`JSON.parse` 不拋錯）且所有 key 存在
- Given cache 檔不存在（fresh install），when `translate()`，then 不拋 ENOENT，正常回傳翻譯
