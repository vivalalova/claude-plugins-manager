# Surface Map

## Section mapping

- `env` → `EnvSection`
- `hooks`、`disableAllHooks` → `HooksSection`
- `permissions`、`additionalDirectories`、`enableAllProjectMcpServers`、`enabledMcpjsonServers`、`disabledMcpjsonServers` → `PermissionsSection`
- spinner、teammate、turn duration、progress bar、reduced motion → `DisplaySection`
- model、effort、language、availableModels、updates、memory、cleanup、git-related behavior、`defaultMode`（schema-driven，nestedUnder permissions） → `GeneralSection`
- anti-direction key（見下方）→ `AdvancedSection`
- 其餘 key / 未定義歸屬 → `AdvancedSection`

## Anti-direction 分類

使用者優化方向：**低成本、高效率、高精度**。Anti-direction key 是啟用後違反上述方向的選項，一律放 `AdvancedSection`，使用者日常不需查看。

### 判定準則

1. **Anti-cost**：啟用後顯著增加 token 消耗 / API 費用（如強制 extended thinking）
2. **Anti-efficiency**：增加不必要的操作摩擦或等待
3. **Anti-user**：主要受益方為平台/廠商而非使用者

### 目前 anti-direction keys

| Key | 原 Section | Anti 原因 |
|-----|-----------|-----------|
| `alwaysThinkingEnabled` | general → advanced | Anti-cost：強制 extended thinking，token 消耗倍增 |

## Excluded categories

Schema 中存在但**不納入** settings UI 的 key：

| Category | Keys | 原因 |
|----------|------|------|
| managed-only | `allowManagedHooksOnly`、`allowManagedPermissionRulesOnly`、`allowManagedMcpServersOnly`、`allowedChannelPlugins`、`channelsEnabled`、`forceRemoteSettingsRefresh`、`strictKnownMarketplaces`、`blockedMarketplaces`、`pluginTrustMessage` | 企業管理員專用，一般使用者無法設定 |
| plugin-internal | `enabledPlugins`、`extraKnownMarketplaces`、`skippedMarketplaces`、`skippedPlugins`、`pluginConfigs` | 由 extension plugin/marketplace UI 管理 |
| deprecated | `includeCoAuthoredBy` | 已被 `attribution` 取代 |
| meta | `$schema` | JSON schema 參照，非設定值 |

## Rules

- 新 key 無自然落點：放 `AdvancedSection`，不要再用 `hidden`
- 不新開 section
- 平行 render path 一起查；不能只補單一路徑
- settings key hint / default hint 規則跟現有 controls 對齊

## Repo surface

- type：`src/shared/types.ts`
- schema：`src/shared/claude-settings-schema.ts`
- schema（含渲染順序）：`src/shared/claude-settings-schema.ts`
- UI：`src/webview/editor/settings/`
- i18n：`src/webview/i18n/locales/en.ts`、`ja.ts`、`zh-TW.ts`
- tests：section tests、shared controls tests
- docs：`CLAUDE.md`
