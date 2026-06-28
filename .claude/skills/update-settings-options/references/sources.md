# Sources

## Primary（官方 docs，確定性 CLI 解析）

- Settings：`https://code.claude.com/docs/en/settings.md`（curl 取 Markdown，`parseSettingsDocs` 解析 key 清單）
- Env vars：`https://code.claude.com/docs/en/env-vars.md`（curl 取 Markdown，`parseEnvDocs` 解析 env var 名稱）
- 偵測入口：`scripts/settings-sync-diff.ts`（curl live docs → parse → diff against repo schema → 輸出 JSON）
- 輸出：`{ settingsGaps, envGaps, counts, health }`

## Schemastore（交叉檢查 fixture）

- URL：`https://json.schemastore.org/claude-code-settings.json`
- 用途：測試 fixture（`src/shared/settings-sync/__tests__/fixtures/schemastore.json`），非每次同步 curl
- 不作為 presence-diff 的 primary source；社群維護、落後官方 docs

## Compare 目標（repo 內部）

- `src/shared/claude-settings-schema.ts` — schema 單一來源，含 section 陣列（即 UI 渲染順序）
- `src/shared/settings-sync/settings-diff.ts` → `KNOWN_EXCLUDED`：機器強制排除清單（權威 SSOT）
- `src/webview/editor/settings/` 現有 section 實作
- `src/shared/claude-settings-types.generated.ts` 由 schema 自動重生，禁手改、不列為來源

## Fail-fast

- CLI exit 1（health failure 或 fetch error）→ workflow throw，不 fallback

## Rules

- type/enum/default 以 docs 描述為準；schema 缺 shape 時保守同步、不腦補 enterprise/private fields
- 同步進 repo schema 時，secondary（既有 section 實作）只補 literal enum、default、object shape
- 刪除 key：移除 repo first-party support、tests、locale、CLAUDE.md 說明
- 刪除 key：不修改使用者既有 settings 檔；unknown key 容忍保持
- docs 與 repo 衝突：回報列衝突點
- 新 key 無 type 資訊時預設 `String`，object shape 保守處理
