# Env Vars Source

## 特性

- Env vars **不在** JSON schema store（schema 只定義 `env: Record<string,string>`）
- 個別 env var 的 name/type/default/description 來自 Claude Code docs

## Source

- `context7` `/websites/code_claude` — query env vars 文件
- `claude-code-guide` agent — 補充 context7 未涵蓋的 env vars
- 官方文件：`https://code.claude.com/docs/en/env-vars`

## Registry

- 檔案：`src/shared/known-env-vars.ts`
- 結構：`KNOWN_ENV_VARS: Record<string, KnownEnvVar>`
- Helpers：`getKnownEnvVar()`、`getKnownEnvVarsByCategory()`、`getKnownEnvVarNames()`

## i18n

- Category labels：`settings.env.category.{model|auth|effort|timeout|feature|telemetry}`
- Per-var descriptions：`settings.env.knownVars.{VARNAME}.description`

## Rules

- 僅收錄 user-useful env vars（排除 SDK-internal、undocumented）
- Registry 是 best-effort hint，非 constraint（使用者可輸入任意 key）
- 過期 env var：移除 registry entry + i18n key，不影響使用者既有設定
