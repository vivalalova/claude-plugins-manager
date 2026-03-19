---
title: 實作 SkillService 封裝 npx skills CLI + skills.sh 解析
created: 2026-03-16
priority: critical
suggested_order: B1
blockedBy: a2-types-protocol-constants
phase: needs-commit
iteration: 2
max_iterations: 3
review_iterations: 3
---

# 實作 SkillService 封裝 npx skills CLI + skills.sh 解析

建立 `src/extension/services/SkillService.ts`，封裝所有 `npx skills` CLI 操作和 skills.sh HTML 解析。

## User Stories

- As a 使用者, I want 在 VSCode 內管理 skills, so that 不需切到終端機手動執行 npx skills
- As a 使用者, I want 瀏覽 skills.sh registry, so that 我能發現並安裝高品質的 skills

## 實作內容

### npx 路徑搜尋

`npx` 不同於 `claude`，需要獨立的路徑搜尋邏輯：
- 候選：`~/.nvm/versions/node/*/bin/npx`（取最新版）、`/usr/local/bin/npx`、`/opt/homebrew/bin/npx`、PATH 中的 npx
- 參考 CliService 的路徑搜尋模式，但不直接擴充 CliService（職責分離）
- 快取找到的路徑，避免每次 spawn 都重新搜尋

### CLI 封裝方法

| 方法 | CLI 命令 | 回傳 |
|------|----------|------|
| `list(scope?)` | `npx skills list --json [--global]` | `AgentSkill[]` |
| `add(source, scope)` | `npx skills add <source> --yes --all [--global]` | `void` |
| `remove(name, scope)` | `npx skills remove <name> --yes --all [--global]` | `void` |
| `find(query)` | `npx skills find <query>` | `SkillSearchResult[]`（文字解析） |
| `check()` | `npx skills check` | 更新資訊文字 |
| `update()` | `npx skills update` | `void` |
| `getDetail(skillPath)` | 讀取 SKILL.md | `{ frontmatter, body }` |

注意：
- scope mapping：`global` → `--global` flag，`project` → 預設（需 cwd = workspace path）
- `add`/`remove` 必須 `--yes --all` 避免互動式 TUI
- `find` 輸出需去除 ANSI escape codes 後 regex 解析
- 所有 CLI spawn 的 env 不需清除 `CLAUDECODE`（不是 claude 子命令）

### skills.sh Registry 解析

| 方法 | URL | 回傳 |
|------|-----|------|
| `fetchRegistry(sort, query?)` | `https://skills.sh/[trending\|hot]?q=keyword` | `RegistrySkill[]` |

解析策略：
- Fetch HTML → regex 提取 skill rows
- 每個 row 的 CSS 結構：`<a href="/owner/repo/skill">` 包含 rank + name + repo + installs
- 去除 HTML tags 後提取文字
- 搜尋用 `/?q=keyword`（`/search?q=` 會 redirect 回 `/?q=`）
- `/trending` 和 `/hot` 是獨立路由

### 測試（TDD）

先寫 `src/extension/services/__tests__/SkillService.integration.test.ts`：

1. **list 解析**：mock execFile 回傳 JSON stdout → 驗證解析為 AgentSkill[]
2. **list 空結果**：mock 空陣列 → 回傳 []
3. **add 參數**：驗證 global scope 帶 `--global`，project scope 帶 `cwd`
4. **remove 參數**：同上
5. **find 文字解析**：mock CLI 文字輸出（含 ANSI codes）→ 驗證解析為 SkillSearchResult[]
6. **find 空結果**：mock 無結果輸出 → 回傳 []
7. **registry HTML 解析**：mock HTML → 驗證解析為 RegistrySkill[]
8. **registry 搜尋**：mock search HTML → 驗證 query 傳遞正確
9. **npx 路徑搜尋**：mock fs.existsSync → 驗證候選路徑順序
10. **getDetail**：真實 filesystem，建臨時 SKILL.md → 驗證 frontmatter + body 分離

## 驗收條件

- Given SkillService 已實作
- When 呼叫 `list()` 方法
- Then 回傳與 `npx skills list --json` 相同的結構化資料
- Given 呼叫 `find('test')`
- When CLI 回傳文字結果
- Then 去除 ANSI codes 後正確解析為 SkillSearchResult[]
- Given 呼叫 `fetchRegistry('trending')`
- When fetch skills.sh/trending HTML
- Then 解析出 RegistrySkill[] 含 rank、name、repo、installs
- Given 呼叫 `add('vercel-labs/agent-skills', 'global')`
- When CLI 執行
- Then 使用 `--yes --all --global` flags，無互動式 prompt
- Integration test 全部通過
