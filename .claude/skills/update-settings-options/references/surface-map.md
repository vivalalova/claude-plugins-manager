# Surface Map

## Section mapping

- `env` → `EnvSection`
- `hooks`、`disableAllHooks`、`httpHookAllowedEnvVars`、`allowedHttpHookUrls` → `HooksSection`
- `permissions`、`additionalDirectories`、`enableAllProjectMcpServers`、`enabledMcpjsonServers`、`disabledMcpjsonServers`、`allowedMcpServers`、`deniedMcpServers`、`disableAutoMode`、`skipDangerousModePermissionPrompt`、`useAutoModeDuringPlan` → `PermissionsSection`
- model / effort / agent / language / availableModels / memory / git behavior / IDE connect / updates / cleanup / `defaultMode`（schema-driven，nestedUnder permissions）→ `GeneralSection`
- view / spinner / progress / notifications / input / editor / teammate → `DisplaySection`
- anti-direction key（見下方）→ `AdvancedSection`
- 其餘 key / 未定義歸屬 → `AdvancedSection`

## Section 內主題群組（陣列順序 = UI 渲染順序）

`general`、`display`、`advanced` 走 `SchemaSection`，**schema 陣列順序直接決定 UI 順序**，且依主題分群（schema 內有 `// 群組名` 註解）。新 key 要插進**對應群組**，不要塞到陣列尾端。

- **general**：Model & reasoning → Permission mode → Language → Memory → Git → IDE integration → Updates & maintenance
- **display**：Rendering & view → Transcript info → Spinner & progress → Notifications → Input & editor → Agent teammates
- **advanced**：Authentication & login → Cloud provider auth & telemetry → Terminal customization → Git & attribution → Skills → Sessions & execution → Sandbox → Opt-outs & feature toggles → Enterprise & misc

`permissions`、`hooks`、`env` 是手寫/客製 render：UI 順序在各自的 `.tsx`，不由 schema 陣列驅動。

## Anti-direction 分類

使用者優化方向：**低成本、高效率、高精度**。Anti-direction key 是啟用後違反上述方向的選項，一律放 `AdvancedSection`（advanced 的 Opt-outs & feature toggles 群組），使用者日常不需查看。

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
| managed-only | `allowAllClaudeAiMcps`、`allowManagedHooksOnly`、`allowManagedMcpServersOnly`、`allowManagedPermissionRulesOnly`、`allowedChannelPlugins`、`blockedMarketplaces`、`channelsEnabled`、`claudeMd`、`forceRemoteSettingsRefresh`、`parentSettingsBehavior`、`pluginSuggestionMarketplaces`、`pluginTrustMessage`、`policyHelper`、`strictKnownMarketplaces`、`strictPluginOnlyCustomization`、`wslInheritsWindowsSettings`、`sandbox.bwrapPath`、`sandbox.socatPath`、`sandbox.filesystem.allowManagedReadPathsOnly`、`sandbox.network.allowManagedDomainsOnly` | 企業管理員專用，一般使用者無法設定 |
| plugin-internal | `enabledPlugins`、`extraKnownMarketplaces`、`skippedMarketplaces`、`skippedPlugins`、`pluginConfigs` | 由 extension plugin/marketplace UI 管理 |
| deprecated | `includeCoAuthoredBy` | 已被 `attribution` 取代 |
| meta | `$schema` | JSON schema 參照，非設定值 |

## Rules

- 新 key 無自然落點：放 `AdvancedSection` 的 Enterprise & misc 群組，不要用 `hidden`
- 不新開 section
- 平行 render path 一起查；不能只補單一路徑
- settings key hint / default hint 規則跟現有 controls 對齊
- 測試定位欄位用 label-scoped query（`getByRole('combobox', { name })` / `getByText(label).closest('.settings-field')`），**禁用 `getAllByRole(...)[n]` 位置索引**——section 內重排就會碎

## Repo surface

- schema 單一來源（含 section 陣列 = UI 渲染順序，依主題群組）：`src/shared/claude-settings-schema.ts`
- 由 schema 自動重生（禁手改）：`src/shared/claude-settings-types.generated.ts`
- UI：`src/webview/editor/settings/`
- i18n：`src/webview/i18n/locales/en.ts`、`ja.ts`、`zh-TW.ts`
- tests：section tests、shared controls tests
- docs：`CLAUDE.md`
