# Claude Plugins Manager — VSCode Extension

## 指令

```bash
npm run typecheck          # 型別檢查（extension + webview 雙 tsconfig）
npm test                   # vitest run（1275 tests）
npm run build              # esbuild 雙配置（extension + webview）
npm run verify             # typecheck → test → build（一鍵驗證）
npm run check:schema       # 驗證 claude-settings-schema.ts 與 ClaudeSettings interface 一致
npm run install:ext        # pnpm install → build → package VSIX → code --install-extension
npm run watch              # concurrently watch extension + webview
```

驗證順序：`npm run verify`（= typecheck → test → build）；部署前加 `install:ext`

## 架構

- **Extension Host**（Node.js）：`src/extension/`
  — Services 直接讀寫 Claude Code 設定檔 + CLI 輔助
- **Webview UI**（React 19）：`src/webview/` — 單一 bundle，`data-mode` 切換 sidebar / editor
- **共用型別**：`src/shared/types.ts` — 唯一型別來源，禁止在其他檔案重複定義
- **Settings Schema**：`src/shared/claude-settings-schema.ts` — settings key metadata 單一來源；`npm run check:schema` 驗證與 `ClaudeSettings` interface 一致
- **通訊**：Extension ↔ Webview 用 `postMessage`；`protocol.ts` 定義 `RequestMessage`（request+requestId）、`ResponseMessage`（response+requestId）、`PushMessage`（broadcast，無 requestId）
- **PanelCategory**：`'marketplace' | 'plugin' | 'mcp' | 'settings' | 'info'`（對應 5 個 editor panel + sidebar tab）

### Services

| Service             | 資料來源                                                                  | 職責                                                     |
| ------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| CliService          | `child_process.execFile`                                                  | Claude CLI 封裝；自動搜尋完整路徑；env 清理 `CLAUDECODE` |
| SettingsFileService | `~/.claude/plugins/`、`~/.claude/settings.json`、`.claude/settings*.json` | 讀寫設定檔（含 `readScopedEnabledPlugins` / `readAllEnabledPlugins` 共用 helper）、掃描 marketplace/plugin 內容 |
| PluginService       | SettingsFileService + CLI（update only）                                  | per-scope install/enable/disable、listAvailable          |
| MarketplaceService  | `known_marketplaces.json` + CLI（add/remove/update）                      | marketplace CRUD、toggleAutoUpdate                       |
| McpService          | CLI + 設定檔                                                              | MCP server 管理、狀態輪詢                                |
| FileWatcherService  | VSCode `FileSystemWatcher`                                                | 監控設定檔變更，debounce 後推送 refresh 給 webview       |
| TranslationService  | MyMemory API + cache                                                      | Plugin description 批次翻譯                              |
| ExtensionInfoService | packageJson + CliService + 常數路徑                                      | 收集 extension 版本、CLI 路徑/版本、所有設定檔路徑供 InfoPage 顯示 |

### 設定檔結構

| 檔案                                        | 用途                                     |
| ------------------------------------------- | ---------------------------------------- |
| `~/.claude/settings.json`                   | user scope enabledPlugins                |
| `.claude/settings.json`                     | project scope enabledPlugins（進 git）   |
| `.claude/settings.local.json`               | local scope enabledPlugins（gitignored） |
| `~/.claude/plugins/installed_plugins.json`  | 安裝登錄（所有 scope）                   |
| `~/.claude/plugins/known_marketplaces.json` | marketplace 來源                         |

### Settings 頁面分區（`src/webview/editor/settings/`）

| Section             | 元件檔案                 | 涵蓋欄位範圍                                                                                    |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| GeneralSection      | `GeneralSection.tsx`     | effortLevel、language、availableModels、enableAllProjectMcpServers、includeGitInstructions、respectGitignore、fastMode、fastModePerSessionOptIn、autoMemoryEnabled、alwaysThinkingEnabled、outputStyle、autoUpdatesChannel、cleanupPeriodDays |
| DisplaySection      | `DisplaySection.tsx`     | teammateMode、showTurnDuration、spinnerTipsEnabled、spinnerVerbs、spinnerTipsOverride、terminalProgressBarEnabled、prefersReducedMotion |
| AdvancedSection     | `AdvancedSection.tsx` + `components/` 下 4 個 sub-editor（Attribution·StatusLine·Sandbox·CompanyAnnouncementsEditor） | forceLoginMethod、forceLoginOrgUUID、autoMemoryDirectory、modelOverrides、attribution、statusLine、fileSuggestion、sandbox、companyAnnouncements、skipWebFetchPreflight 等 CLI helper 欄位 |
| PermissionsSection  | `PermissionsSection.tsx` | permissions（allow/deny/ask/defaultMode/additionalDirectories）                                 |
| EnvSection          | `EnvSection.tsx`         | env（key-value map）                                                                            |
| HooksSection        | `HooksSection.tsx`       | hooks（四種 type）、disableAllHooks                                                             |

## 設定頁參數參考

實作設定頁新功能前，先查官方文件確認支援的參數：
https://code.claude.com/docs/en/settings

同步 docs 變更回 repo 前，先讀 [.claude/skills/sync-settings-options/SKILL.md](/Users/lova/git/vibe/claude-plugins/.claude/skills/sync-settings-options/SKILL.md)

## 已知陷阱

- `claude plugin install` 會**自動 enable**，後續再呼叫 `enable` 會 exit 1
- `enable`/`disable` 重複操作都會 exit 1，UI 必須靜默吞掉
- CLI `marketplace list --json` 是精簡版，缺 `lastUpdated`/`autoUpdate`，完整資料要讀 `known_marketplaces.json`
- `claude mcp list` 無 `--json`，需解析文字輸出
- `tsconfig.json` 的 `exclude` 要加 `__tests__` 和 `__mocks__`，避免 vscode mock 型別衝突
- Plugin contents 掃描：frontmatter 用簡易 regex 解析（非完整 YAML parser），足夠處理 `name`/`description`
- `scanAvailablePlugins()` 會讀 `plugin.json`（description/version 優先於 marketplace.json）；`author` 欄位可能是 string 或 `{ name, email }` object
- `handleUpdateAll` 只更新 **enabled** plugin 的 **enabled** scope；disabled 的 skip
- `ClaudeSettings.sandbox` 透過 raw JSON textarea 編輯，儲存前以 `JSON.parse` 驗證格式
- `ClaudeSettings.modelOverrides` 透過 raw JSON textarea 編輯，儲存前以 `JSON.parse` 驗證格式
- `spinnerVerbs` / `spinnerTipsOverride` clear 操作呼叫 `onDelete(key)`，非存空物件
- `fileSuggestion` 儲存格式固定為 `{ type: 'command', command: string }`
- `statusLine` 儲存格式固定為 `{ type: 'command'; command: string; padding?: number }`
- `outputStyle` 為自由字串（TextSetting），如 `default`、`Explanatory`、`Learning`
- `teammateMode` 使用 `auto | in-process | tmux`；舊值 `inline` / `iterm2` 視為 unknown value 顯示
- `HookCommand` 四種 type 均有 `statusMessage?: string`；http type 額外有 `allowedEnvVars?: string[]`
- `permissions.disableBypassPermissionsMode` 可設為 `'disable'` 停用 bypass 模式
- `sandbox` 額外子屬性：`enableWeakerNetworkIsolation`、`enableWeakerNestedSandbox`、`allowUnsandboxedCommands`、`ignoreViolations`、`network.allowAllUnixSockets`、`network.httpProxyPort`、`network.socksProxyPort`、`network.allowManagedDomainsOnly`
- `spinnerVerbs.mode` 為 optional（schema 不要求）

## 測試

- 框架：vitest + `@testing-library/react`（jsdom）
- 位置：`src/extension/services/__tests__/`（含 `*.integration.test.ts`）、`src/webview/__tests__/`、`src/webview/editor/**/__tests__/`
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
| Claude settings docs 同步 | sync-settings-options（repo-local） |
