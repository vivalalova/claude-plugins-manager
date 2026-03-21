# Changelog

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
