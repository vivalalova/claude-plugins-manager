import * as vscode from 'vscode';
import type { MarketplaceService } from '../services/MarketplaceService';
import type { PluginService } from '../services/PluginService';
import type { McpService } from '../services/McpService';
import type { TranslationService } from '../services/TranslationService';
import type { RequestMessage, ResponseMessage } from './protocol';

type PostFn = (msg: ResponseMessage) => void;

/**
 * 路由 Webview 訊息到對應 Service，回傳結果或錯誤。
 * 每個 request 都帶 requestId，用於 webview 端配對 Promise。
 */
export class MessageRouter {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly plugin: PluginService,
    private readonly mcp: McpService,
    private readonly translation: TranslationService,
  ) {}

  /** 處理來自 webview 的訊息 */
  async handle(message: RequestMessage, post: PostFn): Promise<void> {
    // sidebar 導航訊息不需 response
    if (message.type === 'sidebar.openCategory') {
      return;
    }

    const { requestId } = message;

    try {
      const data = await this.dispatch(message);
      post({ type: 'response', requestId, data });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[MessageRouter] ${message.type} failed:`, msg);
      post({ type: 'error', requestId, error: msg });
    }
  }

  /** 依 message type 分派到對應 service method */
  private async dispatch(message: RequestMessage): Promise<unknown> {
    switch (message.type) {
      // Marketplace
      case 'marketplace.list':
        return this.marketplace.list();
      case 'marketplace.add':
        return this.marketplace.add(message.source);
      case 'marketplace.remove':
        return this.marketplace.remove(message.name);
      case 'marketplace.update':
        return this.marketplace.update(message.name);
      case 'marketplace.toggleAutoUpdate':
        return this.marketplace.toggleAutoUpdate(message.name);
      case 'marketplace.export':
        return this.marketplace.exportScript();
      case 'marketplace.import':
        return this.marketplace.importScript();

      // Plugin
      case 'plugin.listInstalled':
        return this.plugin.listInstalled();
      case 'plugin.listAvailable':
        return this.plugin.listAvailable();
      case 'plugin.install':
        return this.plugin.install(message.plugin, message.scope);
      case 'plugin.uninstall':
        return this.plugin.uninstall(message.plugin, message.scope);
      case 'plugin.enable':
        return this.plugin.enable(message.plugin, message.scope);
      case 'plugin.disable':
        return this.plugin.disable(message.plugin, message.scope);
      case 'plugin.disableAll':
        return this.plugin.disableAll();
      case 'plugin.update':
        return this.plugin.update(message.plugin, message.scope);
      case 'plugin.translate':
        return this.translation.translate(message.texts, message.targetLang, message.email);

      // MCP（即時從設定檔讀取，polling 背景更新狀態）
      case 'mcp.list':
        return this.mcp.listFromFiles();
      case 'mcp.add':
        return this.mcp.add(message.params);
      case 'mcp.remove':
        return this.mcp.remove(message.name, message.scope);
      case 'mcp.getDetail':
        return this.mcp.getDetail(message.name);
      case 'mcp.resetProjectChoices':
        return this.mcp.resetProjectChoices();
      case 'mcp.refreshStatus':
        return this.mcp.refreshStatus();
      case 'mcp.restartPolling':
        this.mcp.restartPolling();
        return;

      // Workspace
      case 'workspace.getFolders':
        return (vscode.workspace.workspaceFolders ?? []).map((f) => ({
          name: f.name,
          path: f.uri.fsPath,
        }));

      // Utility
      case 'openExternal':
        await vscode.env.openExternal(vscode.Uri.parse(message.url));
        return;

      default:
        throw new Error(`Unknown message type: ${(message as { type: string }).type}`);
    }
  }
}
