# Changelog

## 0.2.1

- Active filter now uses the primary color for clearer enabled-state recognition
- Removed the MCP sidebar badge because the status count was not actionable

## 0.2.0

- Added unknown settings section, limited undefined keys to Advanced, and hid excluded keys like `$schema`, `enabledPlugins`, and `feedbackSurveyState`
- Registry Skill cards now support per-scope checkbox install/remove, with silent refresh after install, update, and delete
- Synced official env vars and settings options, including OTEL telemetry vars and sandbox `allowRead` / `allowManagedReadPathsOnly`
- Plugin page added orphaned plugin detection, multi-select filters for content type and source, and browsable npm/pip source links
- Restored the Skills sidebar entry and refined settings docs hints, reset behavior, and section layout

## 0.1.8

- Plugin install now auto-updates marketplace and retries when the source path is missing
- Reapplied hiding Skills and Settings entries from the sidebar
- Added `.claude/settings.json` to `.gitignore`

## 0.1.7

- Installed plugin and marketplace `.sh` files now get executable permissions automatically
- Added looping hook debug logs to `.gitignore`

## 0.1.6

- Synced Claude Code settings schema with 8 new settings keys and 3 new env vars
- Added `EXPERIMENTAL_AGENT_TEAMS`, `DISABLE_PROMPT_CACHING`, and `ENABLE_TELEMETRY` to env var support
- Reordered `defaultMode` options to match official docs
- Marketplace sources now show `author/repo` instead of the full GitHub URL
- Sidebar hides Skills and Settings entries

## 0.1.5

- Added automated `version:bump` release script and backfilled changelog history
- Merged marketplace management into the Plugin page and moved Add Marketplace into a dialog
- Added Skill detail markdown panel and an "install without enable" flow for external plugins
- Extended `settingsEnabledScopes` to cover external plugin enabled state and prevent same-scope concurrent toggle
- Expanded Env section UX with known env var autocomplete, grouped rendering, and better validation
- Consolidated shared page, settings editor, and utility infrastructure across the webview

## 0.1.4

- Preferences persistence refactor: migrate from preferences.json to VSCode globalState (PreferencesService)
- SkillService registry cache unified to globalStorageUri
- Translation settings migrated from webview localStorage to preferences persistence
- Support GitHub URL display for object-type marketplace sources
- Added MCP CRUD E2E, agents/ScopeBadge/PluginToolbar/settings editors/skill cards tests

## 0.1.3

### Skills Management (New)

- SkillService wrapping `npx skills` CLI + skills.sh registry parsing
- Installed list: scope-grouped collapsible sections, flat layout, agent brand-color tags
- Online search (npx skills find), Registry leaderboard (All Time / Trending / Hot)
- Skill Detail panel displaying full SKILL.md content
- Check Updates / Update All, add with agent selection (--agent)
- Registry 4-hour file cache + client-side instant search
- ScopePicker using position fixed + createPortal to avoid overflow clipping
- FileWatcher monitoring skills directory changes

### Settings Page (New)

- Schema-driven settings rendering: SchemaFieldRenderer auto-renders by controlType
- Settings Schema (claude-settings-schema.ts): single source of truth metadata with controlType/options/min/max/step
- FIELD_ORDER centralized render ordering (check:schema auto-validates completeness)
- General / Display / Advanced / Permissions / Env / Hooks — six sections
- Scope override indicator + reset to schema default button
- Hook command AI explanation (Claude CLI powered + cached) + file path quick-open
- Sandbox structured sub-editor + JSON dual mode
- Attribution (commit/PR authorship), statusLine object editor
- spinnerVerbs / spinnerTipsOverride custom editors
- `npm run check:schema` validates schema ↔ interface ↔ FIELD_ORDER ↔ i18n consistency

### Info Page

- ExtensionInfoService collecting extension version, CLI path/version, config file path existence
- InfoPage full UI + revealPath / clearCache actions

### Quality Improvements

- Project-wide security audit: XSS defense, shell token parsing, concurrent write serialization, scope precedence fix
- TranslationService retry + exponential backoff
- MCP polling only when page is visible; per-server test connection
- MarketplacePage virtual list
- PluginPage split into sub-components (Dialogs / Toolbar / Sections)
- styles.css modularized into styles/ directory
- Cache directory migrated from ~/.claude/plugins/.cache/ to VSCode globalStorage

## 0.1.2

- Adjusted hidden item opacity and styling
- Removed item hover background effect
- Adjusted local badge colors

## 0.1.1

- Versioning infrastructure: added publish script
- Fixed install:ext path wildcard

## 0.1.0

- Marketplace management: add/remove/update sources, toggle auto-update
- Plugin management: search, per-scope enable/disable, expandable cards with contents preview
- MCP Server management: view status, add/remove with scope support
- Description translation via MyMemory API
- File watcher for live config sync
