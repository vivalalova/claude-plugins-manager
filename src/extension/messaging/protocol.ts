import type { McpAddParams, McpScope, McpServer, PluginScope } from '../types';

// ---------------------------------------------------------------------------
// Webview → Extension（Request）
// ---------------------------------------------------------------------------

export type RequestMessage =
  | { type: 'marketplace.list'; requestId: string }
  | { type: 'marketplace.add'; requestId: string; source: string }
  | { type: 'marketplace.remove'; requestId: string; name: string }
  | { type: 'marketplace.update'; requestId: string; name?: string }
  | { type: 'marketplace.toggleAutoUpdate'; requestId: string; name: string }
  | { type: 'marketplace.export'; requestId: string }
  | { type: 'marketplace.import'; requestId: string }
  | { type: 'plugin.listInstalled'; requestId: string }
  | { type: 'plugin.listAvailable'; requestId: string }
  | { type: 'plugin.install'; requestId: string; plugin: string; scope: PluginScope }
  | { type: 'plugin.uninstall'; requestId: string; plugin: string; scope: PluginScope }
  | { type: 'plugin.enable'; requestId: string; plugin: string; scope?: PluginScope }
  | { type: 'plugin.disable'; requestId: string; plugin: string; scope?: PluginScope }
  | { type: 'plugin.disableAll'; requestId: string }
  | { type: 'plugin.update'; requestId: string; plugin: string; scope?: PluginScope }
  | { type: 'mcp.list'; requestId: string }
  | { type: 'mcp.add'; requestId: string; params: McpAddParams }
  | { type: 'mcp.remove'; requestId: string; name: string; scope?: McpScope }
  | { type: 'mcp.getDetail'; requestId: string; name: string }
  | { type: 'mcp.resetProjectChoices'; requestId: string }
  | { type: 'plugin.translate'; requestId: string; texts: string[]; targetLang: string }
  | { type: 'workspace.getFolders'; requestId: string }
  | { type: 'sidebar.openCategory'; category: string };

// ---------------------------------------------------------------------------
// Extension → Webview（Response）
// ---------------------------------------------------------------------------

export type ResponseMessage =
  | { type: 'response'; requestId: string; data: unknown }
  | { type: 'error'; requestId: string; error: string }
  | { type: 'mcp.statusUpdate'; servers: McpServer[] };
