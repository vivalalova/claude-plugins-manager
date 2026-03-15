---
title: Settings scope 切換 loading 狀態防護
created: 2026-03-15
priority: medium
suggested_order: C4
---

# Settings scope 切換 loading 狀態防護

`SettingsPage.tsx` 切換 scope 時 `useEffect` 觸發 `fetchSettings(scope)`，fetch 期間舊 `settings` state 仍保留並渲染。使用者可能在此間隙誤操作（如按下 toggle），導致舊 scope 的值被存到新 scope。

## 修復方向

scope 切換時立即 `setSettings({})` 清空舊值，或加 loading overlay 遮擋互動。前者更安全（保證 UI 不會顯示過期資料）。

## User Stories

- As a 使用者, I want 切換 scope 後不會看到上一個 scope 的舊值閃過, so that 不會因此誤存錯誤設定

## 驗收條件

- Given 從 user scope 切換到 project scope, when fetch 進行中, then UI 不顯示 user scope 的值
- Given fetch 完成, when 渲染, then 顯示 project scope 的正確值
- Given 修改完成, when `npm run verify`, then 全部通過
