# update-settings-options

Keep the extension's settings surface in sync with **which settings options Claude Code currently has** — sourced from the official [JSON Schema](https://json.schemastore.org/claude-code-settings.json), cross-checked against the official docs/CHANGELOG.

## How it works

A **workflow** runs the discovery (read-only, parallel); the main loop does the deciding, editing, and verifying. The split is forced by two constraints: a background workflow can't ask the user questions, and this repo forbids concurrent test/build (which parallel agents would break). So the workflow scouts, then the main loop acts.

1. **Discovery workflow** (`references/scripts/sync-settings.workflow.js`) — three read-only phases:
   - **Fetch** (parallel): schema store JSON · official docs/CHANGELOG + schema-URL discovery · repo schema/env/i18n
   - **Diff**: deep diff across top-level / scalar-meta / nested-object / union / number-range / env / hook dimensions
   - **Categorize** (parallel): classify each gap; adversarially verify before declaring a key `repo-only`
   - Returns a structured gap report.
2. **Confirm**: present the report; `AskUserQuestion` for ambiguous user-facing section assignments; list `repo-only` keys for the user.
3. **Apply + verify**: edit schema, sections, i18n (3 languages), env registry, tests, and `CLAUDE.md`; then typecheck → test → build **serially**.

## Files touched

| File | Purpose |
|------|---------|
| `src/shared/claude-settings-schema.ts` | Settings schema (single source: value shape, section, UI metadata) |
| `src/shared/known-env-vars.ts` | Environment variables registry |
| `src/webview/i18n/locales/{en,zh-TW,ja}.ts` | Translations |
| `src/webview/editor/settings/*Section.tsx` | Section components |
| `CLAUDE.md` | Settings section documentation |

`src/shared/claude-settings-types.generated.ts` (`ClaudeSettings` / `HookCommand`) is regenerated from the schema — never edited by hand.

## Usage

```
/update-settings-options
```

Or trigger with natural language: "sync settings from docs", "update settings options".

## Key categories

| Category | Action | Example keys |
|----------|--------|-------------|
| user-facing | Sync to UI | Most settings keys |
| anti-direction | Pin to advanced | `alwaysThinkingEnabled` |
| managed-only | Skip | `allowManagedHooksOnly`, `allowManagedPermissionRulesOnly` |
| plugin-internal | Skip | `enabledPlugins`, `extraKnownMarketplaces` |
| deprecated | Skip | `includeCoAuthoredBy` |
| repo-only | Report for user confirmation | (repo has it; schema/docs/env/issues don't) |
| docs-likely-gap | Keep (docs omission) | key with a matching env var or GitHub issue |
| meta | Skip | `$schema` |

## References

- [`references/scripts/sync-settings.workflow.js`](references/scripts/sync-settings.workflow.js) — the discovery workflow
- [`references/sources.md`](references/sources.md) - Canonical sources and deletion rules
- [`references/surface-map.md`](references/surface-map.md) - Key to section mapping
- [`references/editor-patterns.md`](references/editor-patterns.md) - Editor control selection guide
- [`references/env-vars-source.md`](references/env-vars-source.md) - Env vars documentation source
