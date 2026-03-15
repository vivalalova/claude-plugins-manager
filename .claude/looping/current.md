---
title: HookExplanationService 同 key 並發 dedup + 測試
created: 2026-03-15
priority: medium
suggested_order: B3
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# HookExplanationService 同 key 並發 dedup + 測試

目前 `HookExplanationService.explain()` 對同一個 hookContent+locale 的並發請求會各自呼叫 CLI（浪費 API）。`writeLock` 只保護 write 不互相覆蓋，但 CLI call 本身無 dedup。現有 integration test 測試的是不同 key 的並發寫入，未覆蓋同 key 場景。

## 修復方向

1. 加 `private inflightRequests = new Map<string, Promise<...>>()` 做 inflight dedup — 相同 key 複用同一個 Promise
2. 補 integration test：同 key 並發 3 次 → CLI 只呼叫 1 次、結果全部相同

## User Stories

- As a 使用者, I want 快速連點多次 explain 按鈕不會觸發多次 AI 請求, so that 回應更快且不浪費資源

## 驗收條件

- Given 同一 hookContent+locale 並發 3 次 explain, when 全部完成, then CLI 只呼叫 1 次
- Given inflight request 完成後, when 再次 explain 同 key, then 命中 cache 不呼叫 CLI
- Given 修改完成, when `npm run verify`, then 全部通過
