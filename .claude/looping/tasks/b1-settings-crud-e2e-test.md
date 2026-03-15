---
title: Settings E2E 測試：settings.set / settings.delete 完整路徑
created: 2026-03-15
priority: high
suggested_order: B1
---

# Settings E2E 測試：settings.set / settings.delete 完整路徑

目前有 `toggle-scope.e2e.test.ts` 覆蓋 plugin scope toggle 的 E2E 路徑（MessageRouter → PluginService → SettingsFileService → filesystem），但 settings 的 `set`/`delete` 操作缺少同等級 E2E 測試。`SettingsFileService.settings.integration.test.ts` 只測 service 層，未經過 MessageRouter dispatch。

## 修復方向

新增 `settings-crud.e2e.test.ts`，參考 `toggle-scope.e2e.test.ts` 的 tmpdir + mock homedir 模式，覆蓋：

1. user scope set/get/delete round-trip
2. project scope set/get/delete round-trip
3. local scope set/get/delete round-trip
4. scope override 讀取優先級（local > project > user）

## User Stories

- As a 維護者, I want 確保 settings 從 webview message 到磁碟寫入的完整路徑正確, so that MessageRouter 路由錯誤或參數傳遞問題能被測試抓到

## 驗收條件

- Given settings-crud.e2e.test.ts, when `npm test`, then 全部通過
- Given user/project/local 三種 scope, when 分別 set → get → delete, then 寫入磁碟的 JSON 正確
- Given user/project/local 三層各設不同值給同一 key（如 `language: 'en'/'zh'/'ja'`）, when 讀取 merged settings, then 回傳 local scope 的值（'ja'）
