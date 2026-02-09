# Claude Code Plugin/Marketplace/MCP — User Stories

## 一、Marketplace（市場）管理

> Marketplace 是 plugin 的來源倉庫，無 scope 概念（全域唯一）。
> 儲存位置：`~/.claude/plugins/known_marketplaces.json`

### M-1: 新增 Marketplace
```bash
claude plugin marketplace add <source>
# source 可以是：Git URL、GitHub repo（owner/repo）、本地目錄路徑
```
- **As a** 用戶
- **I want to** 新增一個 marketplace 來源（Git repo / GitHub repo / 本地目錄）
- **So that** 我可以從該來源瀏覽和安裝 plugin

### M-2: 移除 Marketplace
```bash
claude plugin marketplace remove <name>
```
- **As a** 用戶
- **I want to** 移除一個已註冊的 marketplace
- **So that** 不再從該來源取得 plugin

### M-3: 列出所有 Marketplace
```bash
claude plugin marketplace list [--json]
```
- **As a** 用戶
- **I want to** 查看所有已註冊的 marketplace 清單
- **So that** 知道目前有哪些 plugin 來源可用

### M-4: 更新 Marketplace
```bash
claude plugin marketplace update [name]
# 不指定 name 則更新全部
```
- **As a** 用戶
- **I want to** 從來源同步 marketplace 的最新內容（git pull）
- **So that** 能看到最新可用的 plugin

---

## 二、Plugin 安裝/移除/啟停

> Plugin 有 **scope** 概念：`user`（全域）、`project`（專案級）、`local`（臨時/session 級）
> 儲存位置：`~/.claude/plugins/installed_plugins.json`
> 啟停狀態：`~/.claude/settings.json` → `enabledPlugins`

### P-1: 安裝 Plugin（User Scope — 預設）
```bash
claude plugin install <plugin>
claude plugin install <plugin> --scope user
claude plugin install <plugin>@<marketplace>   # 指定 marketplace
```
- **As a** 用戶
- **I want to** 將 plugin 安裝到 user scope
- **So that** 此 plugin 在**所有專案**中都可用
- **儲存**：`installed_plugins.json` 中 `scope: "user"`

### P-2: 安裝 Plugin（Project Scope）
```bash
claude plugin install <plugin> --scope project
```
- **As a** 用戶
- **I want to** 將 plugin 安裝到特定專案
- **So that** 此 plugin **僅在當前專案**中生效
- **儲存**：`installed_plugins.json` 中 `scope: "project"` + `projectPath`
- **注意**：需在專案目錄內執行，會記錄 `projectPath`

### P-3: 安裝 Plugin（Local Scope）
```bash
claude plugin install <plugin> --scope local
```
- **As a** 用戶
- **I want to** 將 plugin 安裝到 local scope
- **So that** 此 plugin 僅在當前 session/workspace 層級生效

### P-4: 移除 Plugin（User Scope — 預設）
```bash
claude plugin uninstall <plugin>
claude plugin uninstall <plugin> --scope user
```
- **As a** 用戶
- **I want to** 從 user scope 移除 plugin
- **So that** 此 plugin 不再全域載入

### P-5: 移除 Plugin（Project Scope）
```bash
claude plugin uninstall <plugin> --scope project
```
- **As a** 用戶
- **I want to** 從特定專案移除 plugin
- **So that** 此 plugin 不再在該專案中載入

### P-6: 移除 Plugin（Local Scope）
```bash
claude plugin uninstall <plugin> --scope local
```
- **As a** 用戶
- **I want to** 從 local scope 移除 plugin
- **So that** 此 plugin 不再在 local 層級生效

### P-7: 啟用 Plugin
```bash
claude plugin enable <plugin> [--scope user|project|local]
```
- **As a** 用戶
- **I want to** 啟用一個已安裝但被停用的 plugin
- **So that** 此 plugin 重新載入並提供功能
- **儲存**：`settings.json` → `enabledPlugins: { "name@marketplace": true }`

### P-8: 停用 Plugin
```bash
claude plugin disable [plugin] [--scope user|project|local]
claude plugin disable --all   # 停用全部
```
- **As a** 用戶
- **I want to** 暫時停用 plugin（不移除）
- **So that** 保留安裝但不載入，可隨時重新啟用
- **特殊**：`--all` 一次停用所有已啟用的 plugin

### P-9: 列出已安裝 Plugin
```bash
claude plugin list [--json] [--available]
```
- **As a** 用戶
- **I want to** 查看所有已安裝的 plugin 及其 scope、版本、啟停狀態
- **So that** 掌握當前 plugin 配置全貌
- **特殊**：`--available` 額外顯示 marketplace 中可安裝的 plugin（需搭配 `--json`）

### P-10: 更新 Plugin
```bash
claude plugin update <plugin> [--scope user|project|local|managed]
```
- **As a** 用戶
- **I want to** 將 plugin 更新到最新版本
- **So that** 取得最新功能和修復
- **注意**：更新後需重啟 Claude Code 才生效

### P-11: 驗證 Plugin/Marketplace
```bash
claude plugin validate <path>
```
- **As a** plugin 開發者
- **I want to** 驗證我的 plugin 或 marketplace manifest 格式是否正確
- **So that** 確保發佈前格式無誤

### P-12: 臨時載入 Plugin（CLI 參數）
```bash
claude --plugin-dir <path> [--plugin-dir <path2>]
```
- **As a** 用戶/開發者
- **I want to** 在啟動時臨時載入本地目錄的 plugin（不永久安裝）
- **So that** 開發或測試 plugin 時不影響全域配置

---

## 三、MCP Server 管理

> MCP 有 **scope** 概念：`local`（預設）、`user`、`project`
> 另有 project 級 `.mcp.json` 檔案機制（放在專案根目錄）

### MCP-1: 新增 MCP Server（Local Scope — 預設）
```bash
claude mcp add <name> <commandOrUrl> [args...]
claude mcp add <name> <commandOrUrl> --scope local
# stdio（預設）:
claude mcp add my-server -- npx my-mcp-server
# HTTP:
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
# SSE:
claude mcp add --transport sse my-sse http://localhost:3000/sse
```
- **As a** 用戶
- **I want to** 在 local scope（當前 workspace）新增 MCP server
- **So that** 此 MCP server 僅在當前 workspace 可用
- **選項**：`-e KEY=value`（環境變數）、`-H "Header: value"`（HTTP headers）、`-t stdio|sse|http`（傳輸協定）、`--client-id`/`--client-secret`（OAuth）、`--callback-port`（OAuth callback port）

### MCP-2: 新增 MCP Server（User Scope）
```bash
claude mcp add <name> <commandOrUrl> --scope user
```
- **As a** 用戶
- **I want to** 在 user scope 新增 MCP server
- **So that** 此 MCP server 在**所有專案**中都可用

### MCP-3: 新增 MCP Server（Project Scope）
```bash
claude mcp add <name> <commandOrUrl> --scope project
```
- **As a** 用戶
- **I want to** 在 project scope 新增 MCP server
- **So that** 此 MCP server 僅在**當前專案**中可用

### MCP-4: 用 JSON 新增 MCP Server
```bash
claude mcp add-json <name> '<json>' [--scope local|user|project]
```
- **As a** 用戶
- **I want to** 用完整 JSON 配置字串新增 MCP server
- **So that** 可以一次設定所有細節（適合腳本/自動化）

### MCP-5: 從 Claude Desktop 匯入
```bash
claude mcp add-from-claude-desktop [--scope local|user|project]
```
- **As a** 用戶
- **I want to** 將 Claude Desktop 已配置的 MCP server 匯入 Claude Code
- **So that** 不用重新手動設定（僅限 Mac 和 WSL）

### MCP-6: 移除 MCP Server
```bash
claude mcp remove <name> [--scope local|user|project]
# 不指定 scope 時，自動從其所在的 scope 移除
```
- **As a** 用戶
- **I want to** 移除一個 MCP server
- **So that** 不再連線到該 server
- **智慧行為**：未指定 scope 時，自動偵測並從正確的 scope 移除

### MCP-7: 列出 MCP Server
```bash
claude mcp list
```
- **As a** 用戶
- **I want to** 查看所有已配置的 MCP server 及其連線狀態
- **So that** 確認哪些 server 正在運行
- **狀態**：`connected` / `failed` / `needs-auth` / `pending`

### MCP-8: 查看 MCP Server 詳情
```bash
claude mcp get <name>
```
- **As a** 用戶
- **I want to** 查看特定 MCP server 的完整配置和狀態
- **So that** 排查問題或確認設定

### MCP-9: 重置 Project MCP 選擇
```bash
claude mcp reset-project-choices
```
- **As a** 用戶
- **I want to** 重置當前專案中所有 `.mcp.json` 定義的 server 的審批狀態
- **So that** 重新觸發 approve/reject 提示（用於 project 級 `.mcp.json`）

### MCP-10: Project 級 `.mcp.json`
```json
// 專案根目錄 .mcp.json
{
  "server-name": {
    "command": "npx",
    "args": ["-y", "some-mcp-server"]
  }
}
```
- **As a** 專案維護者
- **I want to** 在專案根目錄放置 `.mcp.json` 定義共用的 MCP server
- **So that** 團隊成員 clone 專案後自動取得 MCP server 配置
- **安全**：首次使用時 Claude Code 會提示用戶 approve/reject

### MCP-11: Plugin 自帶 MCP Server
```json
// plugin 目錄下的 .mcp.json
{
  "context7": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp"]
  }
}
```
- **As a** plugin 開發者
- **I want to** 在 plugin 中捆綁 MCP server 定義
- **So that** 安裝 plugin 時自動配置對應的 MCP server

### MCP-12: 啟動 MCP Server 模式
```bash
claude mcp serve [--debug] [--verbose]
```
- **As a** 開發者
- **I want to** 將 Claude Code 本身作為 MCP server 啟動
- **So that** 其他 MCP client 可以連線使用 Claude Code 的能力

### MCP-13: CLI 啟動時載入 MCP Config
```bash
claude --mcp-config <path-or-json> [--strict-mcp-config]
```
- **As a** 用戶
- **I want to** 在啟動 Claude Code 時指定額外的 MCP 配置檔
- **So that** 臨時載入 MCP server 而不修改持久配置
- **選項**：`--strict-mcp-config` 僅使用指定的 config，忽略其他所有 MCP 配置

---

## 四、Scope 對照總結

| 功能 | Scope 選項 | 預設值 | 儲存位置 |
|------|-----------|--------|---------|
| Plugin install/uninstall | `user`, `project`, `local` | `user` | `~/.claude/plugins/installed_plugins.json` |
| Plugin enable/disable | `user`, `project`, `local` | `user` | `~/.claude/settings.json` → `enabledPlugins` |
| Plugin update | `user`, `project`, `local`, `managed` | `user` | 同 install |
| MCP add/remove | `local`, `user`, `project` | `local` | scope 對應的 settings |
| MCP add-json | `local`, `user`, `project` | `local` | 同上 |
| MCP add-from-desktop | `local`, `user`, `project` | `local` | 同上 |
| Marketplace add/remove | **無 scope**（全域唯一） | — | `~/.claude/plugins/known_marketplaces.json` |

### Scope 語義差異

- **Plugin 的 `user`** = 所有專案都載入（全域）
- **Plugin 的 `project`** = 僅特定專案載入（記錄 `projectPath`）
- **Plugin 的 `local`** = workspace/session 層級
- **MCP 的 `local`**（預設）= 當前 workspace
- **MCP 的 `user`** = 所有專案都連線
- **MCP 的 `project`** = 僅當前專案（另可用 `.mcp.json` 達成同效果）
- **Marketplace** = 無 scope，全域唯一的 plugin 來源清單
