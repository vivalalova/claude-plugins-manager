# Surface Map

## Section mapping

- `env` → `EnvSection`
- `hooks`、`disableAllHooks` → `HooksSection`
- `permissions`、`defaultMode`、`additionalDirectories`、`enabledMcpjsonServers`、`disabledMcpjsonServers` → `PermissionsSection`
- spinner、teammate、turn duration、progress bar、reduced motion → `DisplaySection`
- model、effort、language、availableModels、updates、memory、cleanup、git-related behavior → `GeneralSection`
- 其餘 key → `AdvancedSection`

## Rules

- 新 key 無自然落點：放 `AdvancedSection`
- 不新開 section
- 平行 render path 一起查；不能只補單一路徑
- settings key hint / default hint 規則跟現有 controls 對齊

## Repo surface

- type：`src/shared/types.ts`
- UI：`src/webview/editor/settings/`
- i18n：`src/webview/i18n/locales/en.ts`、`ja.ts`、`zh-TW.ts`
- tests：section tests、shared controls tests
- docs：`CLAUDE.md`
