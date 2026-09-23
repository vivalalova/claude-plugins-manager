---
name: update-settings-options
description: 同步 Claude settings docs 變更到 repo（type/UI/i18n/tests/docs）
model: opus
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Workflow, AskUserQuestion
---

# update-settings-options

讓 extension 的 settings surface（schema + 衍生 types + UI + i18n + tests + docs + env registry）跟上 **Claude Code 目前有哪些設定選項、預設值與存放檔**——以官方 `settings-reference.md` 為來源，由確定性 CLI 偵測 gap 與 meta drift。

## Trigger

- `sync settings from docs`
- `update settings options`
- `Claude settings docs changed`

## 形狀：workflow 探查 → 主迴圈套用

這個 skill 用一個 **workflow** 跑「探查」，再由主迴圈做「決策 + 套用 + 驗證」。分工不是半套，是兩個硬限制逼出來的：

1. **背景 workflow 不能 `AskUserQuestion`** — section 歸屬的確認必須回主迴圈做。
2. **test/build 不可併發**（同 repo 同時只跑一個）— workflow 會 fan-out 平行 agent，不能在裡面跑 typecheck/test/build。

所以：**workflow 擁有唯讀、可平行、無副作用的部分**（跑 CLI 取 gap → 逐 gap 分類），回傳結構化 gap report；**主迴圈擁有互動 + 寫檔 + 序列驗證的部分**。

## Source of truth

- **settings inventory**：官方 docs `https://code.claude.com/docs/en/settings-reference.md` 的索引表（表頭 `Key | Description | Topic | Scope`；parser 認表頭不認標題文字）
- **meta（default / 存放檔）**：同頁每個 `` ### `key` `` 條目的 `* **Default**:` bullet，與索引表 Scope 欄
- **background**：官方 docs `https://code.claude.com/docs/en/settings.md` 僅作 overview/precedence 背景，不作 settings inventory
- **env vars**：官方 docs `code.claude.com/docs/en/env-vars.md`（同上）
- **偵測 CLI**：`scripts/settings-sync-diff.ts`（curl live docs → parse → diff against repo schema → 輸出 JSON）。exit 1 = fetch error、health failure（含索引表找不到）或半數以上 key 解析不到 Default，workflow 即中止並回報；此時先修 parser（`settings-diff.ts` / `settings-meta-drift.ts`）並補重現該版面的測試，再重跑。
- **fail-fast**：CLI exit 1 → workflow throw，不 fallback

細節見 `references/sources.md`。

## Key categories

Schema 含多種 key，只有 user-facing 需要進 settings UI。判定準則與完整 excluded 清單以 `references/surface-map.md` 為準；機器強制排除清單（SSOT）在 `src/shared/settings-sync/settings-diff.ts` 的 `KNOWN_EXCLUDED`。

| Category | 處理 |
|----------|------|
| user-facing | **同步**（按 surface-map 分 section） |
| anti-direction | **同步到現有 `AdvancedSection`**（啟用後違反低成本/高效率/高精度方向） |
| managed-only | 索引 Scope=`Managed` 由 CLI 自動排除；Scope 沒標但實質 managed-only 的 → 加入 `KNOWN_EXCLUDED` |
| plugin-internal | skip → 加入 `KNOWN_EXCLUDED` |
| deprecated | skip → 加入 `KNOWN_EXCLUDED` |
| meta | skip → 加入 `KNOWN_EXCLUDED` |

## Step 1 — 跑探查 workflow

```
Workflow({ scriptPath: ".claude/skills/update-settings-options/references/scripts/sync-settings.workflow.js" })
```

腳本（`references/scripts/sync-settings.workflow.js`）兩個 phase，全唯讀：

- **Detect**：一個 agent 跑 Bash `npx tsx scripts/settings-sync-diff.ts`（cwd repo root），拿回 JSON `{ settingsGaps, removedKeys, envGaps, envRemoved, defaultDrift, storageDrift, scopeDrift, deprecatedSurfaced, enumDrift, counts, health }`，全是 CLI 的確定性結果：
  - `settingsGaps`：docs 有、repo 無，已扣 `KNOWN_EXCLUDED`、Scope=`Managed` 與 docs 標 Deprecated／Removed 的 key；每筆帶 key、description、topic、scope
  - `removedKeys`：repo 有、docs 無，已扣 `KNOWN_REPO_ONLY`
  - `envGaps` / `envRemoved`：同上兩方向比對 `known-env-vars.ts`，`envRemoved` 已扣 `KNOWN_ENV_REPO_ONLY`；`envGaps` 帶 docs description
  - `defaultDrift`：兩邊都有的 key，schema `default` 與 docs `**Default**` 不符。`kind` 四種：`mismatch`（docs 給了明確值、repo 不同或沒給）、`repoDefaultDocsUnset`（docs 說 unset、repo 有給值，已扣 `KNOWN_DEFAULT_EQUIVALENT`）、`conditional`（docs 寫「`A`, or `B` when …」、repo 有給值）、`unparsed`（docs 文字既非 unset 也非開頭的 JSON literal）
  - `storageDrift`：索引 Scope=`Global config`（存 `~/.claude.json`）與 schema `storageFile: 'globalConfig'` 不一致
  - `scopeDrift`：索引 Scope（`User or managed`／`User, local, or managed`／`Any file`）與 schema `effectiveScopes` 不一致，含 object 子設定（dotted path，子層未登錄即繼承父層）。`kind`：`mismatch`／`unrecognized`（Scope 文字不在 `settings-meta-drift.ts` 的 `DOCS_SCOPE_TO_EFFECTIVE`；`Managed`／`Global config` 認得但不比對）
  - `deprecatedSurfaced`：repo 仍有、docs 條目開頭 `<Warning>` 標 Deprecated／Removed in 的 key（含 object 子設定）。`kind`：`deprecated`／`removed`，`docs` 為 Warning 原文
  - `enumDrift`：repo 字串欄位與 docs `**Type**` 列出的固定值不一致（含 object 子設定）。`kind`：`mismatch`（`docsOnly`／`repoOnly` 列差集）、`repoNotEnum`（docs 列固定值、repo 為自由輸入字串）、`unparsed`（repo 是 enum，docs Type 解析不出固定值）。open type（docs 列 preset 外另收自由格式）：repo 自由字串不算漂移，只回報缺漏的 preset
- **Categorize（平行）**：對每個 `settingsGap` 把 description、topic、scope inline 餵給分類 agent，指派 section、判斷 `isObjectEditor`、標記 non-user-facing。其餘欄位原樣傳回，不走 LLM——判斷交回主迴圈。

回傳：`categorized`、`userFacing`、`nonUserFacing`、`removedKeys`、`envGaps`、`envRemoved`、`defaultDrift`、`storageDrift`、`scopeDrift`、`deprecatedSurfaced`、`enumDrift`、`counts`。

> 要改 workflow 邏輯：編輯該 `.js` 檔後重跑；前次 workflow run 的 `runId` 可帶入 `Workflow({ resumeFromRunId })` 命中快取，跳過已完成的 phase。不要把腳本貼進對話。

## Step 2 — 確認或 early exit

- `userFacing`、`nonUserFacing`、`removedKeys`、`envGaps`、`envRemoved`、`defaultDrift`、`storageDrift`、`scopeDrift`、`deprecatedSurfaced` 全空，且 `enumDrift` 全空或每筆都已有未關閉的票追蹤 → 報告同步完成（列出追蹤中的票號）並 **END**。
- `nonUserFacing` 清單非空 → 提報使用者（僅供知悉，不 apply），確認後把各 key 加進 `KNOWN_EXCLUDED`；`userFacing` 若同時非空，兩份清單一起回報，apply 只對 `userFacing` 跑。
- `removedKeys` 非空 → 提報使用者（repo schema 仍支援、但官方 docs 已不再列出的 key，可能是改名/棄用/文件遺漏——逐 key 回 docs 原文核實原因），**禁自動刪**；使用者確認要刪的 key 才走「Hard checklist」的刪 key 流程（含 UI/i18n/schema 移除，不清使用者既有 settings 檔）。
- `envGaps` 非空 → 提報使用者（附各 var 的 docs description），確認後把各筆加進 `src/shared/known-env-vars.ts`。
- `envRemoved` 非空 → 白名單未收的新案例（`known-env-vars.ts` 仍登記、但官方 docs 已不再列出的 var）。逐項回 docs 原文核實：若只是改名/併入其他變數的 prose 說明，補進 `KNOWN_ENV_REPO_ONLY` 而非刪 registry；確認真的棄用才提報使用者，確認後移除該 registry entry 及對應 i18n key。
- `defaultDrift` 非空 → 逐筆讀 docs 該 key 條目後修正，不必逐筆問使用者（docs 就是答案）。為何要緊：UI 在「選到的值 = schema default」且沒有任何生效中的上層 scope 設了此 key（user scope 必然成立）時才刪 key，schema default 若不等於 Claude Code 未設定時的實際行為，該值就**永遠寫不進去**、畫面也顯示錯的狀態。
  - `mismatch` → schema `default` 改成 docs 的值
  - `conditional` → 移除 schema `default`（預設值依平台／方案而變，固定任一值都會讓部分使用者選不到它）
  - `repoDefaultDocsUnset` → docs 有寫出未設定時的等效行為（如「unset, so X is off」）且等於 repo 值 → 把 key 與**docs Default 原文**加進 `settings-meta-drift.ts` 的 `KNOWN_DEFAULT_EQUIVALENT`；docs 只寫 `unset` 或行為取決於帳號／組織／模型 → 移除 schema `default`（例外：空 record／空 array 的 default 等同 unset，登錄即可）
  - `unparsed` → 讀原文判斷後，擴充 `parseDocsDefault` 認得這種寫法並補測試（修 schema 無法讓它消失）
  - 只認 `**Default**` bullet；條目內的 JSON 範例值不是預設值
- `storageDrift` 非空 → 依索引表 Scope 修 `storageFile`：`Global config` 加 `'globalConfig'`，其餘拿掉（寫入 settings.json）。
- `scopeDrift` 非空 → 修 schema 的 `effectiveScopes`：
  - `mismatch` → 依索引表 Scope 登錄：`User or managed`＝`USER_SCOPE_ONLY`、`User, local, or managed`＝`USER_AND_LOCAL_SCOPES`、`Any file`＝拿掉登錄
  - object 子設定 → 登錄在 `optional(schema, { effectiveScopes })`，未登錄即繼承父層
  - 有 `nestedUnder` 的 dotted key（如 `autoMode.classifyAllShell`、`permissions.*`）→ 登錄在該扁平欄位的 meta，不登在 object 子屬性上
  - `unrecognized` → 回 docs 讀 Scope 定義，擴充 `DOCS_SCOPE_TO_EFFECTIVE` 並補測試
- `deprecatedSurfaced` 非空 → 走「Hard checklist」的刪 key 流程移除 UI／i18n／schema，並把 key 加進 `KNOWN_EXCLUDED` 的 deprecated 群組（附簡短原因）；不清使用者既有 settings 檔。
- `enumDrift` 非空：
  - `mismatch` → 依 docs Type 更新 schema enum 選項與對應 i18n
  - `repoNotEnum` → 讀原文判斷是否改成 enum
  - `unparsed` → 讀原文判斷後，擴充 `parseSettingsEntries` 的 Type 解析並補測試
- `userFacing` 非空且 section 歸屬不明確 → `AskUserQuestion` 讓使用者確認。

## Step 3 — apply（主迴圈）

**Apply 是主迴圈步驟，不放進背景 workflow。** 依 CLAUDE.md 規定，互動 gate / 審查 / 不可逆動作留互動主流程。

對每個 `userFacing` gap，依其 `isObjectEditor` 走對應路徑：

### scalar（isObjectEditor=false）

用 `/build` TDD 流程：

1. `src/shared/claude-settings-schema.ts` — 在目標 section 陣列的對應主題群組加 field（`booleanField` / `stringField` / `createField`）。
2. `npm run generate:settings-types` 重生 `claude-settings-types.generated.ts`（禁手改）。
3. i18n — `en.ts`、`ja.ts`、`zh-TW.ts` 各加 `settings.<section>.<key>.label` / `.description`（enum 另加每個選項值 key）。
4. 測試先紅後綠（save / delete / toggle + 設定頁 render 出該 key 控制項）。
5. scalar 不需寫 render code — `SchemaFieldRenderer` 依 schema 自動渲染。

### object editor（isObjectEditor=true）

1. schema 加 field（`createField` + `controlTypeOverride: Object`）。
2. **必須**在 `src/webview/editor/settings/components/ObjectFieldEditor.tsx` dispatcher 加 `case '<key>'`，否則掉進 `console.warn + return null` silent 路徑。
3. 實作對應 editor 元件或沿用 `TextSetting`（JSON textarea）——視複雜度。
4. i18n 三語 + 測試（render 非 null + save/delete）。

### PermissionsSection 與手寫 render

三條 render path 見 `references/surface-map.md`（render path 節）。`permissions`/`hooks`/`env` key 走全手寫 render，不走 `SchemaFieldRenderer`。

### 完成關卡

1. `npm run verify` 全綠（含 check:schema Phase 4 i18n-completeness + generate --check）。
2. 重跑 `npx tsx scripts/settings-sync-diff.ts` 確認 `settingsGaps`、`defaultDrift`、`storageDrift`、`scopeDrift`、`deprecatedSurfaced` 歸 0；`enumDrift` 歸 0，或剩下每筆都已有未關閉的票追蹤（最終回報列出票號）。

## 能力邊界

- **scalar 高度自動化**：schema field + i18n + 自動渲染，均可一次到位。
- **object editor 半自動**：schema 可自動，dispatcher case + editor 元件需人工；workflow 會標記 `isObjectEditor=true` 提醒。
- **key 新增/移除可偵測**：`settingsGaps`（docs 有 repo 無）與 `removedKeys`（repo 有 docs 無，flat-field 粒度比對，已扣 `KNOWN_REPO_ONLY`）、`envGaps`/`envRemoved`（同方向比對 `known-env-vars.ts`，`envRemoved` 已扣 `KNOWN_ENV_REPO_ONLY`）皆由 CLI 確定性偵測。
- **`removedKeys` 僅涵蓋 non-object top-level 欄位**：object-kind 欄位（如 `sandbox`、`permissions`）整個從 docs 消失、或其巢狀 leaf 被 docs 移除，皆不會被 `removedKeys` 偵測到；新增方向（`settingsGaps`）則涵蓋巢狀 leaf。
- **default / 存放檔漂移可偵測**：`defaultDrift` 涵蓋 non-object flat field，`storageDrift` 涵蓋全部 flat field。
- **生效 scope 漂移可偵測**：`scopeDrift` 涵蓋全部 flat field 與 object 子設定；設定頁在不生效的 scope 隱藏該控制項（JSON 模式不過濾）。
- **棄用與 enum 選項漂移可偵測**：`deprecatedSurfaced` 讀條目開頭的 Warning；`enumDrift` 解析 `**Type**` 的固定字串值（含樣板值 `<…>` 者略過），涵蓋 flat key 與有自己 `` ### `parent.child` `` 條目的 object 子設定；選項只寫在父層 Type 句的子設定（如 `spellcheck.checker`、`sandbox.credentials.sigv4`）不偵測。type／range（數值範圍、非字串型別）漂移仍不偵測。

## Hard checklist

- 新 key：先確認索引表的 Topic/Scope；Global config key 存 `~/.claude.json`，schema field 必標 `storageFile: 'globalConfig'`（判定細節見 `references/surface-map.md`）
- 新 key：索引表 Scope 為 `User or managed`／`User, local, or managed` → schema field（或 object 子設定）必登錄 `effectiveScopes`
- 手寫 render 的控制項須走共用可見性判定並補非 user scope 的 render 測試（見 `references/surface-map.md` 三條 render path）
- 新 key：schema 陣列正確位置 + type + render path + save/delete/toggle regression test
- default 只抄該 key 條目的 `**Default**` bullet；寫 unset 且沒說等效行為 → 不給 `default`
- 刪 key：移除 first-party support，**不清使用者既有 settings 檔**（unknown key 容忍保留）
- object shape 不明：放 advanced，保守 type
- **不新開 section**
- hook 變更：對齊 `HookCommand` type union（固定集合）；event types 走動態 `Object.keys`，不列舉、不會 drift
- non-user-facing gap → 加 `KNOWN_EXCLUDED`，不默默忽略

## Verification（序列，禁併發）

1. 受影響 section tests（`npx vitest run <files>`，避開全套慢查）
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

## Output contract

最終回報必列：新增 key、刪除 key（來自 `removedKeys` 且經使用者確認者）、修正 default／存放檔／生效 scope／enum 選項的 key（來自 `defaultDrift`/`storageDrift`/`scopeDrift`/`enumDrift`，附修前修後）、移除的棄用 key（來自 `deprecatedSurfaced`）、留待票處理的 `enumDrift` 項目與票號、non-user-facing keys（已加 `KNOWN_EXCLUDED`）、env var 新增/移除、受影響 section、驗證結果、CLI 各 counts 最終數。

## References

- 刪除規則：`references/sources.md`
- key → section mapping + excluded 清單：`references/surface-map.md`
- editor 選型：`references/editor-patterns.md`
- env vars 來源：`references/env-vars-source.md`
- 探查 workflow：`references/scripts/sync-settings.workflow.js`
