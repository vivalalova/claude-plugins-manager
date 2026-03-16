---
title: Skills Check Updates + Update All 功能
created: 2026-03-16
priority: low
suggested_order: D3
blockedBy: c1-skills-page-ui
---

# Skills Check Updates + Update All 功能

在 SkillsPage toolbar 加入 Check Updates 和 Update All 按鈕，讓使用者一鍵檢查和更新所有 skills。

## User Stories

- As a 使用者, I want 一鍵檢查 skills 是否有新版本並批次更新, so that 保持 skills 為最新

## 實作內容

### UI 設計

SkillToolbar（Installed tab）新增：
- **Check Updates** 按鈕：呼叫 `skill.check`
  - 檢查中顯示 loading spinner
  - 結果：badge 顯示可更新數量 / "All up to date" toast
- **Update All** 按鈕（當有可用更新時顯示）：呼叫 `skill.update`
  - 更新中顯示 progress
  - 完成後刷新列表

### SkillService 方法

`check()` 和 `update()` 已在 B1 定義。此 task 負責：
- 解析 `check` 輸出，提取可更新 skill 數量
- 更新完成後觸發 `skill.refresh`

### 狀態管理

- `updateAvailable: number` — 可更新數量
- `checking: boolean` — 檢查中
- `updating: boolean` — 更新中

### i18n 補充

- `skill.check.button` / `skill.check.checking` / `skill.check.upToDate`
- `skill.check.available` — "{count} updates available"
- `skill.update.button` / `skill.update.updating` / `skill.update.done`
- `skill.update.error`

### 測試

- Check → loading → 結果顯示
- Update All → loading → 完成 → 列表刷新
- 無更新 → "All up to date" 文字
- 錯誤 → ErrorBanner

## 驗收條件

- Given 使用者點擊 Check Updates
- When CLI 回報有可用更新
- Then UI 顯示更新數量
- Given 使用者點擊 Update All
- When 更新執行中
- Then 顯示進度指示，完成後列表刷新
- Given 所有 skills 已是最新
- When 點擊 Check Updates
- Then 顯示 "All up to date"
