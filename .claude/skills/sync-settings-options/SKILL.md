---
name: sync-settings-options
description: 同步 Claude settings docs 變更到 repo（type/UI/i18n/tests/docs）
model: opus
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, Skill
---

# sync-settings-options

同步 Claude settings docs 變更到 repo。4-phase automated pipeline。

## Trigger

- `sync settings from docs`
- `update settings options`
- `Claude settings docs changed`

## Source of truth

- **primary**: JSON schema store `https://json.schemastore.org/claude-code-settings.json`（machine-readable，完整 type/enum/default/description）
- **supplementary**: `context7` `/websites/code_claude`（補充 schema 未涵蓋的描述/context，≤3 queries）
- **fail-fast**: schema store 失敗 → 直接報錯結束，不 fallback
- **secondary**: `src/shared/types.ts`、現有 section 實作；只補 literal type、default、shape
- 衝突優先序：schema store > docs > repo；輸出必列衝突點

## Key categories

Schema 包含多種 key，僅 `user-facing` 需同步到 settings UI：

| Category | 處理 | Keys |
|----------|------|------|
| user-facing | **同步** | 所有非下列類別的 key |
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

- `curl -s https://json.schemastore.org/claude-code-settings.json`
- 解析所有 `properties.*`：key、type、enum、default、description
- 解析 `$defs.hookCommand.anyOf[*]`：hook command types
- 解析 `properties.hooks.properties.*`：hook event types

### 1b. context7 supplementary（≤3 queries）

- resolve library id：`/websites/code_claude`
- 補充 schema 未涵蓋的 description/context（如新 key 的用途說明）
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
- `src/shared/claude-settings-schema.ts` — schema definitions（controlType/options/default）
- `src/shared/field-orders.ts` — FIELD_ORDER arrays + EXCLUDED_FROM_FIELD_ORDER
- `src/shared/known-env-vars.ts` — KNOWN_ENV_VARS registry entries
- `src/webview/i18n/locales/en.ts` — i18n key 完整性

產出 diff：`{ added: [{key, type, default}], removed: [{key}], changed: [{key, field, schema, repo}] }`

## Phase 3: Gap Report + 確認

### 3a. Key 分類

每個 diff key 標記 category（參照上方 Key categories 表）。僅 `user-facing` 進入 Phase 4。

### 3b. Hook 覆蓋檢查

- hook event types：比對 schema `hooks.properties.*` vs repo HooksSection 支援（動態 `Object.keys()` 則自動相容）
- hook command types：比對 schema `$defs.hookCommand` vs repo `HookCommand` type union

### 3c. Env vars registry gap

- 比對 Phase 1c env vars docs vs `KNOWN_ENV_VARS` registry
- 新增/移除/變更 env vars 列入 gap 表

### 3d. Gap 表

```
| Key | Status | Category | Section | Details |
```

### 3d. 確認或 early exit

- 有 user-facing gap：`AskUserQuestion` 讓用戶確認 section assignment
- **無 user-facing gap → 報告同步完成，END**（skip Phase 4）

## Phase 4: Apply Changes

依序執行（參照 `references/` 決策）：

1. `src/shared/types.ts` — 增刪改 ClaudeSettings 欄位
2. `src/shared/claude-settings-schema.ts` — 增刪改 schema entry
3. `src/shared/field-orders.ts` — 更新 FIELD_ORDER / EXCLUDED_FROM_FIELD_ORDER
4. Section 元件 — 依 `references/surface-map.md` 分配，依 `references/editor-patterns.md` 選 control
5. i18n — `en.ts`、`ja.ts`、`zh-TW.ts` 增刪 locale keys
6. Tests — 對應 section test 檔
7. `CLAUDE.md` — settings 分區表 + 陷阱
8. `src/shared/known-env-vars.ts` — 增刪改 env var entries
9. i18n — 增刪 `settings.env.knownVars.*` + `settings.env.category.*` keys
10. Cleanup — dead imports / locale keys / tests

## Hard checklist

- 新增 key：schema + type + field-order + render path + save/delete/toggle regression test
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

最終回報必列：新增 key、刪除 key、修改 key、excluded keys（with category）、hook 覆蓋狀態、受影響 section、驗證結果
