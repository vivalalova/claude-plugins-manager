---
title: Skill Detail 面板顯示 SKILL.md 完整內容
created: 2026-03-16
priority: medium
suggested_order: C2
blockedBy: c1-skills-page-ui
---

# Skill Detail 面板顯示 SKILL.md 完整內容

在 SkillsPage 中加入 detail panel，點擊 skill 卡片的 View 按鈕後展開顯示 SKILL.md 完整內容。

## User Stories

- As a 使用者, I want 快速查看 skill 的完整指令和配置, so that 不用離開 VSCode 到 finder 找檔案

## 實作內容

### Detail Panel

參考 McpPage 的 detail view 模式：
- 點擊 SkillCard 的 View 按鈕 → 呼叫 `skill.getDetail` → 展開 detail panel
- 再次點擊或點擊 Close → 收合

### 內容區塊

1. **Frontmatter metadata table**：name、description、context、model、allowed-tools
   - 每個欄位一行，label + value
   - 缺失欄位不顯示
2. **SKILL.md body**：原始 markdown 文字
   - 使用 `<pre>` 包裹，保持格式
   - 不需 markdown 渲染器（保持簡單，與 McpPage 的 detailText 一致）
3. **操作按鈕**：
   - `Open in Editor` → 呼叫 `skill.openFile`，VSCode 打開 SKILL.md
   - `Copy Path` → 複製 SKILL.md 檔案路徑到剪貼簿；webview 中用 `navigator.clipboard.writeText(path)`

### Protocol

- `skill.getDetail` request 已在 A2 定義
- `skill.openFile` request 已在 A2 定義

### i18n 補充

- `skill.detail.title` / `skill.detail.frontmatter` / `skill.detail.body`
- `skill.detail.openInEditor` / `skill.detail.copyPath` / `skill.detail.copied`
- `skill.detail.noContent`

## 驗收條件

- Given 使用者點擊 skill 卡片的 View 按鈕
- When detail panel 展開
- Then 顯示 SKILL.md 的 frontmatter metadata（表格）和 body 內容（pre-formatted）
- Given 使用者點擊 Open in Editor
- When 呼叫 extension host
- Then VSCode 打開對應的 SKILL.md 檔案
- Given 使用者點擊 Copy Path
- When 執行複製
- Then 剪貼簿中有 SKILL.md 的絕對路徑
