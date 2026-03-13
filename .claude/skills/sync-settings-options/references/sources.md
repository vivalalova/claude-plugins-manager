# Sources

## Primary（context7 cross-doc）

- library: `/websites/code_claude`（所有已索引 docs 頁面）
- 分批 query settings 類別，≤5 批次（token 效率）
- 無需預知 URL；新頁面自動被 context7 索引

## Structured（schema）

- JSON schema store — machine-readable type/enum/default
- 補充 context7 snippet 中型別不明確的欄位

## Targeted（agent-browser，conditional，對應 SKILL.md 1c）

- 僅 context7 回傳特定 URL 且資訊不完整時開啟
- 不主動爬取；上限 2 個 URL

## Fallback（context7 alternate，1a+1b+1c 後仍不足）

- `context7` `/anthropics/claude-code`

## Secondary（repo 內部）

- `src/shared/types.ts`
- `src/webview/editor/settings/` 現有 section 實作
- 只補 literal enum、default、object shape

## Rules

- docs > schema > repo
- secondary 只補 literal enum、default、object shape
- docs 缺 shape：保守同步；不腦補 enterprise/private fields
- 刪除 key：移除 repo first-party support、tests、locale、CLAUDE.md 說明
- 刪除 key：不修改使用者既有 settings 檔；unknown key 容忍保持
- docs 與現況衝突：回報列 `衝突點`
- context7 query 不超過 5 批次（token 效率）
