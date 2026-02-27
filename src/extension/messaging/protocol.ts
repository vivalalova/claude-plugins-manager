import type { McpAddParams, McpScope, McpServer, PluginScope } from '../types';

// ---------------------------------------------------------------------------
// Webview → Extension（Request）
// ---------------------------------------------------------------------------

export type RequestMessage =
  | { type: 'marketplace.list'; requestId: string }
  | { type: 'marketplace.preview'; requestId: string; source: string }
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
  | { type: 'plugin.export'; requestId: string }
  | { type: 'plugin.import'; requestId: string }
  | { type: 'mcp.list'; requestId: string }
  | { type: 'mcp.add'; requestId: string; params: McpAddParams }
  | { type: 'mcp.remove'; requestId: string; name: string; scope?: McpScope }
  | { type: 'mcp.getDetail'; requestId: string; name: string }
  | { type: 'mcp.resetProjectChoices'; requestId: string }
  | { type: 'mcp.refreshStatus'; requestId: string }
  | { type: 'mcp.restartPolling'; requestId: string }
  | { type: 'plugin.translate'; requestId: string; texts: string[]; targetLang: string; email?: string }
  | { type: 'workspace.getFolders'; requestId: string }
  | { type: 'openExternal'; requestId: string; url: string }
  | { type: 'sidebar.openCategory'; category: string }
  | { type: 'viewState.get'; requestId: string; key: string; fallback?: unknown }
  | { type: 'viewState.set'; requestId: string; key: string; value: unknown }
  | { type: 'viewState.getAll'; requestId: string; keys: { key: string; fallback: unknown }[] };

// ---------------------------------------------------------------------------
// Extension → Webview（Response）
// ---------------------------------------------------------------------------

export type ResponseMessage =
  | { type: 'response'; requestId: string; data: unknown }
  | { type: 'error'; requestId: string; error: string }
  | { type: 'mcp.statusUpdate'; servers: McpServer[] }
  | { type: 'mcp.pollUnavailable' }
  | { type: 'plugin.refresh' }
  | { type: 'marketplace.refresh' };

// ---------------------------------------------------------------------------
// Extension → Webview（Push，主動 broadcast，非 Request/Response 配對）
// ---------------------------------------------------------------------------

/**
 * Extension 主動 broadcast 給所有 webview 的事件型訊息，不帶 requestId。
 * viewState.changed：某 webview 寫入 globalState 後 broadcast 通知其他 webview 同步，
 * 防止雙 webview（Sidebar + Editor）競寫衝突。消費端尚未實作，預留擴充點。
 */
// TODO: 實作時將 ResponseMessage 的 push 成員（mcp.statusUpdate 等）遷入此型別
export type PushMessage = { type: 'viewState.changed'; key: string; value: unknown };
