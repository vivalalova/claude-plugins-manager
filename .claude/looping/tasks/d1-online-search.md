---
title: 線上搜尋功能（npx skills find 文字解析）
created: 2026-03-16
priority: high
suggested_order: D1
blockedBy: c1-skills-page-ui
---

# 線上搜尋功能（npx skills find 文字解析）

在 SkillsPage 的 toolbar 加入線上搜尋模式，透過 `skill.find` 呼叫 `npx skills find`。

## User Stories

- As a 使用者, I want 在 VSCode 內搜尋線上 skills, so that 不用開瀏覽器去 skills.sh 找

## 實作內容

### UI 設計

SkillToolbar 新增搜尋模式切換：
- **Local** 模式（預設）：過濾已安裝 skills（即時 filter，不走 API）
- **Online** 模式：打 `skill.find` API，搜尋 skills.sh registry

搜尋框行為：
- Online 模式：debounce 500ms → 送 `skill.find` request
- 最少 2 字元才觸發搜尋
- Loading spinner 在搜尋進行中
- 結果顯示為卡片列表

### 搜尋結果卡片

每個 `SkillSearchResult` 顯示：
- Skill 全名（如 `vercel-labs/agent-skills@find-skills`）
- 安裝數量
- skills.sh URL（可點擊，在外部瀏覽器開啟）
- Install 按鈕（下拉選 scope：Global / Project）

### 文字解析（SkillService.find）

`npx skills find <query>` 輸出格式（已在 A1 驗證）：
- 含 ANSI escape codes → 用 regex `\x1B\[[0-9;]*m` 去除
- 跳過 ASCII art banner 行
- 按行配對解析 skill 資訊

### 錯誤處理

- CLI 不可用 → 顯示 ErrorBanner，提示安裝 `npx skills`
- 搜尋超時 → 顯示超時錯誤
- 無結果 → 顯示 "No results found"

### i18n 補充

- `skill.search.online` / `skill.search.local`
- `skill.search.minChars` — "輸入至少 2 個字元"
- `skill.search.searching` / `skill.search.noOnlineResults`
- `skill.search.installTo` — "安裝到..."

### 測試

- 搜尋模式切換 → UI 正確切換
- debounce → 驗證只在停止輸入 500ms 後送出 request
- 結果渲染 → 卡片顯示正確資訊
- Install 按鈕 → 觸發 `skill.add` message
- 空結果 → 顯示空狀態

## 驗收條件

- Given 使用者切換到 Online 搜尋模式並輸入 "react"
- When debounce 後送出 `skill.find` request
- Then 顯示搜尋結果列表，每個結果含 fullId、安裝數、URL、Install 按鈕
- Given 搜尋結果中點擊 Install → Global
- When 呼叫 `skill.add`
- Then 安裝成功後，已安裝列表刷新，該 skill 出現在 Global 區段
- Given CLI 輸出包含 ANSI escape codes
- When 解析
- Then 正確提取所有搜尋結果，忽略非資料行
