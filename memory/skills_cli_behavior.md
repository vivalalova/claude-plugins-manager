# npx skills CLI 行為文件

Version: 1.4.5 | 測試日: 2026-03-19

## 環境

- `which npx` → `~/.nvm/versions/node/v24.9.0/bin/npx`（npx 11.6.2）
- 候選路徑（實際存在）：`/opt/homebrew/bin/npx`、`~/.nvm/versions/node/{v18,v20,v23,v24}/bin/npx`
- `/usr/local/bin/npx` — 不存在
- Extension Host 模擬 `env -i PATH=/usr/bin:/bin npx` → **ENOENT**（確認需要完整路徑）

## npx skills list

| 參數 | 支援 |
|---|---|
| `--json` | ✅ |
| `--global` / `-g` | ✅（預設 project scope） |
| `--agent <name>` | ✅ 過濾，agent name 為 **kebab-case**（`claude-code`），用 display name `Claude Code` 會 exit 1 |

- JSON 回傳格式：`[{ name: string, path: string, scope: "project"|"global", agents: string[] }]`
- agents 陣列為 display name（`"Claude Code"`），但 CLI flag 需 kebab-case（`claude-code`）
- 空目錄 / 無 skills → `[]`（exit 0）

## npx skills find

| 參數 | 支援 |
|---|---|
| `--json` | ❌ 無效（輸出與無 `--json` 完全相同） |
| `<query>` | ✅ 帶 keyword 時 non-interactive |
| 無 query / `""` | ❌ 進入 interactive 模式（TUI），non-TTY 會 hang |

- exit 0 無論有無結果
- 無結果訊息：`No skills found for "<query>"`
- 有結果格式（含 ANSI）：

```
\x1b[38;5;145m{owner/repo@skill}\x1b[0m \x1b[36m{count} installs\x1b[0m
\x1b[38;5;102m└ https://skills.sh/{owner}/{repo}/{skill}\x1b[0m
```

- 每個結果 2 行：第 1 行 = fullId + installs，第 2 行 = URL
- fullId 格式：`{owner}/{repo}@{skill-name}`
- installs 格式：`16K`/`7.7K`/`346` + ` installs`
- URL 格式：`https://skills.sh/{owner}/{repo}/{skill}`（URL 用 `/` 分隔，非 `@`）
- ANSI strip regex：`/\x1b\[[0-9;]*m/g`
- 結果固定回傳 6 筆（目前觀察）
- 輸出前有 ASCII art banner（6 行）

## npx skills add

| 參數 | 說明 |
|---|---|
| `<source>` | GitHub `owner/repo`、URL、本地路徑 |
| `--yes` / `-y` | 跳過確認 |
| `--all` | `--skill '*' --agent '*' -y` 的簡寫 |
| `--global` / `-g` | 安裝到 global scope |
| `--skill <names>` | 指定安裝的 skill |
| `--agent <names>` | 指定 agent（kebab-case） |
| `--copy` | 複製而非 symlink |

- 成功 → exit 0
- 無效 source（clone 失敗）→ exit 1，訊息 `Failed to clone repository`
- 無 SKILL.md → exit 0（但印 `No valid skills found`）
- 重複 add 同一 skill → 待驗證（需實際安裝再重裝測試）
- `--agent '*'` 直接用 → exit 1（`Invalid agents: *`）；但 `--all` 可正常展開

## npx skills remove

| 參數 | 說明 |
|---|---|
| `[skills]` | 指定移除的 skill name |
| `--yes` / `-y` | 跳過確認 |
| `--all` | `--skill '*' --agent '*' -y` |
| `--global` / `-g` | 從 global scope 移除 |

- **⚠️ 嚴重陷阱**：`remove <name> --all` 會**忽略 `<name>` 參數**，移除所有已安裝 skills
- 移除不存在的 skill（無 `--all`）+ `--agent '*'` → exit 1（`Invalid agents: *`）
- `remove --all` 會刪除 `.claude/skills/` 下的 symlink/目錄
- exit 0 表示成功移除

## npx skills check

- 輸出 ANSI 文字：`Checking for skill updates...`
- 無 lock file 時：`No skills tracked in lock file.`
- exit 0
- 無 `--json` 支援

## npx skills update

- 行為與 `check` 類似
- 無 lock file → 同 check 訊息
- exit 0
- 無 `--json` 支援

## npx skills init

- `init [name]` → 在 cwd 建立 `SKILL.md`（預設用 cwd 目錄名為 skill name）
- exit 0
- **⚠️ 注意**：會在專案根目錄建立 SKILL.md

## Valid Agent Names

`amp`, `antigravity`, `augment`, `claude-code`, `openclaw`, `cline`, `codebuddy`, `codex`, `command-code`, `continue`, `cortex`, `crush`, `cursor`, `droid`, `gemini-cli`, `github-copilot`, `goose`, `junie`, `iflow-cli`, `kilo`, `kimi-cli`, `kiro-cli`, `kode`, `mcpjam`, `mistral-vibe`, `mux`, `opencode`, `openhands`, `pi`, `qoder`, `qwen-code`, `replit`, `roo`, `trae`, `trae-cn`, `warp`, `windsurf`, `zencoder`, `neovate`, `pochi`, `adal`, `universal`

---

# skills.sh HTML 結構文件

## 頁面類型

| 路徑 | 說明 | 排序 |
|---|---|---|
| `/` | All Time 排行榜 | 總安裝數 |
| `/trending` | Trending（24h） | 24h 安裝數 |
| `/hot` | Hot | 1H 安裝數 + 變化量 |
| `/?q=<keyword>` | 搜尋 | relevance + publisher + installs |

## initialSkills 解析方式

- 資料嵌入 `self.__next_f.push([1,"..."])` 的 JS 字串
- 雙引號 escape 為 `\"`，所以 key 格式是 `\"initialSkills\":[...]`
- **舊 regex `/initialSkills:(\[.*?\])/` 已失效**（key 帶 escaped quotes）
- 正確 regex：`/\\"initialSkills\\":([\s\S]*)/` + balanced bracket 找陣列結尾 + `replace(/\\"/g, '"')` unescape 後 JSON.parse

## Skill Row DOM 結構

### All Time / Trending（相同結構）

```html
<a class="group grid grid-cols-[auto_1fr_auto] lg:grid-cols-16 ..."
   href="/{owner}/{repo}/{skill}">
  <!-- col-span-1: Rank -->
  <div class="lg:col-span-1"><span>1</span></div>
  <!-- col-span-13: Skill name + repo -->
  <div class="lg:col-span-13">
    <h3>find-skills</h3>           <!-- skill name -->
    <p>vercel-labs/skills</p>      <!-- owner/repo -->
  </div>
  <!-- col-span-2: Installs -->
  <div class="lg:col-span-2"><span>618.0K</span></div>
</a>
```

### Hot（不同 col-span）

```html
<a ...>
  <div class="lg:col-span-1">...</div>    <!-- rank -->
  <div class="lg:col-span-11">...</div>   <!-- skill -->
  <div class="lg:col-span-4">
    <span>85</span>                         <!-- 1H installs -->
    <span class="text-green-500">+47</span> <!-- change delta -->
  </div>
</a>
```

### 搜尋結果

結構同 All Time，但：
- 容器為 `<div class="divide-y divide-border">`（非 virtual scroll）
- `items-start lg:items-end`（非 `items-center`）
- 固定上限 100 筆
- 無 tab 導覽

## CSS Selectors

| 用途 | Selector |
|---|---|
| Skill row | `a[href][class*="grid-cols-16"]` |
| Rank | `a > div:first-child > span` |
| Skill name | `a h3` |
| Repo | `a p` |
| Installs | `a > div:last-child > span:first-child` |
| Change delta (Hot) | `a > div:last-child > span:last-child` |
| Active tab | `a[class*="border-foreground"][class*="pb-1"]` |
| Search input | `#skills-search-input` |
| Header row | `div.hidden.lg\\:grid.grid-cols-16.border-b` |

## Install Count 格式

- ≥ 1000 → `K` 後綴（`7.3K`、`618.0K`）
- < 1000 → 原始數字（`778`、`22`）
- Hot 頁的 1H 值永遠是原始整數

## 分頁機制

- All Time / Trending / Hot：**virtual scroll**（無傳統分頁）
  - 容器高度 = 總項目數 × 52px，絕對定位
  - DOM 僅渲染可見的 ~30 個 row
  - 程式化抓取需模擬滾動或直接查後端 API
- 搜尋：**一次全部渲染**（上限 100 筆），無分頁

## Tab 導覽

```html
<a href="/">All Time (89,280)</a>        <!-- 括號內為總 skill 數 -->
<a href="/trending">Trending (24h)</a>
<a href="/hot">Hot</a>
```

## URL Pattern

- 列表頁 href：`/{owner}/{repo}/{skill}`
- 完整 URL：`https://skills.sh/{owner}/{repo}/{skill}`
- 搜尋：`https://skills.sh/?q={keyword}`
