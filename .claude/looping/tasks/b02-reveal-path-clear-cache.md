---
title: extension.revealPath + extension.clearCache handlers
created: 2026-03-13
priority: high
suggested_order: B02
blockedBy: a01-extension-info-skeleton
---

# extension.revealPath + extension.clearCache handlers

MessageRouter 新增兩個操作型 handler，供 InfoPage UI 使用。

## 異動範圍

1. `src/extension/messaging/MessageRouter.ts` — 新增兩個 dispatch cases

## handler 規格

### extension.revealPath

- 接收 `path: string`
- 使用 `vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(path))` 在 Finder 打開
- 路徑可能含 `~/`，需展開為 `os.homedir()` + 後綴
- 路徑不存在時回傳 error

### extension.clearCache

- 刪除 `PLUGINS_CACHE_DIR` 目錄內所有內容：`fs.promises.rm(PLUGINS_CACHE_DIR, { recursive: true, force: true })`
- 然後 `mkdir(PLUGINS_CACHE_DIR, { recursive: true })` 重建空目錄
- 回傳 `{ cleared: true, path: PLUGINS_CACHE_DIR }`
- 目錄不存在時不拋例外，正常回傳

## User Stories

- As a user, I want to open any config directory in Finder with one click, so that I can inspect files directly
- As a user, I want to clear the cache directory with one click, so that I can free up space or fix cache issues

## 驗收條件

- Given cache 目錄存在，When webview 發送 `extension.revealPath` 帶此路徑，Then `revealFileInOS` command 被呼叫
- Given 傳入 `~/` 開頭路徑，When 發送 `extension.revealPath`，Then 路徑正確展開後執行
- Given 傳入不存在的路徑，When 發送 `extension.revealPath`，Then 回傳 error
- Given cache 目錄有檔案，When 發送 `extension.clearCache`，Then 目錄被清空並重建，回傳 `{ cleared: true }`
- Given cache 目錄不存在，When 發送 `extension.clearCache`，Then 不拋例外，正常回傳
