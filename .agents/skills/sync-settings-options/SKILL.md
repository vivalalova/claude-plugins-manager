---
name: sync-settings-options
description: Claude settings docs 變更同步；更新 type、UI、i18n、tests、CLAUDE.md
---

# sync-settings-options

同步 Claude settings docs 變更到 repo 實作。

## Trigger

- `sync settings from docs`
- `update settings options`
- `Claude settings docs changed`

## Source of truth

- primary: `https://code.claude.com/docs/en/settings`
- secondary: schema、`src/shared/types.ts`、現有 section 實作；只補 literal type、default、shape
- docs 與 repo 衝突：以 docs 為準；輸出必列衝突點

## References

- canonical source / 刪除規則：`references/sources.md`
- key → section mapping：`references/surface-map.md`
- editor 選型：`references/editor-patterns.md`

## Workflow

1. diff docs vs repo；列 `新增 key`、`刪除 key`、`修改 key`
2. 決定受影響 section；無自然落點預設 `AdvancedSection`
3. 同步 type：`src/shared/types.ts`
4. 同步 UI：`src/webview/editor/settings/` 對應 section；必要時 `SettingsPage.tsx`
5. 同步 i18n：`src/webview/i18n/locales/en.ts`、`ja.ts`、`zh-TW.ts`
6. 同步 tests：對應 section tests、shared controls tests
7. 同步 docs：`CLAUDE.md` settings 分區、格式/陷阱
8. cleanup：dead imports、dead locale keys、dead helper、dead tests

## Hard checklist

- 新增 option：補 render path + save/delete/toggle regression
- docs 有 default：補 key hint / default hint 驗證
- 刪除 option：移除 first-party support；不要假設使用者 settings 檔未知 key 要被清檔
- object shape 不明：先同步 type + 最保守 UI；落 `AdvancedSection`
- 不新開 section；除非使用者明確要求

## Output contract

最終回報必列：

- `新增 key`
- `刪除 key`
- `修改 key`
- `受影響 section`
- `驗證命令`

## Verification

最少驗證鏈：

1. 受影響 settings tests
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`
