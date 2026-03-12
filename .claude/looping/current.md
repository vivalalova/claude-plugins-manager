---
title: Extension Info 完整測試
created: 2026-03-13
priority: high
suggested_order: T01
blockedBy: b03-info-page-ui
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# Extension Info 完整測試

補齊 Extension Info 功能的所有自動化測試。

## 測試範圍

### 1. Integration test — ExtensionInfoService
`src/extension/services/__tests__/ExtensionInfoService.integration.test.ts`

- 使用真實 CliService 執行 `claude --version`，驗證 `getInfo()` 回傳結構完整
- 所有必填欄位非 undefined
- `cliVersion` 為合法版本字串
- Edge case：模擬 CLI 不存在時 `cliVersion` 為 null

### 2. Unit test — MessageRouter 擴充
`src/extension/messaging/__tests__/MessageRouter.test.ts`

- `extension.getInfo` dispatch 呼叫 service 並回傳結果
- `extension.revealPath` dispatch 呼叫 `revealFileInOS`
- `extension.revealPath` 路徑不存在時回傳 error
- `extension.clearCache` dispatch 清除目錄並回傳 `{ cleared: true }`

### 3. Component test — InfoPage
`src/webview/editor/info/__tests__/InfoPage.test.tsx`

- mock `sendRequest`，驗證各區塊渲染
- 按鈕 click 行為（Open、Clear Cache、repo link）
- Loading 狀態（CLI 版本 lazy load）
- Error 狀態（getInfo 失敗）

### 4. EditorApp test 擴充
- `mode='info'` 渲染 InfoPage 而非 error

## User Stories

- As a developer, I want automated tests for all Info page paths, so that future changes don't break functionality

## 驗收條件

- Given 所有測試檔已撰寫，When 執行 `npm test`，Then 全部通過
- Given ExtensionInfoService integration test，When CLI 存在，Then `cliVersion` 為非空字串
- Given InfoPage component test，When mock `extension.getInfo` 回傳完整資料，Then 畫面顯示所有路徑列
- Given InfoPage component test，When 點擊 Clear Cache 並確認，Then `extension.clearCache` request 被發送
- Given EditorApp test，When `mode='info'`，Then 渲染 InfoPage
