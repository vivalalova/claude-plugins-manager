---
title: 更新 CLAUDE.md 和 MEMORY.md 反映 Agent Skills 架構
created: 2026-03-16
priority: low
suggested_order: Z99
blockedBy:
  - d1-online-search
  - d2-registry-leaderboard
  - d3-check-update
phase: needs-commit
iteration: 2
max_iterations: 3
review_iterations: 0
max_review_iterations: 1
---

# 更新 CLAUDE.md 和 MEMORY.md 反映 Agent Skills 架構

所有 skills 功能完成後，更新專案文件反映新架構。

## User Stories

- As a 後續開發者, I want 完整的文件, so that 我能理解 skills 功能的架構和注意事項

## 實作內容

### CLAUDE.md 更新

1. **架構區段**：
   - `PanelCategory` 加入 `'skill'`
   - 新增 SkillService 到 Services 表格
   - Service 依賴表加入 SkillService → CliService（npx 路徑搜尋）
   - 新增 skills 相關檔案路徑說明

2. **已知陷阱**：
   - `npx skills find` 無 `--json`，需文字解析（含 ANSI codes）
   - `npx skills add` 必須 `--yes --all` 避免互動式 TUI
   - skills.sh 無公開 JSON API，需 HTML 解析
   - Extension Host 的 PATH 可能不含 npx → SkillService 有獨立路徑搜尋
   - SkillScope 只有 `'global' | 'project'`，不同於 PluginScope 的三值

3. **設定檔結構**：
   - `~/.claude/skills/` — global scope skills
   - `.claude/skills/` — project scope skills

### MEMORY.md 更新

記錄：
- CLI 行為驗證結果（A1 產出的 memory file）
- skills 只有 global + project 兩種 scope（無 local）
- skills.sh HTML 解析方式和 CSS selector

### README.md（如有）

新增 Agent Skills 管理功能說明。

## 驗收條件

- Given 所有 skills 功能已完成
- When 閱讀 CLAUDE.md
- Then 完整描述 SkillService 架構、PanelCategory 擴充、CLI 行為陷阱
- Given 新開發者第一次接觸
- When 閱讀 MEMORY.md
- Then 了解 skills 的 scope 限制和 CLI 解析注意事項
