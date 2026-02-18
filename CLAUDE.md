# Claude Plugins Manager — VSCode Extension

## 指令

```bash
npm run typecheck          # 型別檢查（extension + webview 雙 tsconfig）
npm test                   # vitest run（144 tests）
npm run build              # esbuild 雙配置（extension + webview）
npm run install:ext        # pnpm install → build → package VSIX → code --install-extension
npm run watch              # concurrently watch extension + webview
```

驗證順序：`typecheck → test → build → install:ext`

## 架構

- **Extension Host**（Node.js）：`src/extension/`
  — Services 直接讀寫 Claude Code 設定檔 + CLI 輔助
- **Webview UI**（React 19）：`src/webview/` — 單一 bundle，`data-mode` 切換 sidebar / editor
- **共用型別**：`src/shared/types.ts` — 唯一型別來源，禁止在其他檔案重複定義
- **通訊**：Extension ↔ Webview 用 `postMessage` + `requestId` 配對

### Services

| Service             | 資料來源                                                                  | 職責                                                     |
| ------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| CliService          | `child_process.execFile`                                                  | Claude CLI 封裝；自動搜尋完整路徑；env 清理 `CLAUDECODE` |
| SettingsFileService | `~/.claude/plugins/`、`~/.claude/settings.json`、`.claude/settings*.json` | 讀寫設定檔、掃描 marketplace/plugin 內容                 |
| PluginService       | SettingsFileService + CLI（update only）                                  | per-scope install/enable/disable、listAvailable          |
| MarketplaceService  | `known_marketplaces.json` + CLI（add/remove/update）                      | marketplace CRUD、toggleAutoUpdate                       |
| McpService          | CLI + 設定檔                                                              | MCP server 管理、狀態輪詢                                |
| TranslationService  | MyMemory API + cache                                                      | Plugin description 批次翻譯                              |

### 設定檔結構

| 檔案                                        | 用途                                     |
| ------------------------------------------- | ---------------------------------------- |
| `~/.claude/settings.json`                   | user scope enabledPlugins                |
| `.claude/settings.json`                     | project scope enabledPlugins（進 git）   |
| `.claude/settings.local.json`               | local scope enabledPlugins（gitignored） |
| `~/.claude/plugins/installed_plugins.json`  | 安裝登錄（所有 scope）                   |
| `~/.claude/plugins/known_marketplaces.json` | marketplace 來源                         |

## 已知陷阱

- `claude plugin install` 會**自動 enable**，後續再呼叫 `enable` 會 exit 1
- `enable`/`disable` 重複操作都會 exit 1，UI 必須靜默吞掉
- CLI `marketplace list --json` 是精簡版，缺 `lastUpdated`/`autoUpdate`，完整資料要讀 `known_marketplaces.json`
- `claude mcp list` 無 `--json`，需解析文字輸出
- `tsconfig.json` 的 `exclude` 要加 `__tests__` 和 `__mocks__`，避免 vscode mock 型別衝突
- Plugin contents 掃描：frontmatter 用簡易 regex 解析（非完整 YAML parser），足夠處理 `name`/`description`

## 測試

- 框架：vitest + `@testing-library/react`（jsdom）
- 位置：`src/extension/services/__tests__/`、`src/webview/editor/**/__tests__/`
- Mock 慣例：`vi.hoisted()` + `vi.mock()` factory（不用 `require`）
- PluginService 測試 mock `SettingsFileService`（非 CLI）
- `promisify(execFile)` 的 mock 用 callback 形式：`cb(null, { stdout })`
- Component test 需加 `/** @vitest-environment jsdom */` 並 mock `../../vscode`

## Skills 強制使用

| 時機         | Skill         |
| ------------ | ------------- |
| 程式碼變更後 | review        |
| Git 操作     | git           |
| 前端頁面檢查 | agent-browser |
