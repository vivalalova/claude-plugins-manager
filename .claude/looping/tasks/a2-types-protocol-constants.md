---
title: 定義 AgentSkill 型別、Protocol messages、Constants
created: 2026-03-16
priority: critical
suggested_order: A2
blockedBy: a1-verify-npx-skills-cli
---

# 定義 AgentSkill 型別、Protocol messages、Constants

在 shared 層建立所有 agent-skills 相關的型別定義、通訊協議、常數，為後續 Service 和 UI 任務建立基礎。

## User Stories

- As a 開發者, I want 統一的型別定義, so that extension host 和 webview 之間通訊有型別安全保障

## 實作內容

### 1. `src/shared/types.ts` 新增

```typescript
// Scope：只有 global + project（CLI 限制）
export type SkillScope = 'global' | 'project';

// 對應 npx skills list --json 的結構 + SKILL.md frontmatter
export interface AgentSkill {
  name: string;
  path: string;
  scope: SkillScope;
  agents: string[];
  description?: string;
  model?: string;
  context?: string;
  allowedTools?: string[];
}

// skills.sh registry 列表項目
export interface RegistrySkill {
  rank: number;
  name: string;
  repo: string;       // "owner/repo"
  installs: string;   // "561.5K"
  url: string;        // "/owner/repo/skill-name"
}

// skills.sh registry 排序方式
export type RegistrySort = 'all-time' | 'trending' | 'hot';

// npx skills find 文字解析結果
export interface SkillSearchResult {
  fullId: string;     // "owner/repo@skill-name"
  name: string;
  repo: string;       // "owner/repo"
  installs?: string;
  url?: string;
}
```

### 2. `src/extension/messaging/protocol.ts` 新增

RequestMessage：
- `skill.list` — 列出已安裝 skills（可選 scope filter）
- `skill.add` — 安裝 skill（source + scope）
- `skill.remove` — 移除 skill（name + scope）
- `skill.find` — `npx skills find` 文字搜尋
- `skill.check` — 檢查更新
- `skill.update` — 更新所有 skills
- `skill.getDetail` — 取得 SKILL.md 完整內容
- `skill.registry` — 從 skills.sh 取得 registry 列表（sort + 可選 query）
- `skill.openFile` — 在 VSCode 中打開 SKILL.md

PushMessage：
- `skill.refresh` — skills 檔案變更通知

### 3. `src/extension/constants.ts` 修改

- `PanelCategory` union 加入 `'skill'`
- `COMMANDS` 加入 `openSkill`
- `PANEL_TITLES` 加入 `skill` entry

### 4. `package.json` 修改

- `contributes.commands` 加入 `claude-plugins-manager.openSkill`

## 驗收條件

- Given 新增型別到 `src/shared/types.ts`
- When 執行 `npm run typecheck`
- Then 無型別錯誤，新型別可被 extension 和 webview 雙方 import
- Given Protocol 新增 `skill.*` messages
- When MessageRouter 參考這些型別
- Then 型別推導正確，requestId 自動帶入
- Given Constants 新增 `'skill'` PanelCategory
- When EditorPanelManager 使用
- Then switch-case 涵蓋新 category
