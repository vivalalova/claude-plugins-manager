---
name: update-settings-options
description: 同步 Claude settings docs 變更到 repo（type/UI/i18n/tests/docs）
model: opus
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Workflow, AskUserQuestion
---

# update-settings-options

讓 extension 的 settings surface（schema + 衍生 types + UI + i18n + tests + docs + env registry）跟上 **Claude Code 目前有哪些設定選項**——以官方 schema（schemastore，交叉比對官方 docs/CHANGELOG）為準。

## Trigger

- `sync settings from docs`
- `update settings options`
- `Claude settings docs changed`

## 形狀：workflow 探查 → 主迴圈套用

這個 skill 用一個 **workflow** 跑「探查」，再由主迴圈做「決策 + 套用 + 驗證」。分工不是半套，是兩個硬限制逼出來的：

1. **背景 workflow 不能 `AskUserQuestion`** — section 歸屬的確認必須回主迴圈做。
2. **本 repo 禁止 test/build 併發**（見 `CLAUDE.md`）— workflow 會 fan-out 平行 agent，若在裡面跑 typecheck/test/build 會違反「整台機器同時僅一個」。

所以：**workflow 擁有唯讀、可平行、無副作用的部分**（抓三來源 → deep diff → 逐 gap 分類 + repo-only 對抗式驗證），回傳結構化 gap report；**主迴圈擁有互動 + 寫檔 + 序列驗證的部分**。這正是 Workflow 工具文件背書的「scout with workflow, then act in main loop」。

## Source of truth

- **primary**：JSON schema store `https://json.schemastore.org/claude-code-settings.json`（社群維護、machine-readable）
- **official cross-check**：官方 docs `code.claude.com/docs/en/settings` + CHANGELOG（每次執行檢查 schema store 是否遺漏）
- **supplementary**：`context7` `/websites/code_claude`（補描述/context，≤3 queries）
- **secondary**：`src/shared/claude-settings-schema.ts` 與現有 section 實作；只補 literal enum / default / object shape
- **fail-fast**：schema store 抓取失敗 → 直接報錯結束，不 fallback
- **優先序**：official schema（若出現）> schema store > official docs > repo；輸出必列衝突點

細節見 `references/sources.md`。

## Key categories

Schema 含多種 key，只有 user-facing 需要進 settings UI。判定準則與完整 excluded 清單以 `references/surface-map.md` 為準。

| Category | 處理 |
|----------|------|
| user-facing | **同步**（按 surface-map 分 section） |
| anti-direction | **同步到 advanced**（啟用後違反低成本/高效率/高精度方向） |
| managed-only | skip（企業管理員專用） |
| plugin-internal | skip（plugin/marketplace UI 管理） |
| deprecated | skip（被其他 key 取代） |
| repo-only | **提報使用者確認**（repo 有、schema/docs/env/issues 皆無）；不擅自刪除 |
| docs-likely-gap | **保留**（repo 有、docs 無，但有 env var / issue / CHANGELOG 等 feature 證據；docs 漏寫） |
| meta | skip（`$schema` 等） |

## Step 1 — 跑探查 workflow

```
Workflow({ scriptPath: ".claude/skills/update-settings-options/references/scripts/sync-settings.workflow.js" })
```

腳本（`references/scripts/sync-settings.workflow.js`）三個 phase，全唯讀：

- **Fetch（平行）**：① curl + 解析 schemastore；② context7 讀官方 docs 表格 + WebSearch CHANGELOG + 找官方 schema URL；③ Explore agent 讀 repo schema/env/i18n。schemastore 失敗即 fail-fast。
- **Diff**：把三份結構化快照丟給一個 agent 做 deep diff——**禁止只比頂層 key 存在性**。涵蓋 top-level / scalar meta（default、enum 集合、number min/max/multipleOf）/ nested object / union（hookCommand、MCP server matcher）/ number-range missing / env / hook coverage，每筆標 depth。
- **Categorize（平行）**：逐 presence gap 分類；判為 `repo-only` 前先跑對抗式驗證（WebSearch ×2 + env var 配對）防 false-negative，有 feature 證據則降級為 `docs-likely-gap`。

回傳：`gaps`（含 category + suggestedSection + repo-only evidence）、`userFacing`、`repoOnly`、`docsLikelyGap`、`changed`（既有 key 的 meta drift，直接套用）、`envChanges`、`hookCoverage`、`conflicts`、`officialSchemaUrl`、`docsOnlyKeys`。

> 要改 workflow 邏輯：編輯該 `.js` 檔後重跑（可帶 `resumeFromRunId` 命中快取）；不要把腳本貼進對話。

## Step 2 — 確認或 early exit

- workflow 回報 `userFacing` 為空、無新 env var、無新 hook command type → 報告同步完成，**END**。
- `changed` 內若只是 repo-ahead 的 UI 約束（如 number `step`）或 repo 遵循「docs > schemastore」的 default，屬 note-only 不需動作；唯有 schema 真正改了 repo 該跟進的 default/enum 才套用。`hookCoverage.missingEventTypes` 應為空（event types 動態，不會 drift）——若非空代表 workflow 誤報，忽略。
- 有 user-facing gap 且 section 歸屬不明確 → `AskUserQuestion` 讓使用者確認。
- `repoOnly` 清單一律提報使用者；確認為誤加才由使用者授權刪除。

## Step 3 — 套用變更（主迴圈，依 `references/` 決策）

1. `src/shared/claude-settings-schema.ts` — 新 key 在目標 section 陣列加 entry（陣列位置 = UI 渲染順序，依 section 內主題群組擺放；沒落點放 `advanced`）；既有 key 改 `valueSchema`/`default`/`nestedUnder`/`dangerValues`；刪 key 從陣列移除。`claude-settings-types.generated.ts` 由 `npm run generate:settings-types` 自動重生（prebuild/prelint/pretest/pretypecheck 皆觸發），**禁手改**。
2. Section 元件 — 依 `references/surface-map.md` 分配；只有 `controlType: Object` 在對應 section 手寫渲染，其餘走 `SchemaFieldRenderer`；editor 選型見 `references/editor-patterns.md`。
3. i18n — `en.ts`、`ja.ts`、`zh-TW.ts` 增刪 locale keys。
4. Tests — 對應 section test；定位欄位用 label-scoped query（`getByRole('combobox', { name })` / `getByText(label).closest('.settings-field')`），**禁用位置索引**避免重排即碎。
5. `CLAUDE.md` — settings 分區表 + 陷阱。
6. `src/shared/known-env-vars.ts` + i18n `settings.env.knownVars.*` / `settings.env.category.*` — env var 增刪改（見 `references/env-vars-source.md`）。
7. Cleanup — dead imports / locale keys / tests。

## Hard checklist

- 新 key：schema 陣列正確位置 + type + render path + save/delete/toggle regression test
- docs 有 default：補 key hint / default hint
- 刪 key：移除 first-party support，**不清使用者既有 settings 檔**（unknown key 容忍保留）
- object shape 不明：放 advanced，保守 type
- **不新開 section**
- hook 變更：對齊 `HookCommand` type union（固定集合）；event types 走動態 `Object.keys`，不列舉、不會 drift
- **meta drift**：schema 有 default/enum/min/max/multipleOf 但 repo 缺 → 補；repo 有但 schema 沒 → 保留並於報告註記

## Verification（序列，禁併發）

1. 受影響 section tests（`npx vitest run <files>`，避開全套慢查）
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

## Output contract

最終回報必列：新增 key、刪除 key、修改 key、excluded keys（含 category）、repo-only keys（提使用者確認清單）、docs-likely-gap keys（含證據）、hook 覆蓋狀態、env var 變更、受影響 section、驗證結果、official source discovery 結果（是否找到官方 schema URL、docs-only keys）、衝突點。

## References

- canonical source / 刪除規則：`references/sources.md`
- key → section mapping + excluded 清單：`references/surface-map.md`
- editor 選型：`references/editor-patterns.md`
- env vars 來源：`references/env-vars-source.md`
- 探查 workflow：`references/scripts/sync-settings.workflow.js`
