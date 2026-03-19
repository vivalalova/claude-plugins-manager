---
title: npx skills CLI 行為文件 + skills.sh HTML 結構文件
created: 2026-03-16
priority: critical
suggested_order: A1
phase: needs-commit
iteration: 1
max_iterations: 3
review_iterations: 0
---

# npx skills CLI 行為文件 + skills.sh HTML 結構文件

手動執行所有 `npx skills` 子命令，記錄實際 input/output 格式、exit code、edge case，產出行為文件供後續 task 參考。

## User Stories

- As a 開發者, I want 一份完整的 CLI 行為文件, so that 後續所有 task 能基於事實而非猜測實作

## 需要驗證的項目

### 基本命令

1. `npx skills list --json` — 回傳格式、欄位名稱
2. `npx skills list --json --global` — global scope 結果差異
3. `npx skills find <query>` — 輸出格式（含 ANSI escape codes？）、`--json` 是否有效
4. `npx skills add <source> --yes --all --global` — 非互動安裝行為、exit code
5. `npx skills add <source> --yes --all`（project scope）— cwd 行為
6. `npx skills remove <name> --yes --all --global` — 行為、exit code
7. `npx skills check` — 輸出格式
8. `npx skills update` — 輸出格式
9. `npx skills init` — 產生什麼

### Edge Cases

1. 重複 `add` 同一個 skill — exit code？錯誤訊息？
2. `remove` 不存在的 skill — exit code？
3. `list` 空目錄 — 回傳空陣列？
4. `find ""` 空查詢 — 行為？
5. `add` 無效來源 — 錯誤格式？

### 環境

1. `which npx` 路徑確認
2. Extension Host 模擬：`env -i PATH=/usr/bin:/bin npx skills list` — 是否 ENOENT？
3. npx 候選路徑：`~/.nvm/versions/node/*/bin/npx`、`/usr/local/bin/npx`、`/opt/homebrew/bin/npx`

### skills.sh 網站資料

1. 確認 HTML 結構穩定性：`/`、`/trending`、`/hot`、`/?q=keyword` 的 HTML skill row 格式
2. 每頁回傳幾筆？有無分頁機制？
3. 搜尋是 `/?q=` 還是 `/search?q=`（確認 redirect 行為）

## 產出

將驗證結果寫入 `memory/skills_cli_behavior.md`，格式：

```markdown
## npx skills list
- 支援 --json：是
- 回傳格式：[{ name, path, scope, agents }]
- global flag：--global
...

## npx skills find
- 支援 --json：是/否
- stdout 範例（含 ANSI codes raw）：<貼實際輸出>
- 每個結果的欄位結構：{ fullId, installs, url }（或實際格式）
- ANSI strip regex 驗證有效
- 空結果輸出：<貼實際輸出>
```

## 驗收條件

- Given 所有 `npx skills` 子命令
- When 逐一在終端機執行並記錄 stdout/stderr/exit code
- Then 產出完整 CLI 行為 memory 檔案，涵蓋每個命令的引數、JSON 支援、scope 行為、edge case
- Given `npx skills find <query>` stdout（含 ANSI codes）
- When 驗證解析邏輯
- Then 記錄每個 result row 的欄位結構（fullId、installs、url）、ANSI strip regex、空結果輸出格式
- Given skills.sh HTML
- When fetch `/`、`/trending`、`/hot`、`/?q=test`
- Then 記錄 HTML 結構（CSS selector for skill row、name、repo、installs）和分頁機制
