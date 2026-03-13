---
title: 提取重複 readScopedEnabledPlugins 為共用 helper
created: 2026-03-13
priority: medium
suggested_order: A1
---

# 提取重複 readScopedEnabledPlugins 為共用 helper

`PluginService.readScopedEnabledPlugins` 與 `McpService.readScopedEnabledPlugins` 幾乎相同（讀 scope enabled plugins、catch "No workspace" 回 `{}`）。上層 `readAllEnabledPlugins` / `readEnabledPluginsByScope` 也是同一 3-scope 並行模式。違反 universal.md #3（重複模式立即封裝）。

提取至 `SettingsFileService`（新 method `readScopedEnabledPlugins(scope, projectPath?)`），消除重複。

## User Stories

- As a developer, I want 重複邏輯集中一處，so that 修 bug 只改一次

## 驗收條件

- Given PluginService 和 McpService 原有 `readScopedEnabledPlugins`，when 重構後，then 兩者皆刪除原實作，改呼叫 `SettingsFileService.readScopedEnabledPlugins()`
- Given scope = 'project' 且無 workspace 路徑，when 呼叫共用 helper，then 回傳 `{}` 不拋錯
- Given scope = 'user'，when 呼叫共用 helper，then 回傳 user settings 的 enabledPlugins object
- Given 現有測試，when `npm test`，then 全部通過（無新失敗）
