---
title: SkillsPage 基礎 UI — 已安裝列表 + add/remove + i18n + sidebar
created: 2026-03-16
priority: high
suggested_order: C1
blockedBy: b2-filewatcher-router-extension
phase: needs-commit
iteration: 2
max_iterations: 3
review_iterations: 2
max_review_iterations: 2
---

# SkillsPage 基礎 UI — 已安裝列表 + add/remove + i18n + sidebar

建立 SkillsPage 及子元件，顯示已安裝 skills 列表，支援 add/remove 操作，含完整 i18n 和 sidebar 入口。

## User Stories

- As a 使用者, I want 在 sidebar 看到 Skills 入口並進入管理頁面, so that 我能查看所有已安裝 skills
- As a 使用者, I want 一鍵安裝和移除 skill, so that 不需手動操作 CLI

## 實作內容

### 元件結構（參考 PluginPage 拆分模式）

```
src/webview/editor/skill/
├── SkillsPage.tsx        # state + layout
├── SkillToolbar.tsx       # scope filter tabs (Global/Project) + search + Add button
├── SkillSections.tsx      # 按 scope 分組的 skill 卡片列表
├── SkillCard.tsx          # 單一 skill 卡片
├── SkillDialogs.tsx       # AddSkillDialog + RemoveConfirmDialog
└── __tests__/
    └── SkillsPage.test.tsx
```

### SkillsPage.tsx

State：
- `skills: AgentSkill[]` — 已安裝 skills
- `loading: boolean`
- `error: string | null`
- `searchQuery: string`
- `scopeFilter: SkillScope | 'all'`

載入：`useEffect` → `sendRequest({ type: 'skill.list' })`
刷新：`onPushMessage('skill.refresh')` → 重新 fetch

### SkillToolbar.tsx

- Scope filter：`All` / `Global` / `Project` tab 切換
- Search：本地 filter（by name/description）
- `+ Add Skill` 按鈕 → 開啟 AddSkillDialog

### SkillSections.tsx

- 按 scope 分組：Global Skills / Project Skills
- 空 scope 顯示空狀態文字
- 全部為空顯示引導畫面（指向 Add Skill 或 Registry tab）

### SkillCard.tsx

- 顯示：name、description、scope badge、agents tags
- 操作：Remove 按鈕（帶 confirm dialog）
- 點擊卡片可展開/收合 detail（後續 C2 實作，此階段不需）

### SkillDialogs.tsx

AddSkillDialog：
- 輸入框：接受 `owner/repo`、`owner/repo@skill`、GitHub URL
- Scope 選擇：Global / Project（radio buttons）
- Project scope 需開啟 workspace 才可選
- Submit → `skill.add` → 關閉 dialog → 刷新列表
- Loading + error 狀態

RemoveConfirmDialog：
- 顯示 skill name + scope
- 確認 → `skill.remove` → 刷新列表

### EditorApp.tsx 修改

```tsx
case 'skill': return <SkillsPage />;
```

### CSS

新增 `src/webview/styles/skills.css`：
- 主要複用 `cards.css` 的 `.card`、`.card-list`、`.scope-badge` 等
- 僅新增 skills 特有樣式（如 agents tag list）

`src/webview/styles.css` 加入 `@import './styles/skills.css';`

### i18n（三語言同步）

`en.ts` / `zh-TW.ts` / `ja.ts` 新增 `skill.*` namespace：
- `skill.title` / `skill.empty` / `skill.loading`
- `skill.scope.global` / `skill.scope.project` / `skill.scope.all`
- `skill.add.title` / `skill.add.source` / `skill.add.sourcePlaceholder` / `skill.add.scopeLabel`
- `skill.remove.confirm` / `skill.remove.confirmMessage`
- `skill.search.placeholder` / `skill.search.noResults`
- `skill.card.agents` / `skill.card.noDescription`
- `skill.error.add` / `skill.error.remove` / `skill.error.load`
- `sidebar.skill` / `sidebar.skill.desc`

### 測試（TDD）

`SkillsPage.test.tsx`：
1. loading 狀態 → skeleton 顯示
2. 空狀態 → empty state 元件顯示
3. 有 skills → SkillCard 正確渲染（name、scope badge、agents）
4. scope filter 切換 → 過濾正確
5. search 過濾 → 依 name/description 過濾
6. Add Skill dialog → 正確送出 `skill.add` message
7. Remove 按鈕 → confirm dialog → `skill.remove` message
8. `skill.refresh` push → 觸發 re-fetch

## 驗收條件

- Given 使用者從 sidebar 點擊 Skills
- When editor panel 開啟
- Then 顯示已安裝 skills 列表，按 Global / Project 分組
- Given 使用者點擊 Add Skill 並輸入 `vercel-labs/agent-skills`
- When 選擇 Global scope 並提交
- Then 呼叫 `skill.add`，安裝完成後列表刷新
- Given 使用者點擊 Remove 按鈕
- When 確認 dialog
- Then 呼叫 `skill.remove`，移除後列表刷新
- `npm run typecheck` 和 `npm run build` 通過
- 三語言 i18n key 完整
- Component test 全部通過
