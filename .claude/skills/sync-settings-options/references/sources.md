# Sources

## Primary（JSON schema store）

- URL: `https://json.schemastore.org/claude-code-settings.json`
- machine-readable：完整 type/enum/default/description
- 單一 curl 取得所有 properties + hook defs
- 權威來源：type/enum/default 以 schema 為準

## Supplementary（context7）

- library: `/websites/code_claude`
- 補充 schema 未涵蓋的描述/用途/context
- **≤3 queries**（context7 API 限制）

## Fail-fast

- Schema store 失敗 → 直接報錯結束，不 fallback

## Secondary（repo 內部）

- `src/shared/types.ts`
- `src/shared/claude-settings-schema.json`（canonical schema data）
- `src/shared/claude-settings-schema.ts`（wrapper：types + helpers）
- `src/shared/field-orders.ts`
- `src/webview/editor/settings/` 現有 section 實作
- 只補 literal enum、default、object shape

## Rules

- schema store > docs > repo
- secondary 只補 literal enum、default、object shape
- schema 缺 shape：保守同步；不腦補 enterprise/private fields
- 刪除 key：移除 repo first-party support、tests、locale、CLAUDE.md 說明
- 刪除 key：不修改使用者既有 settings 檔；unknown key 容忍保持
- schema 與 repo 衝突：回報列 `衝突點`
