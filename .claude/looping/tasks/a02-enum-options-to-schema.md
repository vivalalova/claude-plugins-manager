---
title: enum options 從 Section 常數搬到 schema
created: 2026-03-14
priority: high
suggested_order: A02
blockedBy: a01-extend-schema-ui-metadata
---

# enum options 從 Section 常數搬到 schema

目前 enum 選項同時存在於 schema 的 `type` 字串（如 `"'high' | 'medium' | 'low'"`）和 Section 元件的 `KNOWN_X_VALUES` 常數，重複維護。

將所有 enum 欄位的 `options` 明確列在 `CLAUDE_SETTINGS_SCHEMA`（如 `options: ['high', 'medium', 'low'] as const`），並從各 Section 元件移除對應的 `KNOWN_X_VALUES` 常數，改為從 schema import。

涉及的 enum 欄位：
- `effortLevel`: `['high', 'medium', 'low']`
- `autoUpdatesChannel`: `['latest', 'stable']`（確認實際值）
- `teammateMode`: `['auto', 'in-process', 'tmux']`
- `forceLoginMethod`: 確認實際值

## User Stories

- As a developer adding a new enum setting, I want to declare options once in the schema so that I don't have to duplicate them in the Section component.

## 驗收條件

- Given `GeneralSection.tsx`, when I search for `KNOWN_EFFORT_LEVELS` or `KNOWN_AUTO_UPDATES_CHANNELS`, then 找不到（已移除）
- Given `DisplaySection.tsx`, when I search for `KNOWN_TEAMMATE_MODES`, then 找不到（已移除）
- Given `AdvancedSection.tsx`, when I search for `KNOWN_FORCE_LOGIN_METHODS`, then 找不到（已移除）
- Given 各 Section 引用 enum options, when I trace the import, then 全部來自 `claude-settings-schema.ts`
- Given `npm run typecheck && npm test`, when I run them, then 全部通過
