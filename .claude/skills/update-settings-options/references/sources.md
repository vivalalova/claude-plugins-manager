# Sources

## Primary（JSON schema store）

- URL: `https://json.schemastore.org/claude-code-settings.json`（需 `curl -sL` follow redirect）
- machine-readable：完整 type/enum/default/description
- 單一 curl 取得所有 properties + hook defs
- 社群維護（非 Anthropic 官方 host）；[anthropics/claude-code#11795](https://github.com/anthropics/claude-code/issues/11795) 追蹤官方 schema URL
- 權威來源：type/enum/default 以 schema 為準

## Official source discovery（每次執行檢查）

Schema store 可能落後官方。每次同步時交叉比對：

1. **官方 docs**：`https://code.claude.com/docs/en/settings#available-settings` — 透過 context7 查 key 清單
2. **CHANGELOG**：`https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md` — WebSearch 找最近新增 settings
3. **官方 schema URL**：若 Anthropic 開始 host 自己的 schema（如 `code.claude.com/schema/settings.json`）→ 升級為 primary，schemastore 降為 fallback

docs 有但 schema store 無的 key → 標記 `docs-only`，納入 gap report，使用 docs description 作為唯一來源

## Supplementary（context7）

- library: `/websites/code_claude`
- 補充 schema 未涵蓋的描述/用途/context
- official source discovery 的 docs query 計入 quota
- **≤3 queries**（context7 API 限制）

## Fail-fast

- Schema store 失敗 → 直接報錯結束，不 fallback

## Secondary（repo 內部）

- `src/shared/claude-settings-schema.ts` — schema 單一來源，含 section 陣列（即 UI 渲染順序）
- `src/webview/editor/settings/` 現有 section 實作
- 只補 literal enum、default、object shape
- `src/shared/claude-settings-types.generated.ts` 由 schema 自動重生，禁手改、不列為 secondary source

## 優先序

official schema（如有）> schema store > official docs > repo

## Rules

- schema store > docs > repo（official schema 出現前）
- secondary 只補 literal enum、default、object shape
- schema 缺 shape：保守同步；不腦補 enterprise/private fields
- 刪除 key：移除 repo first-party support、tests、locale、CLAUDE.md 說明
- 刪除 key：不修改使用者既有 settings 檔；unknown key 容忍保持
- schema 與 repo 衝突：回報列 `衝突點`
- docs-only key：無 type 資訊時預設 `String`，object shape 保守處理
