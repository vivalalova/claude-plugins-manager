---
title: enabledMcpjsonServers / disabledMcpjsonServers 加入 EXCLUDED_FROM_FIELD_ORDER
created: 2026-03-15
priority: high
suggested_order: A3
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# enabledMcpjsonServers / disabledMcpjsonServers 加入 EXCLUDED_FROM_FIELD_ORDER

這兩個 key 已在 `claude-settings-schema.ts` 和 `ClaudeSettings` interface 定義，屬 `permissions` section，由 PermissionsSection 手動渲染。但未列入任何 `*_FIELD_ORDER` 陣列，也未列入 `EXCLUDED_FROM_FIELD_ORDER`（目前只有 `model`）。

## 修復方向

在 `field-orders.ts` 的 `EXCLUDED_FROM_FIELD_ORDER` Set 加入 `enabledMcpjsonServers` 和 `disabledMcpjsonServers`，附註原因：PermissionsSection 全手動渲染，無 schema-driven loop。

## User Stories

- As a 維護者, I want check:schema 完整覆蓋所有 schema key, so that 新增 key 時不會遺漏 field order 配置

## 驗收條件

- Given 兩個 key 已加入 EXCLUDED_FROM_FIELD_ORDER, when `npm run check:schema`, then 無 FIELD_ORDER 完整性警告
- Given 修改完成, when `npm run verify`, then 全部通過
