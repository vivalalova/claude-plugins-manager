---
title: Extension Info 骨架：constants + protocol + routing
created: 2026-03-13
priority: critical
suggested_order: A01
---

# Extension Info 骨架：constants + protocol + routing

Extension Info 頁作為第 5 個 Editor panel 接入現有 panel 系統。需要在多處加入 `'info'` category 支援，並建立空白 InfoPage 骨架。

## 異動範圍

1. `src/extension/constants.ts` — `PanelCategory` union type 加 `'info'`、`PANEL_TITLES` 加標題、`COMMANDS` 加 `openInfo`
2. `src/webview/sidebar/SidebarApp.tsx` — `categories` 陣列加一項（icon 用 `ℹ️`，無 count badge）
3. `src/webview/editor/EditorApp.tsx` — switch 加 `case 'info'` 渲染 InfoPage
4. 新增 `src/webview/editor/info/InfoPage.tsx` — 空白骨架（標題 + placeholder）
5. `src/extension/messaging/protocol.ts` — 新增 `extension.getInfo` / `extension.revealPath` / `extension.clearCache` request types
6. `src/extension/messaging/MessageRouter.ts` — 新增 dispatch cases（先 stub，回傳空物件）
7. `package.json` contributes.commands 加 `openInfo`
8. `src/extension/extension.ts` — 註冊新 command
9. i18n locales (en, zh-TW, ja) 加 `info.*` 翻譯 key

## User Stories

- As a user, I want to see a 5th "Info" button in the sidebar, so that I can access extension information
- As a user, I want to open Info page from Command Palette, so that I have multiple entry points

## 驗收條件

- Given sidebar 已載入，When 使用者觀察 sidebar，Then 看到 5 個按鈕，第 5 個為 Info（ℹ️ icon，無 badge）
- Given 使用者點擊 Info 按鈕，When Editor panel 打開，Then 顯示 InfoPage 骨架（標題 + 空白區域）
- Given Command Palette 搜尋 "Open Extension Info"，When 執行，Then 打開 Info editor panel
- Given protocol 已定義 `extension.getInfo`，When webview 發送此 request，Then MessageRouter 不拋 "Unknown message type"
- Given `npm run typecheck && npm test && npm run build`，When 執行，Then 全部通過
