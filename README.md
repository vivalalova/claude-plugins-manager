# Claude Plugins Manager

![Claude Plugins Manager banner](resources/banner.png)

VSCode extension for managing Claude Code's Marketplace,
Plugin, and MCP Server systems.

## Features

- **Marketplace**: Add/remove/update sources,
  toggle auto-update, export/import config
- **Plugin**: Search and filter, collapsible marketplace sections,
  per-scope enable/disable, expandable cards showing contents
  (commands, skills, agents, MCP servers, hooks) with descriptions,
  GitHub link per plugin, description translation
- **MCP Server**: View connection status, per-server test connection,
  add/remove servers with scope support
- **Settings**: Edit Claude Code settings.json across user/project/local scopes,
  with scope override indicators, reset-to-default, and sections for general behavior,
  display, permissions, environment variables, hooks, and advanced integration options

## Install

```bash
npm run install:ext    # Build and install into VSCode
npm run uninstall:ext  # Uninstall from VSCode
```

## Usage

1. Click the Claude icon in the Activity Bar
1. Choose Marketplace, Plugins, or MCP Servers from the sidebar
1. Manage installations in the editor panel

## Development

```bash
npm run watch     # Watch mode (extension + webview)
npm run typecheck # Type check (dual tsconfig)
npm test          # Run tests (vitest)
npm run build     # Production build
```
