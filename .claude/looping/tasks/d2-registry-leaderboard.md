---
title: skills.sh Registry 排行榜（All Time / Trending / Hot）
created: 2026-03-16
priority: medium
suggested_order: D2
blockedBy: c1-skills-page-ui
---

# skills.sh Registry 排行榜（All Time / Trending / Hot）

在 SkillsPage 新增 Registry tab，顯示 skills.sh 的排行榜（All Time / Trending / Hot 三個分類），支援搜尋和一鍵安裝。

## User Stories

- As a 使用者, I want 瀏覽 skills.sh 的熱門排行榜, so that 我能發現高品質的 skills 並快速安裝

## 實作內容

### UI 設計

SkillsPage 新增兩個主 tab：
- **Installed**（預設）：現有的已安裝 skills 列表
- **Registry**：skills.sh 排行榜

Registry tab 內部結構：
```
┌──────────────────────────────────────────┐
│ 🔍 Search skills...                      │
├──────────────────────────────────────────┤
│ All Time (88,712)  Trending (24h)  Hot   │
├──────────────────────────────────────────┤
│ #  SKILL                        INSTALLS │
│ 1  find-skills                   561.5K  │
│    vercel-labs/skills       [Install ▾]  │
│ 2  vercel-react-best-practices   xxx     │
│    vercel-labs/agent-skills [Install ▾]  │
│ ...                                      │
└──────────────────────────────────────────┘
```

### 資料來源

呼叫 `skill.registry` message → SkillService.fetchRegistry()：
- `sort: 'all-time'` → fetch `https://skills.sh/`
- `sort: 'trending'` → fetch `https://skills.sh/trending`
- `sort: 'hot'` → fetch `https://skills.sh/hot`
- `query` → append `?q=keyword`

回傳 `RegistrySkill[]`。

### Registry 卡片 / Row

每個 RegistrySkill 顯示：
- Rank（#）
- Skill name
- Repo（owner/repo）
- Install count
- Install 按鈕（下拉選 scope：Global / Project）
- 已安裝的 skill 顯示 "Installed" badge 而非 Install 按鈕

### Sort Tab 切換

- 三個 tab：All Time / Trending (24h) / Hot
- 切換時 loading → fetch → 顯示結果
- 快取前次結果避免重複 fetch（但不持久化）

### 搜尋

- Registry 內搜尋框：debounce 500ms → 帶 `?q=keyword` 重新 fetch
- Loading + 空結果狀態

### 錯誤處理

- skills.sh 不可達 → ErrorBanner + retry 按鈕
- HTML 格式變更導致解析失敗 → 顯示友善錯誤，建議直接訪問 skills.sh

### i18n 補充

- `skill.registry.title` / `skill.registry.allTime` / `skill.registry.trending` / `skill.registry.hot`
- `skill.registry.search` / `skill.registry.installs`
- `skill.registry.installed` / `skill.registry.installTo`
- `skill.registry.loading` / `skill.registry.error` / `skill.registry.retry`
- `skill.tab.installed` / `skill.tab.registry`

### 測試

- Sort tab 切換 → 正確 fetch 對應 URL
- 搜尋 → debounce + 正確 query
- Install 按鈕 → `skill.add` message
- 已安裝 skill → 顯示 Installed badge
- Error → ErrorBanner 顯示 + retry
- HTML 解析 → mock HTML → 驗證 RegistrySkill[] 解析正確

## 驗收條件

- Given 使用者切換到 Registry tab
- When 頁面載入
- Then 顯示 All Time 排行榜，含 rank、name、repo、installs
- Given 使用者切換到 Trending tab
- When fetch skills.sh/trending
- Then 顯示趨勢排行榜
- Given 使用者在 Registry 搜尋框輸入 "react"
- When debounce 後 fetch
- Then 顯示篩選結果
- Given 某個 registry skill 已安裝
- When 列表渲染
- Then 該 skill 顯示 "Installed" badge
