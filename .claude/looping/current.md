---
title: InfoPage 完整 UI 元件
created: 2026-03-13
priority: high
suggested_order: B03
blockedBy: [b01-extension-info-service, b02-reveal-path-clear-cache]
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# InfoPage 完整 UI 元件

新增 `src/webview/editor/info/InfoPage.tsx`，消費 `extension.getInfo` 回傳資料，渲染完整的 Extension Info 頁面。

## 頁面區塊

### 1. Extension 基本資訊
- 名稱、版本、publisher
- Repo link（可點擊，走 `openExternal`）

### 2. CLI 資訊
- CLI 路徑
- CLI 版本（lazy load：先顯示 spinner，取得後更新；取得失敗顯示 "Not found"）

### 3. 路徑一覽表
每列一個路徑 + 「Open」按鈕（呼叫 `extension.revealPath`）：
- Cache 目錄（額外有「Clear Cache」按鈕，帶 confirm dialog，呼叫 `extension.clearCache`）
- Plugins 目錄
- installed_plugins.json
- known_marketplaces.json
- Extension 安裝路徑
- Preferences 檔案路徑

### 4. 風格
- 遵循既有 VSCode theme CSS variables
- 與 SettingsPage 的卡片式版面一致
- CSS 放 `src/webview/editor/info/InfoPage.css`

### 5. i18n
- 翻譯 key 前綴 `info.*`
- 新增到 en/zh-TW/ja 三個 locale 檔

## User Stories

- As a user, I want to see all extension and CLI version info on one page, so that I can verify my setup at a glance
- As a user, I want to open any config directory with a button click, so that I can inspect or edit files directly
- As a user, I want to clear cache with confirmation, so that I don't accidentally delete data

## 驗收條件

- Given InfoPage 已載入，When `extension.getInfo` 回傳成功，Then 顯示 extension 名稱、版本、publisher
- Given CLI 版本尚未取得，When InfoPage 初始渲染，Then CLI 版本區域顯示 loading spinner
- Given CLI 版本取得完成，When 資料更新，Then spinner 消失，顯示版本字串
- Given CLI 未安裝，When `cliVersion` 為 null，Then 顯示 "Not found" 或類似提示
- Given 使用者點擊某路徑的 Open 按鈕，When 按鈕被點擊，Then 發送 `extension.revealPath` 帶正確路徑
- Given 使用者點擊 Clear Cache，When confirm dialog 確認，Then 發送 `extension.clearCache`，成功後顯示 toast
- Given 使用者點擊 repo link，When 點擊，Then 走 `openExternal` 開啟瀏覽器
- Given `npm run typecheck && npm run build`，When 執行，Then 通過
