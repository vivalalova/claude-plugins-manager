# Claude Plugins Manager

![Claude Plugins Manager banner](resources/banner.png)

VSCode extension for managing Claude Code's Marketplace,
Plugin, and MCP Server systems.

## Features

- **Marketplace**: Add/remove/update sources,
  toggle auto-update, export/import config
- **Plugin**: Search and filter, collapsible marketplace sections,
  per-scope enable/disable, expandable cards showing contents
  (commands, skills, agents, MCP servers, hooks) with descriptions
- **MCP Server**: View connection status, add/remove servers with scope support

## Install

```bash
npm run install:ext
```

This runs `pnpm install`, builds, packages VSIX, and installs into VSCode.

## Usage

1. Click the Claude icon in the Activity Bar
1. Choose Marketplace, Plugins, or MCP Servers from the sidebar
1. Manage installations in the editor panel

## Development

```bash
npm run watch     # Watch mode (extension + webview)
npm run typecheck # Type check (dual tsconfig)
npm test          # Run tests (vitest, 54 tests)
npm run build     # Production build
```

## Architecture

```text
src/
  extension/              # Extension Host (Node.js)
    services/             # Settings, Plugin, Marketplace, Mcp, Cli
    messaging/            # MessageRouter + protocol types
    providers/            # SidebarViewProvider, EditorPanelManager
  webview/                # React 19 UI (browser)
    sidebar/              # Sidebar navigation
    editor/               # Editor panels (marketplace, plugin, mcp)
    components/           # Shared UI components
    utils/                # Shared utilities
  shared/                 # Types shared between extension and webview
```
