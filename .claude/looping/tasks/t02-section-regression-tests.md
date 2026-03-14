---
title: Section 改造後回歸測試更新
created: 2026-03-14
priority: high
suggested_order: T02
blockedBy: [b01-general-section-schema-driven, b02-display-section-schema-driven, b03-advanced-section-schema-driven]
---

# Section 改造後回歸測試更新

B01/B02/B03 改造後，現有的 Section 測試行為斷言不應改變（render 結果相同）。

## 任務

1. 檢查 `GeneralSection.test.tsx`、`DisplaySection.test.tsx`、`AdvancedSection.test.tsx` 是否因 import 路徑變更或 mock 方式改變而失敗
2. 修正因重構導致的測試失敗（如 mock 的 constant 已不存在）
3. 新增斷言：確認欄位順序未改變（snapshot 或 explicit order check）
4. 確保 schema-driven 欄位的 render 結果與硬編碼版本一致

## User Stories

- As a developer, I want the existing test suite to pass unchanged after the schema-driven refactor to ensure no UI regressions.

## 驗收條件

- Given B01/B02/B03 已完成, when I run `npm test`, then 所有 Section 測試通過
- Given 改造前後的 render output, when compared, then 欄位順序、控制元件類型、props 一致
- Given 新增的 order assertion, when 有人改變欄位順序, then test 失敗提醒
- Given `npm run verify`, when I run it, then 全部通過
