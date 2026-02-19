import * as vscode from 'vscode';
import { EXTENSION_ID, PANEL_TITLES } from '../constants';
import type { PanelCategory } from '../constants';
import type { MessageRouter } from '../messaging/MessageRouter';
import type { RequestMessage } from '../messaging/protocol';
import type { McpService } from '../services/McpService';
import type { FileWatcherService } from '../services/FileWatcherService';
import { getWebviewHtml } from './webviewHtml';

/**
 * 管理 Editor 區域的 Webview Panel。
 * 所有分類共用同一個 panel，切換 category 時發 navigate message。
 */
export class EditorPanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private currentCategory: PanelCategory | undefined;
  private readonly pushDisposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly router: MessageRouter,
    private readonly mcpService: McpService,
    private readonly fileWatcherService: FileWatcherService,
  ) {
    this.pushDisposables.push(
      this.mcpService.onStatusChange.event((servers) => {
        if (this.panel?.visible && this.currentCategory === 'mcp') {
          this.panel.webview.postMessage({ type: 'mcp.statusUpdate', servers });
        }
      }),
      this.mcpService.onPollUnavailable.event(() => {
        if (this.panel?.visible && this.currentCategory === 'mcp') {
          this.panel.webview.postMessage({ type: 'mcp.pollUnavailable' });
        }
      }),
      this.fileWatcherService.onPluginFilesChanged(() => {
        if (this.panel?.visible && this.currentCategory === 'plugin') {
          this.panel.webview.postMessage({ type: 'plugin.refresh' });
        }
      }),
      this.fileWatcherService.onMarketplaceFilesChanged(() => {
        if (this.panel?.visible && this.currentCategory === 'marketplace') {
          this.panel.webview.postMessage({ type: 'marketplace.refresh' });
        }
      }),
    );
  }

  /** 打開或切換至指定分類的 editor panel */
  openPanel(category: PanelCategory): void {
    if (this.panel) {
      this.panel.title = PANEL_TITLES[category];
      this.currentCategory = category;
      this.panel.webview.postMessage({ type: 'navigate', category });
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      `${EXTENSION_ID}.editor`,
      PANEL_TITLES[category],
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        ],
      },
    );

    panel.webview.html = getWebviewHtml(
      panel.webview,
      this.extensionUri,
      category,
    );

    panel.webview.onDidReceiveMessage(
      (message: RequestMessage) => {
        this.router.handle(message, (response) => {
          panel.webview.postMessage(response);
        });
      },
    );

    panel.onDidDispose(() => {
      this.panel = undefined;
      this.currentCategory = undefined;
    });

    this.panel = panel;
    this.currentCategory = category;
  }

  /** 推送訊息到 panel（僅在 category 匹配時） */
  postToPanel(category: PanelCategory, message: unknown): void {
    if (this.currentCategory === category) {
      this.panel?.webview.postMessage(message);
    }
  }

  /** 釋放資源 */
  dispose(): void {
    for (const d of this.pushDisposables) d.dispose();
    this.panel?.dispose();
    this.panel = undefined;
  }
}
