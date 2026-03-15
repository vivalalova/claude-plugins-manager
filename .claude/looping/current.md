---
title: Settings scope override 指示器
created: 2026-03-15
priority: high
suggested_order: A2
phase: needs-commit
iteration: 3
max_iterations: 3
review_iterations: 2
---

# Settings scope override 指示器

Settings 頁面切換 user/project/local scope 時，無法一眼看出哪些欄位在其他 scope 有值、是否覆蓋上層設定。需在 SchemaFieldRenderer 層加入 override 指示器。

## 設計方向

- 當前 scope 為 project/local 時，若同一 key 在 user scope 也有值，顯示「覆蓋 user 值」badge
- 當前 scope 為 user 時，若同一 key 在 project/local 有覆蓋，顯示「被覆蓋」提示
- 需擴充 MessageRouter 加入 `settings.readAll`（讀取三 scope 的 settings），或在切換 scope 時一併傳送其他 scope 的值

## User Stories

- As a project 管理者, I want 在 project scope 編輯 settings 時看到覆蓋關係, so that 不會無意遺漏或重複設定。
- As a 開發者, I want 在 local scope 看到 user/project 各層的值, so that 理解最終生效的配置來源。

## 驗收條件

- Given user scope 設定 `effortLevel: 'high'`、project scope 設定 `effortLevel: 'low'`, when 切到 project scope, then effortLevel 欄位旁顯示「覆蓋 user 值」指示
- Given 只有 user scope 有 `language: 'zh-TW'`、project scope 無設定, when 切到 project scope, then language 欄位無 override 指示
- Given user scope 設定 `fastMode: true`、project scope 也設定 `fastMode: true`, when 切到 project scope, then fastMode 欄位仍顯示「覆蓋 user 值」（值相同但有明確設定）
