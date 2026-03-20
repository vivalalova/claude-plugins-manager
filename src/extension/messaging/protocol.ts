import type { McpAddParams, McpScope, McpServer, PluginScope, RegistrySort, SkillScope } from '../../shared/types';

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
  | { type: 'preferences.read'; requestId: string }
  | { type: 'preferences.write'; requestId: string; key: string; value: unknown }
  | { type: 'settings.get'; requestId: string; scope: PluginScope }
  | { type: 'settings.set'; requestId: string; scope: PluginScope; key: string; value: unknown }
  | { type: 'settings.delete'; requestId: string; scope: PluginScope; key: string }
  | { type: 'settings.openInEditor'; requestId: string; scope: PluginScope }
  | { type: 'hooks.checkFilePaths'; requestId: string; paths: string[] }
  | { type: 'hooks.openFile'; requestId: string; path: string }
  | { type: 'hooks.explain'; requestId: string; hookContent: string; eventType: string; locale: string; filePath?: string; refresh?: boolean }
  | { type: 'hooks.loadCachedExplanations'; requestId: string; items: Array<{ hookContent: string; locale: string; filePath?: string }> }
  | { type: 'hooks.cleanExpiredExplanations'; requestId: string }
  | { type: 'extension.getInfo'; requestId: string }
  | { type: 'extension.revealPath'; requestId: string; path: string }
  | { type: 'extension.clearCache'; requestId: string }
  | { type: 'skill.list'; requestId: string; scope?: SkillScope }
  | { type: 'skill.add'; requestId: string; source: string; scope: SkillScope; agents?: string[] }
  | { type: 'skill.remove'; requestId: string; name: string; scope: SkillScope }
  | { type: 'skill.find'; requestId: string; query: string }
  | { type: 'skill.check'; requestId: string }
  | { type: 'skill.update'; requestId: string }
  | { type: 'skill.getDetail'; requestId: string; path: string }
  | { type: 'skill.registry'; requestId: string; sort: RegistrySort; query?: string }
  | { type: 'skill.openFile'; requestId: string; path: string };

// ---------------------------------------------------------------------------
// Extension → Webview（Response）
// ---------------------------------------------------------------------------

export type ResponseMessage =
  | { type: 'response'; requestId: string; data: unknown }
  | { type: 'error'; requestId: string; error: string };

// ---------------------------------------------------------------------------
// Extension → Webview（Push，主動 broadcast，非 Request/Response 配對）
// ---------------------------------------------------------------------------

/**
 * Extension 主動 broadcast 給所有 webview 的事件型訊息，不帶 requestId。
 * viewState.changed：某 webview 寫入偏好設定後 broadcast 通知其他 webview 同步，
 * 防止雙 webview（Sidebar + Editor）競寫衝突。
 */
export type PushMessage =
  | { type: 'viewState.changed'; key: string; value: unknown }
  | { type: 'mcp.statusUpdate'; servers: McpServer[] }
  | { type: 'mcp.pollUnavailable' }
  | { type: 'plugin.refresh' }
  | { type: 'marketplace.refresh' }
  | { type: 'settings.refresh' }
  | { type: 'skill.refresh' };
