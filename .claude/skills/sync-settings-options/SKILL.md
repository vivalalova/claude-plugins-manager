---
name: sync-settings-options
description: 同步 Claude settings docs 變更到 repo（type/UI/i18n/tests/docs）
model: opus
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, Skill
---

# sync-settings-options

同步 Claude settings docs 變更到 repo。4-phase automated pipeline。

## Trigger

- `sync settings from docs`
- `update settings options`
- `Claude settings docs changed`

## Source of truth

- primary: `context7` cross-doc query（`/websites/code_claude`）
- structured: JSON schema store（machine-readable type/enum/default）
- targeted: `agent-browser` — 僅 context7 回傳的特定 URL，conditional
- fallback: `context7` `/anthropics/claude-code`
- secondary: `src/shared/types.ts`、現有 section 實作；只補 literal type、default、shape
- 衝突優先序：docs > schema > repo；輸出必列衝突點

## References

- canonical source / 刪除規則：`references/sources.md`
- key → section mapping：`references/surface-map.md`
- editor 選型：`references/editor-patterns.md`

## Phase 1: Fetch Docs（multi-source）

### 1a. context7 cross-doc query（primary）

- resolve library id：`/websites/code_claude`
- 依 settings 類別分批 query（≤5 批）：
  - general settings（model、language、output、memory）
  - hooks（types、events、matchers）
  - permissions（allow/deny/ask、additionalDirectories）
  - display/UI（spinner、terminal、teammate、statusLine）
  - advanced（auth、sandbox、MCP、fileSuggestion、modelOverrides）
- 收集所有 snippet 中的 key、type、default、description

### 1b. JSON schema 補充（structured）

- 查 JSON schema store 取 machine-readable type/enum/default
- 補充 1a 中型別不明確的欄位

### 1c. agent-browser targeted（conditional）

- 僅當 1a 回傳特定 URL 且資訊不完整時開啟該 URL
- 不主動開啟；上限 2 個 URL

### 1d. context7 fallback（整體 fallback）

- 1a+1b+1c 完成後，資料仍不足時啟動
- 改 query `/anthropics/claude-code`，結構化為完整 key list

## Phase 2: Parallel Research（Codex + Gemini + Explore）

單一 message 啟動 3 個 Agent（並行）：

| Agent | subagent_type | 任務 |
|-------|--------------|------|
| Codex | `codex` | 讀 `src/shared/types.ts` ClaudeSettings，比對 Phase 1 docs keys，輸出 JSON diff |
| Gemini | `gemini` | 同上，獨立產出 JSON diff |
| Explore | `Explore` | 掃描 section 元件 + i18n，確認每個 key 的當前 UI/locale 實作狀態 |

Diff 格式：`{ added: [{key, type, default, description}], removed: [{key}], changed: [{key, field, docs, repo}] }`

交叉驗證：雙方同意 = high confidence；僅一方 = medium，標記人工審查

## Phase 3: Gap Report + 確認

輸出結構化 gap 表：

```
| Key | Status | Section | Confidence | Details |
```

`AskUserQuestion` 讓用戶確認/修改 section assignment；無 gap 則報告同步完成並結束

## Phase 4: Apply Changes

依序執行（參照 `references/` 決策）：

1. `src/shared/types.ts` — 增刪改 ClaudeSettings 欄位
2. Section 元件 — 依 `references/surface-map.md` 分配，依 `references/editor-patterns.md` 選 control
3. i18n — `en.ts`、`ja.ts`、`zh-TW.ts` 增刪 locale keys
4. Tests — 對應 section test 檔
5. `CLAUDE.md` — settings 分區表 + 陷阱
6. Cleanup — dead imports / locale keys / tests

## Hard checklist

- 新增 key：render path + save/delete/toggle regression test
- docs 有 default：補 key hint / default hint
- 刪除 key：移除 first-party support，不清使用者 settings 檔
- object shape 不明：放 AdvancedSection，保守 type
- 不新開 section

## Verification

1. 受影響 section tests
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

## Output contract

最終回報必列：新增 key、刪除 key、修改 key、受影響 section、驗證結果
