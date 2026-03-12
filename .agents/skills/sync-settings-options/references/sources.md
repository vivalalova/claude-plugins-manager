# Sources

## Canonical

- official docs：`https://code.claude.com/docs/en/settings`

## Secondary

- schema / docs examples
- `src/shared/types.ts`
- `src/webview/editor/settings/` 現有 section 實作

## Rules

- docs > repo
- secondary 只補 literal enum、default、object shape
- docs 缺 shape：保守同步；不要腦補 enterprise/private fields
- 刪除 key：移除 repo first-party support、tests、locale、CLAUDE.md 說明
- 刪除 key：不要修改使用者既有 settings 檔內容；unknown key 容忍保持
- 發現 docs 與現況衝突：在回報列 `衝突點`
