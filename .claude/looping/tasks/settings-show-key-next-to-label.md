---
title: 設定頁每個選項旁顯示 key 與預設值 (settingKey:defaultValue)
created: 2026-03-12
priority: medium
suggested_order: B1
---

# 設定頁每個選項旁顯示 key 與預設值 (settingKey:defaultValue)

每個設定欄位的 label 旁邊顯示對應的設定 key 與預設值，例如 `快速模式 (fastMode:false)`，讓用戶能直接對照官方文件查找該參數，也能一眼看出預設行為。

## User Stories

- As a 用戶, I want 看到每個設定旁邊有 key 名稱與預設值, so that 我可以去官方文件（https://code.claude.com/docs/en/settings）快速找到對應說明，並知道未設定時的預設行為

## 驗收條件

- Given 設定頁開啟, when 看到任意設定項, then label 右側顯示 `(key:defaultValue)`，例如 `(fastMode:false)`、`(effortLevel:high)`
- Given 無預設值的欄位, when 渲染, then 只顯示 `(key)`，不顯示冒號
- Given key 與預設值顯示, when 視覺上, then 字體小且顏色淡（secondary text），不干擾主 label
- Given 所有 Section（General / Display / Advanced / Permissions / Env / Hooks）, when 渲染, then 每個有 key 的設定都顯示對應資訊
