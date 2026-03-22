# Surface Map

## Section mapping

- `env` → `EnvSection`
- `hooks`、`disableAllHooks` → `HooksSection`
- `permissions`、`defaultMode`、`additionalDirectories`、`enabledMcpjsonServers`、`disabledMcpjsonServers` → `PermissionsSection`
- spinner、teammate、turn duration、progress bar、reduced motion → `DisplaySection`
- model、effort、language、availableModels、updates、memory、cleanup、git-related behavior → `GeneralSection`
- 其餘 key → `AdvancedSection`

## Excluded categories

Schema 中存在但**不納入** settings UI 的 key：

| Category | Keys | 原因 |
|----------|------|------|
| managed-only | `allowManagedHooksOnly`、`allowManagedPermissionRulesOnly`、`allowManagedMcpServersOnly`、`strictKnownMarketplaces`、`blockedMarketplaces`、`pluginTrustMessage` | 企業管理員專用，一般使用者無法設定 |
| plugin-internal | `enabledPlugins`、`extraKnownMarketplaces`、`skippedMarketplaces`、`skippedPlugins`、`pluginConfigs` | 由 extension plugin/marketplace UI 管理 |
| deprecated | `includeCoAuthoredBy` | 已被 `attribution` 取代 |
| meta | `$schema` | JSON schema 參照，非設定值 |

## Rules

- 新 key 無自然落點：放 `AdvancedSection`
- 不新開 section
- 平行 render path 一起查；不能只補單一路徑
- settings key hint / default hint 規則跟現有 controls 對齊

## Repo surface

- type：`src/shared/types.ts`
- schema data：`src/shared/claude-settings-schema.json`
- schema wrapper：`src/shared/claude-settings-schema.ts`（types + helpers）
- field-orders：`src/shared/field-orders.ts`
- UI：`src/webview/editor/settings/`
- i18n：`src/webview/i18n/locales/en.ts`、`ja.ts`、`zh-TW.ts`
- tests：section tests、shared controls tests
- docs：`CLAUDE.md`
