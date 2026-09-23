# Sources

## Primary（官方 docs，確定性 CLI 解析）

- Settings inventory：`https://code.claude.com/docs/en/settings-reference.md` 的索引表（curl 取 Markdown；`parseSettingsDocs` 以表頭 `Key | Description | Topic | Scope` 定位，不認標題文字，解析同頁 linked key、description、topic、scope）
- Settings meta：同頁各 `` ### `key` `` 條目的 `* **Default**:` bullet（`parseSettingsEntries`，跳過 code block）
- Settings background：`https://code.claude.com/docs/en/settings.md` 僅提供 overview/precedence 背景，不作 key inventory
- Env vars：`https://code.claude.com/docs/en/env-vars.md`（curl 取 Markdown，`parseEnvDocs` 解析 env var 名稱）
- 偵測入口：`scripts/settings-sync-diff.ts`（curl live docs → parse → diff against repo schema → 輸出 JSON）
- 輸出：`{ settingsGaps, removedKeys, envGaps, envRemoved, defaultDrift, storageDrift, scopeDrift, deprecatedSurfaced, enumDrift, counts, health }`
- `settingsGaps`：docs 有、repo 無，已扣 Scope=`Managed` 與 docs 標 Deprecated／Removed 的 key（每筆帶索引表的 description、topic、scope）
- `defaultDrift` / `storageDrift` / `scopeDrift`：兩邊都有的 key，default（僅 non-object flat field）、存放檔（全部 flat field）或生效 scope（含 object 子設定，對 schema `effectiveScopes`）不一致（判讀見 SKILL.md Step 2；`repoDefaultDocsUnset` 的已核實等效清單是 `settings-meta-drift.ts` 的 `KNOWN_DEFAULT_EQUIVALENT`，以 docs Default 原文為鍵，docs 改寫即重新浮出）
- `deprecatedSurfaced`：repo 仍有、docs 條目開頭 Warning 標 Deprecated／Removed in 的 key；`enumDrift`：repo 字串欄位與 docs `**Type**` 固定值不一致（`mismatch`／`repoNotEnum`／`unparsed`；open type 只回報缺漏的 preset，判讀見 SKILL.md Step 2）
- `envGaps`：docs 有、registry 無（每筆帶 docs description）
- `removedKeys`：repo 有、docs 無（flat-field 粒度比對，見下）
- `envRemoved`：`known-env-vars.ts` 有、docs 無，已扣掉 `KNOWN_ENV_REPO_ONLY`（SSOT 在 `settings-diff.ts`；docs 在別頁或僅 prose 提及的 var）

## Schemastore（交叉檢查 fixture）

- URL：`https://json.schemastore.org/claude-code-settings.json`
- 用途：測試 fixture（`src/shared/settings-sync/__tests__/fixtures/schemastore.json`），非每次同步 curl
- 不作為 presence-diff 的 primary source；社群維護、落後官方 docs

## Compare 目標（repo 內部）

- `src/shared/claude-settings-schema.ts` — schema 單一來源，含 section 陣列（即 UI 渲染順序）
- `src/shared/settings-sync/settings-diff.ts` → `KNOWN_EXCLUDED`：`settingsGaps`/`envGaps` 方向的機器強制排除清單（權威 SSOT）
- `src/shared/settings-sync/settings-diff.ts` → `KNOWN_REPO_ONLY`：`removedKeys` 方向的機器強制排除清單（權威 SSOT，每條附驗證證據，僅收 orthogonal 個案）；`removed` diff 在 flat-field 粒度比對（`collectRepoFlatFieldKeys` — 只取非 object 頂層 flat field 的 bare/nestedUnder 形式；object-kind 欄位整類排除，不遞迴、也不留 bare key），結構性避免 container/leaf 誤報，不必逐欄位堆清單。代價：object-kind 欄位整個消失、或其巢狀 leaf 被 docs 移除，`removedKeys` 皆不偵測
- `src/shared/known-env-vars.ts` → `KNOWN_ENV_VARS`：env var registry 單一來源，`envGaps`/`envRemoved` 據此比對
- `src/shared/settings-sync/settings-diff.ts` → `KNOWN_ENV_REPO_ONLY`：`envRemoved` 方向的機器強制排除清單（權威 SSOT，附記各 var 實際被記在哪頁）
- `src/webview/editor/settings/` 現有 section 實作
- `src/shared/claude-settings-types.generated.ts` 由 schema 自動重生，禁手改、不列為來源

## Fail-fast

- CLI exit 1（條件見 SKILL.md Source of truth）→ workflow throw，不 fallback

## Rules

- type/enum/default 以 docs 該 key 條目的 `**Type**` / `**Default**` bullet 為準（JSON 範例值不是預設值）；schema 缺 shape 時保守同步、不腦補 enterprise/private fields
- 同步進 repo schema 時，secondary（既有 section 實作）只補 literal enum、default、object shape
- 刪除 key：移除 repo first-party support、tests、locale、CLAUDE.md 說明
- 刪除 key：不修改使用者既有 settings 檔；unknown key 容忍保持
- `removedKeys`/`envRemoved` 出現的都是排除白名單未收的新案例，每筆先回 docs 原文核實（改名/棄用/併入 prose 說明/文件遺漏皆可能），非 CLI 一出結果就直接刪；核實出「docs 只是換地方記」→ 補白名單，確認真的棄用才提報使用者確認
- docs 與 repo 衝突：回報列衝突點
- 新 key 無 type 資訊時預設 `String`，object shape 保守處理
