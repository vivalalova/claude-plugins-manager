# update-settings-options

Keep the extension's settings surface in sync with **which settings Claude Code currently has** — sourced from the official docs `code.claude.com/docs/en/settings.md`, detected by a deterministic CLI.

## How it works

A **workflow** runs discovery (read-only); the main loop decides, edits, and verifies. See `SKILL.md` for the full flow.

1. **Detect**: run `scripts/settings-sync-diff.ts` (curl live docs → parse → diff against repo schema → JSON output)
2. **Categorize** (parallel): classify each gap by section + isObjectEditor
3. **Apply** (main loop): add schema field + i18n (3 languages) + tests; `SchemaFieldRenderer` auto-renders scalars; object editor keys need a dispatcher case in `ObjectFieldEditor.tsx`

## Files touched

| File | Purpose |
|------|---------|
| `src/shared/claude-settings-schema.ts` | Settings schema (single source: value shape, section, UI metadata) |
| `src/shared/settings-sync/settings-diff.ts` | Gap detection logic + `KNOWN_EXCLUDED` |
| `src/shared/known-env-vars.ts` | Environment variables registry |
| `src/webview/i18n/locales/{en,zh-TW,ja}.ts` | Translations |
| `src/webview/editor/settings/*Section.tsx` | Section components |
| `CLAUDE.md` | Settings section documentation |

`src/shared/claude-settings-types.generated.ts` is regenerated from the schema — never edited by hand.

## Usage

```
/update-settings-options
```

Or trigger with natural language: "sync settings from docs", "update settings options".

## Key categories

| Category | Action |
|----------|--------|
| user-facing | Sync to UI |
| anti-direction | Sync to existing `AdvancedSection` |
| managed-only / plugin-internal / deprecated / meta | Skip → add to `KNOWN_EXCLUDED` |

## References

- [`SKILL.md`](SKILL.md) — full end-to-end flow (detect → categorize → apply)
- [`references/scripts/sync-settings.workflow.js`](references/scripts/sync-settings.workflow.js) — discovery workflow
- [`references/sources.md`](references/sources.md) — canonical sources and deletion rules
- [`references/surface-map.md`](references/surface-map.md) — key to section mapping
- [`references/editor-patterns.md`](references/editor-patterns.md) — editor control selection
- [`references/env-vars-source.md`](references/env-vars-source.md) — env vars source
