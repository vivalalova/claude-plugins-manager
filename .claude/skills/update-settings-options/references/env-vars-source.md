# Env Vars Source

## 特性

- Env vars **不在** settings schema（schema 只定義 `env: Record<string,string>`）
- 個別 env var 的 name/type/default/description 來自官方 docs

## Source

- 官方文件：`https://code.claude.com/docs/en/env-vars.md`（`scripts/settings-sync-diff.ts` 直接 curl + `parseEnvDocs` 解析，含每筆 description）

## Registry

- 檔案：`src/shared/known-env-vars.ts`
- 結構：`KNOWN_ENV_VARS: Record<string, KnownEnvVar>`
- Helpers：`getKnownEnvVar()`、`getKnownEnvVarsByCategory()`、`getKnownEnvVarNames()`

## Diff（`diffEnvVars`，`src/shared/settings-sync/settings-diff.ts`）

- `envGaps`：docs 有、`getKnownEnvVarNames()` 無 — 候選新增到 registry
- `envRemoved`：`getKnownEnvVarNames()` 有、docs 無，已扣掉 `KNOWN_ENV_REPO_ONLY`（SSOT 在 `settings-diff.ts`：docs 記在別頁或僅 prose 提及的已知常態）— 剩下的是白名單未收的新案例，逐筆回 docs 原文核實後才是候選移除（可能又是併入其他變數的 prose 說明，該補進白名單而非刪 registry）
- 兩者皆確定性偵測，無 user-useful 判斷；哪些該同步進 registry 由使用者確認（見 SKILL.md Step 2）

## i18n

- Per-var descriptions：`settings.env.knownVars.{VARNAME}.description`

## Rules

- 僅收錄 user-useful env vars（排除 SDK-internal、undocumented）——`envGaps` 是否收錄仍需人工 triage，CLI 不判斷 user-useful
- Registry 是 best-effort hint，非 constraint（使用者可輸入任意 key）
- 過期 env var（`envRemoved` 核實後）：移除 registry entry + i18n key，不影響使用者既有設定
