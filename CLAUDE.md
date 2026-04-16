# Claude Plugins Manager — VSCode Extension

## 指令

```bash
npm run typecheck
npm test
npm run build
npm run verify
npm run check:schema
npm run install:ext
npm run watch
```

有程式碼改動先跑 `npm run verify`，完成後一律跑 `npm run install:ext`。

## 專案不變量

- `src/shared/types.ts` 是 `ClaudeSettings` 與共用型別唯一來源，禁止在其他檔案重複定義。
- `src/shared/claude-settings-schema.ts` 是 settings metadata 唯一來源。section 陣列順序就是 UI 渲染順序，enum 用 `String + options`，不要再加 `hidden` 逃生門。
- Settings UI 以 schema-driven 為主；`PermissionsSection` 與 object 型欄位 editor 保持手動實作，其餘優先走 `SchemaFieldRenderer`。
- 已知 env vars 一律維護在 `src/shared/known-env-vars.ts`，不要在 UI 或 service 內各自維護清單。
- Extension 和 Webview 的通訊契約只走 `protocol.ts` 定義的 request/response/push message。
- Service 邊界保持清楚：CLI 封裝放 `CliService`，設定檔存取放 `SettingsFileService`，UI 偏好持久化放 `PreferencesService`。

## 設定頁開發

- 新增 setting 時，同步更新 schema、`ClaudeSettings`、i18n，缺一不可。
- 沒有自然落點的 user-facing key 直接放 `advanced`。
- `controlType: Object` 的欄位在對應 section 內手動渲染，不要硬塞進通用 renderer。
- 實作設定頁新功能前，先查 JSON Schema：
  [claude-code-settings.json](https://json.schemastore.org/claude-code-settings.json)
- 同步 Claude settings docs 變更回 repo 前，先讀
  [.claude/skills/update-settings-options/SKILL.md](/Users/lova/git/extensions/claude-plugins/.claude/skills/update-settings-options/SKILL.md)

## 重要路徑

- `src/extension/`：VSCode extension host 與 services
- `src/webview/`：React webview UI
- `src/webview/editor/settings/`：settings editor 與各 section
- `src/webview/editor/plugin/`：plugin manager UI
- `src/webview/editor/skill/`：skills manager UI
- `src/extension/services/__tests__/`
- `src/webview/**/__tests__/`

## 已知陷阱

- `claude plugin install` 會自動 enable，後續再呼叫 `enable` 會 exit 1。
- 重複 `enable` / `disable` 都可能 exit 1，UI 需要靜默處理。
- `claude mcp list` 沒有 `--json`，需要解析文字輸出。
- `marketplace list --json` 資訊不完整，完整資料要讀 `known_marketplaces.json`。
- `getSchemaDefault()` / `getSchemaEnumOptions()` 對不存在的 key 會直接拋錯，保持 fail-fast。
- `npx skills find` 沒有 `--json`，而且輸出可能帶 ANSI code。
- `npx skills remove <name> --all` 會忽略 name 並移除全部，禁止在 UI remove 流程使用。
- `npx skills add` / `remove` 要帶 `--yes`，避免互動式 TUI。
- Extension Host 的 PATH 可能找不到 `npx`，相關處理集中在 `SkillService`。
- `ScopePicker` dropdown 需要 portal 到 `document.body`，否則會被 card list 的 overflow 裁切。

## 測試

- 測試框架：vitest + `@testing-library/react`
- component test 要加 `/** @vitest-environment jsdom */`
- `promisify(execFile)` 的 mock 用 callback 形式：`cb(null, { stdout })`
- Webview 測試維持 mock `src/webview/vscode.ts`

## Repo-local Skill

- Claude settings docs 同步：先讀
  [.claude/skills/update-settings-options/SKILL.md](/Users/lova/git/extensions/claude-plugins/.claude/skills/update-settings-options/SKILL.md)
