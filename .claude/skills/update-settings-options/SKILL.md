---
name: update-settings-options
description: 同步 Claude settings docs 變更到 repo（type/UI/i18n/tests/docs）
model: opus
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Workflow, AskUserQuestion
---

# update-settings-options

讓 extension 的 settings surface（schema + 衍生 types + UI + i18n + tests + docs + env registry）跟上 **Claude Code 目前有哪些設定選項**——以官方 docs `code.claude.com/docs/en/settings.md` 為準，由確定性 CLI 偵測 gap。

## Trigger

- `sync settings from docs`
- `update settings options`
- `Claude settings docs changed`

## 形狀：workflow 探查 → 主迴圈套用

這個 skill 用一個 **workflow** 跑「探查」，再由主迴圈做「決策 + 套用 + 驗證」。分工不是半套，是兩個硬限制逼出來的：

1. **背景 workflow 不能 `AskUserQuestion`** — section 歸屬的確認必須回主迴圈做。
2. **本 repo 禁止 test/build 併發**（見 `CLAUDE.md`）— workflow 會 fan-out 平行 agent，若在裡面跑 typecheck/test/build 會違反「整台機器同時僅一個」。

所以：**workflow 擁有唯讀、可平行、無副作用的部分**（跑 CLI 取 gap → 逐 gap 分類），回傳結構化 gap report；**主迴圈擁有互動 + 寫檔 + 序列驗證的部分**。

## Source of truth

- **primary**：官方 docs `code.claude.com/docs/en/settings.md`（直接 curl 取 Markdown，確定性 parse）
- **env vars**：官方 docs `code.claude.com/docs/en/env-vars.md`（同上）
- **偵測 CLI**：`scripts/settings-sync-diff.ts`（curl live docs → parse → diff against repo schema → 輸出 JSON）。exit 1 = health failure 或 fetch error，workflow 即報錯。
- **fail-fast**：CLI exit 1 → workflow throw，不 fallback

細節見 `references/sources.md`。

## Key categories

Schema 含多種 key，只有 user-facing 需要進 settings UI。判定準則與完整 excluded 清單以 `references/surface-map.md` 為準；機器強制排除清單（SSOT）在 `src/shared/settings-sync/settings-diff.ts` 的 `KNOWN_EXCLUDED`。

| Category | 處理 |
|----------|------|
| user-facing | **同步**（按 surface-map 分 section） |
| anti-direction | **同步到現有 `AdvancedSection`**（啟用後違反低成本/高效率/高精度方向） |
| managed-only | skip → 加入 `KNOWN_EXCLUDED` |
| plugin-internal | skip → 加入 `KNOWN_EXCLUDED` |
| deprecated | skip → 加入 `KNOWN_EXCLUDED` |
| meta | skip → 加入 `KNOWN_EXCLUDED` |

## Step 1 — 跑探查 workflow

```
Workflow({ scriptPath: ".claude/skills/update-settings-options/references/scripts/sync-settings.workflow.js" })
```

腳本（`references/scripts/sync-settings.workflow.js`）兩個 phase，全唯讀：

- **Detect**：一個 agent 跑 Bash `npx tsx scripts/settings-sync-diff.ts`（cwd repo root），拿回 JSON `{ settingsGaps, envGaps, counts, health }`。presence-diff 是該 CLI 的確定性結果，已扣掉 `KNOWN_EXCLUDED`。CLI exit 1 → 報錯。
- **Categorize（平行）**：對每個 `settingsGap`（string key）指派 section（用 surfaceMapHint）、判斷是否 `isObjectEditor`（需手寫 object editor）、標記 non-user-facing key 需加入 `KNOWN_EXCLUDED`。`envGaps` 原樣傳回，不走 LLM。

回傳：`categorized`（含 category + suggestedSection + isObjectEditor）、`userFacing`、`nonUserFacing`（需加 `KNOWN_EXCLUDED`）、`envGaps`、`counts`。

> 要改 workflow 邏輯：編輯該 `.js` 檔後重跑；前次 workflow run 的 `runId` 可帶入 `Workflow({ resumeFromRunId })` 命中快取，跳過已完成的 phase。不要把腳本貼進對話。

## Step 2 — 確認或 early exit

- `userFacing`、`nonUserFacing`、`envGaps` 三者皆空 → 報告同步完成並 **END**。
- `nonUserFacing` 清單非空 → 提報使用者（僅供知悉，不 apply），確認後把各 key 加進 `KNOWN_EXCLUDED`；`userFacing` 若同時非空，兩份清單一起回報，apply 只對 `userFacing` 跑。
- `envGaps` 非空 → 提報使用者，確認後更新 `src/shared/known-env-vars.ts`（注：CLI 目前 envGaps 固定為 `[]`，此分支留作未來 env gap detection 就緒後使用）。
- `userFacing` 非空且 section 歸屬不明確 → `AskUserQuestion` 讓使用者確認。

## Step 3 — apply（主迴圈）

**Apply 是主迴圈步驟，不放進背景 workflow。** 依 CLAUDE.md 規定，互動 gate / 審查 / 不可逆動作留互動主流程。

對每個 `userFacing` gap，依其 `isObjectEditor` 走對應路徑：

### scalar（isObjectEditor=false）

用 `/build` TDD 流程：

1. `src/shared/claude-settings-schema.ts` — 在目標 section 陣列的對應主題群組加 field（`booleanField` / `stringField` / `createField`）。
2. `npm run generate:settings-types` 重生 `claude-settings-types.generated.ts`（禁手改）。
3. i18n — `en.ts`、`ja.ts`、`zh-TW.ts` 各加 `settings.<section>.<key>.label` / `.description`（enum 另加每個選項值 key）。
4. 測試先紅後綠（save / delete / toggle + 設定頁 render 出該 key 控件）。
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
2. 重跑 `npx tsx scripts/settings-sync-diff.ts` 確認 `settingsGaps` 歸 0。

## 能力邊界

- **scalar 高度自動化**：schema field + i18n + 自動渲染，均可一次到位。
- **object editor 半自動**：schema 可自動，dispatcher case + editor 元件需人工；workflow 會標記 `isObjectEditor=true` 提醒。
- **meta drift（default/enum/range 漂移）**：現行 CLI 僅偵測 presence gap（docs 有 repo 無），不偵測既有 key 的 default/enum/range 變動。如需偵測 meta drift，需另行對照 schemastore 或 docs 手查。

## Hard checklist

- 新 key：schema 陣列正確位置 + type + render path + save/delete/toggle regression test
- docs 有 default：補 key hint / default hint
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

最終回報必列：新增 key、刪除 key、修改 key、non-user-facing keys（已加 `KNOWN_EXCLUDED`）、env var 變更、受影響 section、驗證結果、`settingsGaps` 最終數。

## References

- 刪除規則：`references/sources.md`
- key → section mapping + excluded 清單：`references/surface-map.md`
- editor 選型：`references/editor-patterns.md`
- env vars 來源：`references/env-vars-source.md`
- 探查 workflow：`references/scripts/sync-settings.workflow.js`
