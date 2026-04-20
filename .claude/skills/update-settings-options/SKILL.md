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
- **secondary**: `src/shared/claude-settings-schema.ts`、現有 section 實作；只補 literal enum、default、shape
- 衝突優先序：official schema（如有）> schema store > official docs > repo；輸出必列衝突點

## Key categories

Schema 包含多種 key，僅 `user-facing` 需同步到 settings UI。完整 key 清單以 `references/surface-map.md` 為準（避免雙處同步漂移）。

| Category | 處理 |
|----------|------|
| user-facing | **同步**（按 surface-map 分 section） |
| anti-direction | **同步到 AdvancedSection**（啟用後違反低成本/高效率/高精度方向；判定準則見 `references/surface-map.md`） |
| managed-only | skip（企業管理員專用） |
| plugin-internal | skip（由 plugin/marketplace UI 管理） |
| deprecated | skip（被其他 key 取代） |
| repo-only | **提報給使用者確認**（repo 有但 schema / official docs 皆無）；不擅自刪除 |
| meta | skip（`$schema` 等 JSON schema 參照） |

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
3. **False-negative 防衛**：對每個「docs 查無」的 key 再跑**精準字串搜**一次，至少 2 種來源：
   - `WebSearch "<key>" site:code.claude.com` + `WebSearch "\"<key>\":" site:github.com/anthropics/claude-code`
   - 配對 env var（`known-env-vars.ts` 中 `CLAUDE_CODE_*` / `*_<KEY_UPPER>`）、GitHub issue `"<key>"` 提及
   - 兩處以上出現 → 視為 docs gap（feature 存在 docs 漏寫），不歸 `repo-only`
4. **比對**：官方 docs 出現但 schema store 沒有的 key → 標記 `docs-only`，納入 gap report
5. **優先序更新**：若找到 Anthropic 官方 hosted schema URL → 升級為 primary，schemastore 降為 fallback

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

- `src/shared/claude-settings-schema.ts` — schema 單一來源；value shape 用 `valueSchema`（kind + enum/min/max/item/...），section 陣列順序即 UI 渲染順序，`controlType` 由 `valueSchema` 自動推導，只有 mixed union 或刻意走 custom editor 才加 `controlTypeOverride`；沒自然落點的 user-facing key 直接放 `advanced`，不加 `hidden`
- `src/shared/known-env-vars.ts` — `KNOWN_ENV_VARS` registry（`valueType` 用原生型別）
- `src/webview/i18n/locales/en.ts` — i18n key 完整性

NOTE: `src/shared/claude-settings-types.generated.ts`（ClaudeSettings / HookCommand 來源）由 `npm run generate:settings-types` 從上面 schema 重生，禁止手改、不列 scan target。

深度比對（**禁止只比對頂層 key 存在性**，這會漏掉 drift）：
1. **頂層 key** — schema store properties vs repo schema 陣列
2. **Scalar meta** — 每個 key 的 `default` / enum options（集合比，順序可不同）/ number `minimum|maximum|multipleOf` → repo `min/max/step`
3. **Nested object properties** — 遞迴比對 `permissions` / `sandbox.{filesystem,network}` / `attribution` / `spinnerVerbs` / `spinnerTipsOverride` / `statusLine` / `fileSuggestion` / `autoMode` / `worktree`：properties 集合 + required/optional 旗標 + 子屬性 shape
4. **Union types** — `$defs.hookCommand.anyOf` 每個 variant 的 required/optional properties、`allowedMcpServers` / `deniedMcpServers` items anyOf 的 discriminant 與 shape
5. **Number range missing** — schema 有 minimum/maximum 但 repo `numberValue()` 沒 min/max 要補（例：port 欄位應補 1–65535）

產出 diff：`{ added: [{key, type, default, source}], removed: [{key}], changed: [{key, field, schema, repo, depth}] }`，`depth` = top-level / nested / union / meta

## Phase 3: Gap Report + 確認

### 3a. Key 分類

每個 diff key 標記 category（參照上方 Key categories 表）。`user-facing` 與 `anti-direction` 進入 Phase 4。`repo-only` 列表提給使用者確認（不擅自刪除）。

Anti-direction 判定：新 key 先評估是否符合 `references/surface-map.md` 的 anti-direction 準則（anti-cost / anti-efficiency / anti-user）。符合 → 標記 `anti-direction`，固定放 `AdvancedSection`。

Repo-only 判定分兩階：
- **docs-likely-gap**：repo schema 有、官方 docs 無，但具備以下任一 feature 證據 → 視為 docs 漏寫，保留、標 `docs-likely-gap`
  - `known-env-vars.ts` 有對應 env var（例：`autoConnectIde` ↔ `CLAUDE_CODE_AUTO_CONNECT_IDE`）
  - GitHub issues 有以精準字串 `"<key>"` 提及 settings 使用方式
  - CHANGELOG 曾提及
- **repo-only**：以上證據都無 → `repo-only`，在 gap 表標記、要求使用者確認；若確認為誤加 → 由使用者授權刪除

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

Source 欄位：
- `schema` — schema store 有
- `docs-only` — 官方 docs 有但 schema store 無
- `both` — 兩者皆有
- `docs-likely-gap` — repo 有、docs 無，但有 env var 或 GitHub issue 等 feature 證據（保留，docs 漏寫）
- `repo-only` — repo 有、schema store / docs / env var / issues 皆無（提使用者確認）

### 3e. 確認或 early exit

- 有 user-facing gap：`AskUserQuestion` 讓用戶確認 section assignment
- **無 user-facing gap → 報告同步完成，END**（skip Phase 4）

## Phase 4: Apply Changes

依序執行（參照 `references/` 決策）：

1. `src/shared/claude-settings-schema.ts` — 新 key：在目標 section 陣列加 entry（陣列位置 = UI 渲染順序；沒自然落點放 `advanced`）；既有 key：改 valueSchema / default / nestedUnder / dangerValues；刪 key：從陣列移除。`src/shared/claude-settings-types.generated.ts` 由 `npm run generate:settings-types` 自動同步（prebuild/prelint/pretest/pretypecheck 皆會觸發），禁止手改。
2. Section 元件 — 依 `references/surface-map.md` 分配；只有 `controlType: Object` 的欄位需要在對應 section 手動渲染，其餘走 `SchemaFieldRenderer`；editor 選型依 `references/editor-patterns.md`
3. i18n — `en.ts`、`ja.ts`、`zh-TW.ts` 增刪 locale keys
4. Tests — 對應 section test 檔
5. `CLAUDE.md` — settings 分區表 + 陷阱
6. `src/shared/known-env-vars.ts` — 增刪改 env var entries
7. i18n — 增刪 `settings.env.knownVars.*` + `settings.env.category.*` keys
8. Cleanup — dead imports / locale keys / tests

## Hard checklist

- 新增 key：schema 陣列正確位置 + type + render path + save/delete/toggle regression test
- docs 有 default：補 key hint / default hint
- 刪除 key：移除 first-party support，不清使用者 settings 檔
- object shape 不明：放 AdvancedSection，保守 type
- 不新開 section
- hook 變更：確認 HookCommand type union + hook event types 對齊
- **meta drift**：schema 有 default / enum / min / max / multipleOf 但 repo 缺 → 補齊；repo 有但 schema 沒 → 保留（UI constraint）並於報告註記

## Verification

1. 受影響 section tests
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

## Output contract

最終回報必列：新增 key、刪除 key、修改 key、excluded keys（with category）、repo-only keys（提使用者確認清單）、hook 覆蓋狀態、受影響 section、驗證結果、official source discovery 結果（是否找到官方 schema URL、docs-only keys）
