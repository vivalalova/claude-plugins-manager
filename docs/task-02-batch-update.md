# 批次更新所有 Plugin

## 需求背景

安裝了多個 plugin 後，每次需要更新都要逐一點擊每個 plugin 的 Update 按鈕，沒有「Update All」功能。更新 10 個 plugin 需要 10 次互動，且每次都要等待 CLI 回應，效率極低。這讓日常維護成為繁瑣作業。

## User Stories

- As a plugin user, I want to update all installed plugins at once, so that I save time on routine maintenance.

## 驗收條件

- [ ] Given multiple plugins are installed, when clicking "Update All" in the page header, then all installed plugins are updated sequentially
- [ ] Given an update is in progress, when the button is clicked, then it shows a progress indicator and is disabled
- [ ] Given one plugin fails to update, when the batch continues, then the error is collected and shown after all updates complete
- [ ] Given no plugins are installed, when viewing the page, then the "Update All" button is not shown

## 備註

- 更新必須串行執行（sequential），不可並發，避免 CLI 競爭條件
- 失敗時不中斷剩餘 plugin 的更新
- 全部完成後顯示摘要，例如：「Updated 8 plugins, 2 failed: plugin-a (timeout), plugin-b (not found)」
- "Update All" 按鈕放 Plugin 頁面 header 右側，與現有 Refresh 按鈕並列
- 進度指示可顯示 `Updating 3/10...` 格式
- 按鈕僅在有已安裝 plugin 時顯示
