---
title: ExtensionInfoService + extension.getInfo handler
created: 2026-03-13
priority: critical
suggested_order: B01
blockedBy: a01-extension-info-skeleton
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# ExtensionInfoService + extension.getInfo handler

新增 `ExtensionInfoService`，負責收集所有 extension 相關靜態與動態資訊，並接上 MessageRouter。

## 異動範圍

1. 新增 `src/extension/services/ExtensionInfoService.ts`
2. `src/shared/types.ts` — 新增 `ExtensionInfo` interface
3. `src/extension/services/CliService.ts` — `claudePath` 改為 public readonly 或加 getter
4. `src/extension/messaging/MessageRouter.ts` — 注入 ExtensionInfoService，`extension.getInfo` dispatch 呼叫 service
5. `src/extension/extension.ts` — 建構 ExtensionInfoService 並傳入 MessageRouter

## ExtensionInfo 欄位

| 欄位 | 型別 | 來源 |
|------|------|------|
| extensionVersion | string | `context.extension.packageJSON.version` |
| extensionName | string | `context.extension.packageJSON.displayName` |
| publisher | string | `context.extension.packageJSON.publisher` |
| repoUrl | string | `package.json` repository.url |
| cliPath | string \| null | `CliService.claudePath` |
| cliVersion | string \| null | `claude --version`（lazy load） |
| cacheDirPath | string | `PLUGINS_CACHE_DIR` |
| pluginsDirPath | string | `~/.claude/plugins/` |
| installedPluginsPath | string | `~/.claude/plugins/installed_plugins.json` |
| knownMarketplacesPath | string | `~/.claude/plugins/known_marketplaces.json` |
| extensionPath | string | `context.extensionUri.fsPath` |
| preferencesPath | string | `~/.claude/claude-plugins-manager/preferences.json` |

## User Stories

- As a user, I want the Info page to show my extension version and CLI version, so that I can verify my setup
- As a user, I want to see all relevant file paths, so that I know where configuration is stored

## 驗收條件

- Given ExtensionInfoService 已建構，When 呼叫 `getInfo()`，Then 回傳包含所有必填欄位的 ExtensionInfo 物件
- Given CLI 已安裝，When `getInfo()` 被呼叫，Then `cliVersion` 包含實際版本字串
- Given CLI 未安裝，When `getInfo()` 被呼叫，Then `cliVersion` 為 null，不拋例外
- Given MessageRouter 收到 `extension.getInfo` request，When dispatch，Then 回傳 ExtensionInfo 物件
- Given `npm run typecheck && npm test`，When 執行，Then 全部通過
