---
title: FileWatcher 監控 skills + MessageRouter 路由 + extension.ts 接線
created: 2026-03-16
priority: critical
suggested_order: B2
blockedBy: b1-skill-service
---

# FileWatcher 監控 skills + MessageRouter 路由 + extension.ts 接線

擴充 FileWatcherService、MessageRouter、EditorPanelManager 和 extension.ts，完成 skills 功能的 Extension Host 端完整串接。

## User Stories

- As a 使用者, I want 在終端機手動 npx skills add 後 VSCode 自動刷新, so that 不需手動 reload

## 實作內容

### 1. FileWatcherService 擴充

- 新增 `_onSkillFilesChanged` EventEmitter + 公開 `onSkillFilesChanged` event
- `setupWatchers()` 新增監控 `~/.claude/skills/**`（glob pattern）
- `rebuildWorkspaceWatchers()` 新增監控 workspace `.claude/skills/**`
- debounce 500ms（與現有一致）
- skills 目錄可能不存在 → watcher 需容忍（VSCode FileSystemWatcher 本身容忍不存在路徑）

### 2. MessageRouter 擴充

- constructor 新增 `private readonly skillService: SkillService`
- `dispatch()` 新增 `skill.*` switch cases：
  - `skill.list` → `skillService.list(msg.scope)`
  - `skill.add` → `skillService.add(msg.source, msg.scope)`
  - `skill.remove` → `skillService.remove(msg.name, msg.scope)`
  - `skill.find` → `skillService.find(msg.query)`
  - `skill.check` → `skillService.check()`
  - `skill.update` → `skillService.update()`
  - `skill.getDetail` → `skillService.getDetail(msg.path)`
  - `skill.registry` → `skillService.fetchRegistry(msg.sort, msg.query)`
  - `skill.openFile` → `vscode.commands.executeCommand('vscode.open', Uri.file(msg.path))`

### 3. EditorPanelManager 擴充

- constructor 訂閱 `fileWatcherService.onSkillFilesChanged`
- handler：當 `currentCategory === 'skill'` 時 postMessage `{ type: 'skill.refresh' }`

### 4. extension.ts 擴充

- 實例化 `SkillService`（傳入 workspace path）
- 傳入 `MessageRouter` constructor
- 註冊 `claude-plugins-manager.openSkill` command → `editorPanelManager.show('skill')`

### 5. SidebarViewProvider 擴充

- categories 陣列新增 `'skill'` entry
- sidebar tab 新增 Skills 按鈕（位於 MCP 和 Settings 之間）

### 測試

- FileWatcherService：驗證 `onSkillFilesChanged` event 觸發
- MessageRouter：`skill.*` dispatch 路由到正確 service 方法

## 驗收條件

- Given 在 `~/.claude/skills/` 下新增或刪除一個 skill 目錄
- When FileWatcher 偵測到變更
- Then debounce 後觸發 `onSkillFilesChanged` event
- Given webview 發送 `skill.list` request
- When MessageRouter 收到
- Then 正確路由到 SkillService.list() 並回傳結果
- Given EditorPanelManager 的 currentCategory 為 'skill'
- When skills 目錄變更
- Then webview 收到 `skill.refresh` push message
- Given extension 啟動
- When 命令面板執行 `openSkill`
- Then editor panel 以 'skill' category 開啟
