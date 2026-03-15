---
title: extension/types.ts re-export barrel 清理
created: 2026-03-15
priority: high
suggested_order: A2
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# extension/types.ts re-export barrel 清理

`src/extension/types.ts` 將 shared/types.ts 的 27 個型別 re-export，違反 universal.md #6。目前 6 個 extension 檔案從 `../types`（barrel）import，另外 6 個直接從 `../../shared/types` import，路徑不一致。

## 修復方向

1. 刪除 `extension/types.ts` 的 re-export block，僅保留 `CliError` class
2. 所有 extension service 統一改為直接 `from '../../shared/types'`（或對應相對路徑）
3. `CliError` 維持從 `extension/types.ts` import

## User Stories

- As a 維護者, I want import 路徑統一指向 source of truth, so that 新增型別不需同步兩處

## 驗收條件

- Given 刪除 re-export 後, when `grep -r "from '.*extension/types'" src/extension/` (排除 CliError import 所在行), then 0 結果
- Given 刪除 re-export 後, when `grep -r "from '../../shared/types'" src/extension/`, then 原本走 barrel 的 6 個檔案全部出現
- Given 修改完成, when `npm run verify`, then 全部通過
