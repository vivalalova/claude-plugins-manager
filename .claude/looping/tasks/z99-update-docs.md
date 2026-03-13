---
title: CLAUDE.md + i18n + MEMORY.md 同步至最新實作
created: 2026-03-13
priority: low
suggested_order: Z99
blockedBy: [b1-verify-npm-script, a1-extract-read-scoped-enabled-plugins, a2-split-advanced-section, a3-migrate-push-message-types, a4-translation-service-fetch, t1-i18n-key-completeness-test, t2-mcp-service-integration-test, t3-translation-service-integration-test, u1-mcp-page-loading-states, f1-sync-settings-schema-driven]
---

# CLAUDE.md + i18n + MEMORY.md 同步至最新實作

所有前置 task 完成後，更新文件：

- `CLAUDE.md`：(1) Services table 補 SettingsFileService 新 method (2) scripts 區加 `verify` 指令說明 (3) 已知陷阱補本次發現的新項目
- i18n locale files（`ja.ts`、`zh-TW.ts`）：補齊 u1-mcp-page-loading-states 新增的 UI 字串 key
- `MEMORY.md`：記錄本次 session 發現的實作教訓（schema-driven 架構決策、fetch 替換 https 注意事項）

## User Stories

- As a developer, I want 文件反映專案現況，so that 能正確理解與使用 extension

## 驗收條件

- Given CLAUDE.md Services table，when 查看 SettingsFileService 列，then 包含 `readScopedEnabledPlugins` 方法描述
- Given CLAUDE.md 指令區，when 查看，then 含 `npm run verify` 及其說明
- Given `ja.ts` 與 `zh-TW.ts`，when 執行 i18n 完整性測試（t1 task），then 全部通過（無缺少 key）
- Given MEMORY.md，when 查看，then 少於 100 行（超過則拆分至 memory/*.md）
