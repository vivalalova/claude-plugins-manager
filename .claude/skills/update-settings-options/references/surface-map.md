# Surface Map

## 儲存檔判定（section 歸屬前先做）

先從 `settings-reference.md` 的 All settings index 讀 key 的 Topic/Scope；**Global config key 存 `~/.claude.json` 而非 `settings.json`**——寫進 settings.json 會被 Claude Code 靜默忽略。這類 key 在 schema field 必須標 `storageFile: 'globalConfig'`（讀寫由 `SettingsFileService` 分流到 `~/.claude.json`，僅 user scope 顯示），漏標＝UI 開關 no-op silent bug。`settings.md` 僅供 overview/precedence 背景核對。

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

三條 render path：

- **scalar → `SchemaFieldRenderer`**：`general`/`display`/`advanced` 的 boolean/string/enum/number field，schema 驅動自動渲染。無需寫 render code。
- **object key → `ObjectFieldEditor` dispatcher**：`controlType === Object` 的 field，dispatcher 中需有對應 `case`。實作細節見 SKILL.md Step 3。
- **`PermissionsSection` 全手寫**：`permissions`/`hooks`/`env` 相關 key，renderer 在各自 section `.tsx`，不走 `SchemaFieldRenderer`。

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
| managed-only | `allowAllClaudeAiMcps`、`allowManagedHooksOnly`、`allowManagedMcpServersOnly`、`allowManagedPermissionRulesOnly`、`allowedChannelPlugins`、`blockedMarketplaces`、`channelsEnabled`、`claudeMd`、`forceRemoteSettingsRefresh`、`parentSettingsBehavior`、`pluginSuggestionMarketplaces`、`pluginTrustMessage`、`policyHelper`、`strictKnownMarketplaces`、`strictPluginOnlyCustomization`、`wslInheritsWindowsSettings`、`sandbox.bwrapPath`、`sandbox.socatPath`、`sandbox.filesystem.allowManagedReadPathsOnly`、`sandbox.network.allowManagedDomainsOnly`、`sandbox.enabledPlatforms`、`browserExternalPageTools`、`disableBrowserExternalNavigation`、`disableCommandPluginSources`、`disableDesktopLocalSessions`、`disableMobileSimulatorTools`、`disableSideloadFlags`、`managedSourcesBehavior`、`modelPricing`、`policyHelper.path`、`policyHelper.refreshIntervalMs`、`policyHelper.timeoutMs`、`sshHostAllowlist`、`strictPluginOnlyCustomization.agents`、`strictPluginOnlyCustomization.hooks`、`strictPluginOnlyCustomization.mcp`、`strictPluginOnlyCustomization.skills` | 企業管理員專用，一般使用者無法設定（`enabledPlatforms` 僅 honored from managed/policy settings；新增的 Scope=Managed 欄位同樣不做 first-party UI）|
| plugin-internal | `enabledPlugins`、`extraKnownMarketplaces`、`skippedMarketplaces`、`skippedPlugins`、`pluginConfigs` | 由 extension plugin/marketplace UI 管理 |
| deprecated | `includeCoAuthoredBy` | 已被 `attribution` 取代 |
| meta | `$schema` | JSON schema 參照，非設定值 |

上表為人讀文件，涵蓋 reference index 以 Scope 標示的 managed-only keys、plugin-internal、deprecated 與 meta keys。**機器強制排除的補充 SSOT** 在 `src/shared/settings-sync/settings-diff.ts` 的 `KNOWN_EXCLUDED`；legacy fixture parser 仍支援 description 中的 managed marker，但 reference index 的既有 managed-only key 必須明列於此清單。新發現的 non-user-facing gap（由 index scope/description 判斷）→ 加進 `KNOWN_EXCLUDED`；機器強制以 `KNOWN_EXCLUDED` 為準。

## Excluded from `removed` diff（反方向：repo 有、docs 無）

`removedKeys` 方向（repo schema 有支援、但 docs 未列出）的排除 SSOT 是同檔的 `KNOWN_REPO_ONLY`，比對粒度為 flat-schema-registration（見 `collectRepoFlatFieldKeys`：只取非 object 頂層 flat field 的 bare/nestedUnder 形式；object-kind 欄位整類排除，不遞迴、也不留 bare key——docs 是否給 object 欄位本身一個 overview row 不一致，逐欄位判斷會長成無止盡清單，故整類結構性排除，不逐一列舉）。

**機器強制排除清單（SSOT）在 code**：逐條內容與驗證證據看 `settings-diff.ts` 的 `KNOWN_REPO_ONLY`，此處不複寫。收錄型態為 `nestedUnder` 雙形式展開的副產物（docs 只列前綴或只列 bare 形式，另一形式即 repo-only）。

新發現的 `removed` 真 false positive → 先確認是否屬「object-kind 欄位」這類結構性成因（若是，調整 `collectRepoFlatFieldKeys` 的判斷邏輯，不加清單）；只有 orthogonal 的個別情況（如上述 nestedUnder 雙形式）才回 docs 原文核實後加進 `KNOWN_REPO_ONLY`（附驗證日期與依據）。禁堆排除清單掩蓋結構性誤報。

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
