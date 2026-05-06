# Changelog

## 0.2.6

- fix: [hooks] 解釋功能能讀取 interpreter 包腳本的 hook 檔
- docs: 整理 0.2.5 changelog 為使用者導向描述

## 0.2.5

- Synced Claude Code settings schema with new keys (`advisorModel`, `tui`, `prUrlTemplate`, `channelsEnabled`, `autoMode`, `defaultShell`, `auto` permission mode), `effortLevel` `xhigh`/`max`, sandbox `ripgrep` / `deniedDomains` / `allowMachLookup`, `statusLine.refreshInterval`, and the `mcp_tool` hook variant
- Expanded known env vars autocomplete from 116 to 222 entries based on official docs (Bedrock/Vertex/Foundry providers, mTLS auth, OAuth tokens, OTEL telemetry, plugin/MCP knobs) with localized descriptions in EN/JA/ZH-TW
- Fixed a silent bug where toggling Disable Auto Mode wrote to the wrong settings path and was ignored by Claude Code CLI
- Settings page now renders purely from schema with corrected input widths and section grouping

## 0.2.4

- Fixed dependency vulnerabilities and added XSS protection with DOMPurify sanitization

## 0.2.3

- Added search functionality to Settings page

## 0.2.2

- Added automatic cleanup for removed marketplace plugins and stale installed-plugin records
- Added one-click cleanup for unused cache directories from the Plugin page
- Added "Reinstall All" for marketplaces, plus progress dialog and plugins data warning
- Simplified the Plugin page action bar
- Add Marketplace dialog now explains that private repos can use SSH URLs directly

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

## 0.1.7

- Installed plugin and marketplace `.sh` files now get executable permissions automatically

## 0.1.6

- Synced Claude Code settings schema with 8 new settings keys and 3 new env vars
- Added `EXPERIMENTAL_AGENT_TEAMS`, `DISABLE_PROMPT_CACHING`, and `ENABLE_TELEMETRY` to env var support
- Reordered `defaultMode` options to match official docs
- Marketplace sources now show `author/repo` instead of the full GitHub URL
- Sidebar hides Skills and Settings entries

## 0.1.5

- Merged marketplace management into the Plugin page and moved Add Marketplace into a dialog
- Added Skill detail markdown panel and an "install without enable" flow for external plugins
- Expanded Env section UX with known env var autocomplete, grouped rendering, and better validation

## 0.1.4

- Support GitHub URL display for object-type marketplace sources

## 0.1.3

### Skills Management

- Installed skills list with scope-grouped collapsible sections and agent brand-color tags
- Online search and Registry leaderboard (All Time / Trending / Hot)
- Skill detail panel displaying full SKILL.md content
- Check Updates / Update All with agent selection

### Settings Page

- General / Display / Advanced / Permissions / Env / Hooks — six sections
- Scope override indicator + reset to default button
- Hook command AI explanation + file path quick-open
- Sandbox structured sub-editor + JSON dual mode
- Attribution, statusLine, spinnerVerbs, spinnerTipsOverride editors

### Info Page

- Extension version, CLI path/version, config file paths with reveal/clear actions

## 0.1.2

- Adjusted hidden item opacity and styling
- Adjusted local badge colors

## 0.1.0

- Marketplace management: add/remove/update sources, toggle auto-update
- Plugin management: search, per-scope enable/disable, expandable cards with contents preview
- MCP Server management: view status, add/remove with scope support
- Description translation via MyMemory API
- File watcher for live config sync
