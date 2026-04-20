# update-settings-options

Automatically sync Claude Code settings UI with the official [JSON Schema](https://json.schemastore.org/claude-code-settings.json).

## What it does

This skill reads the Claude Code settings JSON Schema and applies changes to the extension codebase through a 4-phase pipeline:

1. **Fetch Schema** - Downloads schema from [json.schemastore.org](https://json.schemastore.org/claude-code-settings.json), supplements with context7 docs, syncs env vars registry
2. **Repo Scan** - Compares schema against current types, schema definitions, i18n keys, and env vars in the repo
3. **Gap Report** - Categorizes diffs (user-facing / managed-only / plugin-internal / deprecated), presents confirmation
4. **Apply Changes** - Updates types, schema, i18n (3 languages), section components, tests, and CLAUDE.md

## Files touched

| File | Purpose |
|------|---------|
| `src/shared/types.ts` | `ClaudeSettings` interface |
| `src/shared/claude-settings-schema.ts` | Schema metadata (controlType, options, defaults) |
| `src/shared/known-env-vars.ts` | Environment variables registry |
| `src/webview/i18n/locales/{en,zh-TW,ja}.ts` | Translations |
| `src/webview/editor/settings/*Section.tsx` | Section components |
| `CLAUDE.md` | Settings section documentation |

## Usage

Invoke via Claude Code:

```
/update-settings-options
```

Or trigger with natural language: "sync settings from docs", "update settings options"

## Key categories

| Category | Action | Example keys |
|----------|--------|-------------|
| user-facing | Sync to UI | Most settings keys |
| anti-direction | Pin to AdvancedSection | `alwaysThinkingEnabled` |
| managed-only | Skip | `allowManagedHooksOnly`, `allowManagedPermissionRulesOnly` |
| plugin-internal | Skip | `enabledPlugins`, `extraKnownMarketplaces` |
| deprecated | Skip | `includeCoAuthoredBy` |
| repo-only | Report for user confirmation | `agent`, `autoConnectIde` |
| meta | Skip | `$schema` |

## References

- [`references/sources.md`](references/sources.md) - Canonical sources and deletion rules
- [`references/surface-map.md`](references/surface-map.md) - Key to section mapping
- [`references/editor-patterns.md`](references/editor-patterns.md) - Editor control selection guide
- [`references/env-vars-source.md`](references/env-vars-source.md) - Env vars documentation source
