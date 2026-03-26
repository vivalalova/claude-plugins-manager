# Claude Plugins Manager — VSCode Extension

## 指令

```bash
npm run typecheck          # 型別檢查（extension + webview 雙 tsconfig）
npm test                   # vitest run
npm run build              # esbuild 雙配置（extension + webview）
npm run verify             # typecheck → lint → check:schema → test → build（一鍵驗證）
npm run check:schema       # 驗證 schema 與 ClaudeSettings interface 一致 + controlType/options 邏輯驗證
npm run install:ext        # pnpm install → build → package VSIX → code --install-extension
npm run watch              # concurrently watch extension + webview
```

驗證順序：`npm run verify`（= typecheck → lint → check:schema → test → build）；部署前加 `install:ext`

## 架構

- **Extension Host**（Node.js）：`src/extension/`
  — Services 直接讀寫 Claude Code 設定檔 + CLI 輔助
- **Webview UI**（React 19）：`src/webview/` — 單一 bundle，`data-mode` 切換 sidebar / editor
- **CSS 模組化**：`src/webview/styles.css` 為 `@import` 彙總檔，實際樣式在 `src/webview/styles/`（base.css / sidebar.css / layout.css / cards.css / mcp.css / skills.css / settings.css / common.css）
- **共用型別**：`src/shared/types.ts` — 唯一型別來源，禁止在其他檔案重複定義
- **Settings Schema**：`src/shared/claude-settings-schema.ts` — settings key metadata 單一來源；巢狀結構 `Record<SettingsSection, SettingFieldEntry[]>`，陣列順序即 UI 渲染順序；`controlType` 用原生型別（`String`/`Number`/`Boolean`/`Array`/`Object`）；`String` + `options` = enum dropdown；`SETTINGS_FLAT_SCHEMA` 扁平索引供 key lookup；`getSectionFieldOrder(section)` 取渲染順序；`getSchemaDefault()` 取 default 值、`getSchemaEnumOptions()` 取 enum options、`KNOWN_MODEL_OPTIONS` model dropdown fallback 清單；`npm run check:schema` 驗證一致性 + 邏輯約束
- **Known Env Vars**：`src/shared/known-env-vars.ts` — 已知 env vars registry；`valueType` 用原生型別（`String`/`Number`/`Boolean`）供 EnvSection autocomplete + inline description（i18n）；`update-settings-options` skill Phase 1c 同步維護
- **SchemaFieldRenderer**：`src/webview/editor/settings/components/SchemaFieldRenderer.tsx` — 依 schema `controlType` 自動渲染控制元件（boolean/enum/text/number/tagInput）；`custom` 回傳 null，由 Section 手動處理
- **SettingControls**：`src/webview/editor/settings/components/SettingControls.tsx` — UI 控制元件集合（BooleanToggle/EnumDropdown/TextSetting/NumberSetting/TagInput）+ 共用 helper：`getOverriddenScope()`（scope override 判斷）、`shouldShowReset()`（reset default 判斷）、`OverrideBadge`（覆寫指示徽章）
- **通訊**：Extension ↔ Webview 用 `postMessage`；`protocol.ts` 定義 `RequestMessage`（request+requestId）、`ResponseMessage`（response+requestId）、`PushMessage`（broadcast，無 requestId）
- **PluginPage 子元件**：`PluginPage.tsx`（state + layout）→ `PluginToolbar.tsx`（搜尋 + filter）、`PluginSections.tsx`（section 渲染 + drag/drop）、`PluginDialogs.tsx`（BulkEnableScopeDialog / TranslateDialog / KeyboardHelpOverlay）
- **SkillsPage 子元件**：`SkillsPage.tsx`（state + layout；header 含 `page-actions` div：Add Skill/Check Updates/Update All/Refresh）→ `SkillToolbar.tsx`（Row 1: 搜尋列；Row 2: mode tabs + contextual filter chips；action 按鈕已移至 page header，props 不含 `onAddClick`/`checking`/`onCheckUpdates`/`updating`/`onUpdateAll`/`checkResult`）、`SkillSections.tsx`（scope 分組；內部 `collapsed` Set\<string\> 狀態，`section-toggle`/`section-chevron`/`section-body` 折疊模式同 PluginSections）、`SkillCard.tsx`（已安裝 skill 卡片；flat layout，agents 標籤以彩色 tag 與 scope badge 同列顯示，path 直接顯示）、`SkillSearchResultCard.tsx`（線上搜尋結果；`.card-name-column`/`.card-name-with-rank` CSS class）、`RegistrySkillCard.tsx`（Registry 排行榜；client-side `filteredRegistry` useMemo 過濾，`name`/`repo` 欄位即時搜尋，不 debounce）、`ContentDetailPanel.tsx`（共用元件，SKILL.md / plugin content 詳情；支援 `onCopyPath` prop）、`SkillDialogs.tsx`（AddSkillDialog：inline style 已改 CSS class `skill-dialog-*`；RemoveConfirmDialog）
- **PanelCategory**：`'marketplace' | 'plugin' | 'mcp' | 'skill' | 'settings' | 'info'`（對應 6 個 editor panel + sidebar tab）

### Services

| Service             | 資料來源                                                                  | 職責                                                     |
| ------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| CliService          | `child_process.execFile`                                                  | Claude CLI 封裝；自動搜尋完整路徑；env 清理 `CLAUDECODE` |
| SettingsFileService | `~/.claude/plugins/`、`~/.claude/settings.json`、`.claude/settings*.json` | 讀寫 Claude Code 設定檔（含 `readScopedEnabledPlugins` / `readAllEnabledPlugins` 共用 helper）、掃描 marketplace/plugin 內容 |
| PreferencesService  | `context.globalState`                                                     | UI 偏好持久化（排序/過濾/翻譯設定等）；封裝 VSCode 原生 KV store；含舊版 preferences.json 遷移 |
| PluginService       | SettingsFileService + CLI（update only）                                  | per-scope install/enable/disable、listAvailable          |
| MarketplaceService  | `known_marketplaces.json` + CLI（add/remove/update）                      | marketplace CRUD、toggleAutoUpdate                       |
| McpService          | CLI + 設定檔                                                              | MCP server 管理、狀態輪詢（僅 MCP panel 可見時執行）、Test Connection（全量 refresh，CLI 不支援 per-server 查詢；UI 顯示「Checking all servers...」+ 其他按鈕 disabled） |
| FileWatcherService  | VSCode `FileSystemWatcher`                                                | 監控設定檔變更，debounce 後推送 refresh 給 webview       |
| TranslationService  | MyMemory API + cache                                                      | Plugin description 批次翻譯；callApiWithRetry 含 retry + exponential backoff |
| SkillService        | `npx skills` CLI + `skills.sh` HTML + `cacheDir`                          | npx skills CLI 封裝（list/add/remove/find/check/update/getDetail）+ skills.sh registry 解析；獨立 npx 路徑搜尋（NVM → /usr/local/bin → /opt/homebrew/bin → fallback） |
| ExtensionInfoService | packageJson + CliService + 常數路徑                                      | 收集 extension 版本、CLI 路徑/版本、所有設定檔路徑（`PathInfo` 含 `exists` 檢測）供 InfoPage 顯示 |

### Service 依賴

CliService ← PluginService, MarketplaceService, McpService, ExtensionInfoService
SettingsFileService ← PluginService, McpService
PreferencesService — 封裝 context.globalState（MessageRouter 直接依賴）
SkillService(cacheDir) — 獨立（不依賴 CliService，自行管理 npx 路徑 + spawn）
FileWatcherService → SettingsFileService.invalidateScanCache(), McpService.invalidateMetadataCache()
FileWatcherService.onSkillFilesChanged → EditorPanelManager（push skill.refresh）
EditorPanelManager → McpService.startPolling()/stopPolling()（panel category 切換控制）

### 設定檔結構

| 檔案                                        | 用途                                     |
| ------------------------------------------- | ---------------------------------------- |
| `~/.claude/settings.json`                   | user scope enabledPlugins                |
| `.claude/settings.json`                     | project scope enabledPlugins（進 git）   |
| `.claude/settings.local.json`               | local scope enabledPlugins（gitignored） |
| `~/.claude/plugins/installed_plugins.json`  | 安裝登錄（所有 scope）                   |
| `~/.claude/plugins/known_marketplaces.json` | marketplace 來源                         |
| `~/.claude/skills/`                         | global scope skills（symlink/目錄）      |
| `.claude/skills/`                           | project scope skills                     |
| `context.globalState`                       | UI 偏好（排序/過濾/翻譯設定/agent 選擇）|
| `globalStorageUri/cache/`                   | 翻譯/hook 解釋/skill registry 快取       |

### Settings 頁面分區（`src/webview/editor/settings/`）

| Section | 渲染模式 | 涵蓋欄位 |
| --- | --- | --- |
| GeneralSection | **全 schema-driven**（`getSectionFieldOrder('general')` loop） | effortLevel、language、availableModels、enableAllProjectMcpServers、includeGitInstructions、respectGitignore、fastMode、fastModePerSessionOptIn、autoMemoryEnabled、alwaysThinkingEnabled、outputStyle、autoUpdatesChannel、cleanupPeriodDays |
| DisplaySection | **schema-driven**（`getSectionFieldOrder('display')` loop）；spinnerVerbs/spinnerTipsOverride 為 custom 手動渲染 | teammateMode、showTurnDuration、spinnerTipsEnabled、terminalProgressBarEnabled、prefersReducedMotion、spinnerVerbs、spinnerTipsOverride |
| AdvancedSection | **schema-driven**（`getSectionFieldOrder('advanced')` loop）；attribution/statusLine/fileSuggestion/sandbox/companyAnnouncements/modelOverrides/worktree 為 custom 手動渲染；sandbox 支援結構化 + JSON 雙模式 | forceLoginMethod、attribution、statusLine、fileSuggestion、sandbox、companyAnnouncements、forceLoginOrgUUID、plansDirectory、apiKeyHelper、otelHeadersHelper、awsCredentialExport、awsAuthRefresh、skipWebFetchPreflight、claudeMdExcludes、modelOverrides、feedbackSurveyRate、worktree |
| PermissionsSection | 手動（custom）；allowedMcpServers/deniedMcpServers 為 JSON TextSetting | permissions（allow/deny/ask/defaultMode/additionalDirectories）、enabledMcpjsonServers、disabledMcpjsonServers、allowedMcpServers、deniedMcpServers |
| EnvSection | 手動（custom） | env（key-value map） |
| HooksSection | **混合**：disableAllHooks/httpHookAllowedEnvVars/allowedHttpHookUrls 用 SchemaFieldRenderer；hooks 本體手動 | hooks（四種 type）、disableAllHooks、httpHookAllowedEnvVars、allowedHttpHookUrls |

## 設定頁參數參考

實作設定頁新功能前，先查官方文件確認支援的參數：
https://code.claude.com/docs/en/settings

同步 docs 變更回 repo 前，先讀 [.claude/skills/update-settings-options/SKILL.md](/Users/lova/git/vibe/claude-plugins/.claude/skills/update-settings-options/SKILL.md)

## 新增 Setting Checklist

1. **Schema**：`claude-settings-schema.ts` 所屬 section 陣列加 `{ key, controlType, ... }`（陣列位置即渲染順序）；`controlType` 用原生型別（`String`/`Number`/`Boolean`/`Array`/`Object`）；enum 用 `String` + `options`；number 加 `min`/`max`/`step`；有預設加 `default`；不渲染的 key 加 `hidden: true`
2. **Interface**：`shared/types.ts` 的 `ClaudeSettings` 加對應欄位（`npm run check:schema` 驗證一致性）
3. **i18n**：`i18n/locales/` 三語言加 `settings.{section}.{key}.label`/`.description`（enum 加各選項 label + notSet + unknown；text/number 加 `placeholder`）（`check:schema` 自動驗證 en.ts key 完整性）
4. **custom 欄位**：`controlType: Object` → Section 內 `renderCustom` switch case 手動渲染；建獨立 sub-editor
5. **驗證**：`npm run verify`（含 lint + check:schema i18n 驗證 + duplicate key 檢查）

## 修改紀律

- 多步修改被中途糾正 → 先**還原已改錯的部分**，再繼續正確方向；禁帶著錯誤狀態往前推

## 已知陷阱

- `claude plugin install` 會**自動 enable**，後續再呼叫 `enable` 會 exit 1
- `enable`/`disable` 重複操作都會 exit 1，UI 必須靜默吞掉
- CLI `marketplace list --json` 是精簡版，缺 `lastUpdated`/`autoUpdate`，完整資料要讀 `known_marketplaces.json`
- `claude mcp list` 無 `--json`，需解析文字輸出
- `SchemaFieldRenderer` 的 `custom` controlType 回傳 `null`，Section 必須在 loop 中 switch-case 手動處理
- `check:schema` 自動驗證 i18n key 完整性 + 跨 section duplicate key 檢查
- `getSchemaDefault()`/`getSchemaEnumOptions()` 對不存在的 key 拋 Error（fail-fast）
- `npx skills find` 無 `--json`，需文字解析（含 ANSI codes，用 `/\x1b\[[0-9;?]*[A-Za-z]/g` 去除）
- `npx skills remove <name> --all` 會**忽略 name 移除全部**，UI 的 remove 禁帶 `--all`
- `npx skills add`/`remove` 必須 `--yes` 避免互動式 TUI；`add` 用 `--yes --all`
- skills.sh 無公開 JSON API，從 `__next_f.push` 中的 `initialSkills` JSON 解析排行榜
- SkillScope 只有 `'global' | 'project'`（無 `local`），不同於 PluginScope 三值
- Extension Host 的 PATH 可能不含 npx → SkillService 有獨立路徑搜尋（NVM 最新版優先）
- `ScopePicker` dropdown 用 `createPortal(dropdown, document.body)`：`.card` 的 CSS `transform` animation 產生 containing block，導致 `position: fixed` 被 `.card-list` `overflow: hidden` 裁切；portal 到 body 可繞過此限制

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
| Claude settings docs 同步 | update-settings-options（repo-local） |
