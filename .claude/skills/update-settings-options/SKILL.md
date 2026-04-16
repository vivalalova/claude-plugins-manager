---
name: update-settings-options
description: 同步 Claude settings docs 變更到 repo（type/UI/i18n/tests/docs）
model: opus
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, Skill
---

# update-settings-options

同步 Claude settings docs 變更到 repo。4-phase automated pipeline。

## Trigger

- `sync settings from docs`
- `update settings options`
- `Claude settings docs changed`

## Source of truth

- **primary**: JSON schema store `https://json.schemastore.org/claude-code-settings.json`（社群維護，machine-readable）
- **official cross-check**: 官方 docs `code.claude.com/docs/en/settings` + CHANGELOG（每次執行檢查是否有 schema store 遺漏）
- **supplementary**: `context7` `/websites/code_claude`（補充描述/context，≤3 queries，含 official discovery）
- **fail-fast**: schema store 失敗 → 直接報錯結束，不 fallback
- **secondary**: `src/shared/types.ts`、現有 section 實作；只補 literal type、default、shape
- 衝突優先序：official schema（如有）> schema store > official docs > repo；輸出必列衝突點

## Key categories

Schema 包含多種 key，僅 `user-facing` 需同步到 settings UI：

| Category | 處理 | Keys |
|----------|------|------|
| user-facing | **同步**（按 surface-map 分 section） | 所有非下列類別的 key |
| anti-direction | **同步到 AdvancedSection** | 啟用後違反使用者優化方向（低成本/高效率/高精度）的 key。目前：`alwaysThinkingEnabled`。判定準則見 `references/surface-map.md` |
| managed-only | skip | `allowManagedHooksOnly`、`allowManagedPermissionRulesOnly`、`allowManagedMcpServersOnly`、`strictKnownMarketplaces`、`blockedMarketplaces`、`pluginTrustMessage` |
| plugin-internal | skip | `enabledPlugins`、`extraKnownMarketplaces`、`skippedMarketplaces`、`skippedPlugins`、`pluginConfigs` |
| deprecated | skip | `includeCoAuthoredBy`（replaced by `attribution`） |
| meta | skip | `$schema` |

## References

- canonical source / 刪除規則：`references/sources.md`
- key → section mapping：`references/surface-map.md`
- editor 選型：`references/editor-patterns.md`

## Phase 1: Fetch Schema（single source）

### 1a. JSON schema store（primary）

- `curl -sL https://json.schemastore.org/claude-code-settings.json`（需 `-L` follow redirect）
- 解析所有 `properties.*`：key、type、enum、default、description
- 解析 `$defs.hookCommand.anyOf[*]`：hook command types
- 解析 `properties.hooks.properties.*`：hook event types

### 1a′. Official source discovery

Schema store 是社群維護（[anthropics/claude-code#11795](https://github.com/anthropics/claude-code/issues/11795)），可能落後官方。此步驟交叉比對官方資訊：

1. **官方 docs 頁面**：透過 `context7` query `code.claude.com/docs/en/settings`（`/websites/code_claude`），抓 "Available settings" 表格中的 key 清單
2. **CHANGELOG**：`WebSearch` 搜 `site:github.com/anthropics/claude-code CHANGELOG settings` 找最近新增的 settings key
3. **比對**：官方 docs 出現但 schema store 沒有的 key → 標記 `docs-only`，納入 gap report
4. **優先序更新**：若找到 Anthropic 官方 hosted schema URL → 升級為 primary，schemastore 降為 fallback

### 1b. context7 supplementary（≤3 queries）

- resolve library id：`/websites/code_claude`
- 補充 schema 未涵蓋的 description/context（如新 key 的用途說明）
- 1a′ 的 docs query 計入 context7 quota
- context7 API 限制：**每次最多 3 queries**

### 1c. Env vars registry sync

- Source: `context7` `/websites/code_claude` — query env vars 文件（`claude-code-guide` agent 可補充）
- Env vars 不在 JSON schema store（schema 只有 `env: Record<string,string>`）
- 比對 `src/shared/known-env-vars.ts` — `KNOWN_ENV_VARS` registry
- Output: added/removed/changed env vars
- 參照 `references/env-vars-source.md`

### 1d. Fail-fast

- 1a schema store 失敗 → 直接報錯結束，不 fallback

## Phase 2: Repo Scan（single Explore agent）

單一 Explore agent 掃描 repo 現狀：

- `src/shared/types.ts` — ClaudeSettings interface 所有欄位
- `src/shared/claude-settings-schema.ts` — schema definitions（controlType 用原生型別 + options/default）
- `src/shared/claude-settings-schema.ts` 的陣列順序 — UI 渲染順序（`hidden: true` = 不渲染）
- `src/shared/known-env-vars.ts` — KNOWN_ENV_VARS registry（valueType 用原生型別）
- `src/webview/i18n/locales/en.ts` — i18n key 完整性

產出 diff：`{ added: [{key, type, default}], removed: [{key}], changed: [{key, field, schema, repo}] }`

## Phase 3: Gap Report + 確認

### 3a. Key 分類

每個 diff key 標記 category（參照上方 Key categories 表）。`user-facing` 與 `anti-direction` 進入 Phase 4。

Anti-direction 判定：新 key 先評估是否符合 `references/surface-map.md` 的 anti-direction 準則（anti-cost / anti-efficiency / anti-user）。符合 → 標記 `anti-direction`，固定放 `AdvancedSection`。

### 3b. Hook 覆蓋檢查

- hook event types：比對 schema `hooks.properties.*` vs repo HooksSection 支援（動態 `Object.keys()` 則自動相容）
- hook command types：比對 schema `$defs.hookCommand` vs repo `HookCommand` type union

### 3c. Env vars registry gap

- 比對 Phase 1c env vars docs vs `KNOWN_ENV_VARS` registry
- 新增/移除/變更 env vars 列入 gap 表

### 3d. Gap 表

```
| Key | Status | Category | Source | Section | Details |
```

Source 欄位：`schema` = schema store、`docs-only` = 官方 docs 有但 schema store 無、`both` = 兩者皆有

### 3e. 確認或 early exit

- 有 user-facing gap：`AskUserQuestion` 讓用戶確認 section assignment
- **無 user-facing gap → 報告同步完成，END**（skip Phase 4）

## Phase 4: Apply Changes

依序執行（參照 `references/` 決策）：

1. `src/shared/types.ts` — 增刪改 ClaudeSettings 欄位
2. `src/shared/claude-settings-schema.ts` — 增刪改 schema entry
3. `src/shared/claude-settings-schema.ts` — 新 key 加入對應 section 陣列（位置即渲染順序；不渲染加 `hidden: true`）
4. Section 元件 — 依 `references/surface-map.md` 分配，依 `references/editor-patterns.md` 選 control
5. i18n — `en.ts`、`ja.ts`、`zh-TW.ts` 增刪 locale keys
6. Tests — 對應 section test 檔
7. `CLAUDE.md` — settings 分區表 + 陷阱
8. `src/shared/known-env-vars.ts` — 增刪改 env var entries
9. i18n — 增刪 `settings.env.knownVars.*` + `settings.env.category.*` keys
10. Cleanup — dead imports / locale keys / tests

## Hard checklist

- 新增 key：schema 陣列正確位置 + type + render path + save/delete/toggle regression test
- docs 有 default：補 key hint / default hint
- 刪除 key：移除 first-party support，不清使用者 settings 檔
- object shape 不明：放 AdvancedSection，保守 type
- 不新開 section
- hook 變更：確認 HookCommand type union + hook event types 對齊

## Verification

1. 受影響 section tests
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

## Output contract

最終回報必列：新增 key、刪除 key、修改 key、excluded keys（with category）、hook 覆蓋狀態、受影響 section、驗證結果、official source discovery 結果（是否找到官方 schema URL、docs-only keys）
