---
title: InfoPage 設定檔路徑存在性標示
created: 2026-03-15
priority: low
suggested_order: B3
---

# InfoPage 設定檔路徑存在性標示

InfoPage 列出 settings 相關路徑但不標示是否實際存在。應在 ExtensionInfoService 回傳各路徑的存在狀態，UI 端對不存在的路徑顯示視覺區分。

## 規格

- `ExtensionInfoService.getInfo()` 回傳的路徑資訊新增 `exists: boolean` 欄位
- 使用 `fs.access` 或 `fs.stat` 檢查（不讀取內容）
- UI：存在的路徑顯示正常色彩；不存在的路徑灰色 + 「不存在」標記
- 不存在的路徑仍可點擊 Open（由 VSCode 處理 ENOENT）

## User Stories

- As a 使用者, I want 一眼看出哪些設定檔已建立, so that 知道哪些 scope 有實際配置。

## 驗收條件

- Given `~/.claude/settings.json` 存在, when InfoPage 載入, then 該路徑顯示正常色彩
- Given `.claude/settings.local.json` 不存在, when InfoPage 載入, then 該路徑顯示灰色 + 「不存在」標記
