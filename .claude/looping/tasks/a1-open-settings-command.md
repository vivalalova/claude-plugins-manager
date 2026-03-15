---
title: openSettings command 註冊到 package.json
created: 2026-03-15
priority: high
suggested_order: A1
---

# openSettings command 註冊到 package.json

`openSettings` command 已在 `src/extension/constants.ts` 和 `extension.ts` 實作，但 `package.json` 的 `contributes.commands` 陣列遺漏此項。使用者無法從 VSCode Command Palette 搜到「Open Settings」。

其他四個 panel（Marketplace、Plugin、MCP、Info）皆有對應 command，Settings 是唯一缺漏。

## User Stories

- As a 使用者, I want 從 Command Palette 直接開啟 Settings panel, so that 不必先開 sidebar 再切頁

## 驗收條件

- Given package.json contributes.commands 已新增 `claude-plugins-manager.openSettings`, when 使用者在 Command Palette 輸入 "Open Settings", then Settings editor panel 開啟
- Given 新增的 command, when 執行 `npm run verify`, then 全部通過
