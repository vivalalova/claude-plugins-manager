import * as vscode from 'vscode';
import { PANEL_TITLES, SIDEBAR_VIEW_ID } from '../constants';
import type { PanelCategory } from '../constants';
import type { MessageRouter } from '../messaging/MessageRouter';
import type { RequestMessage } from '../messaging/protocol';
import type { McpService } from '../services/McpService';
import type { FileWatcherService } from '../services/FileWatcherService';
import type { EditorPanelManager } from './EditorPanelManager';
import { getWebviewHtml } from './webviewHtml';

const VALID_CATEGORIES = new Set<string>(Object.keys(PANEL_TITLES));

/**
 * Sidebar Webview Provider。
 * 顯示三個分類按鈕（Marketplace / Plugin / MCP），
 * 點擊後透過 EditorPanelManager 打開對應 Editor 頁面。
 * 同時支援 sendRequest（via MessageRouter）和 push messages。
 */
export class SidebarViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = SIDEBAR_VIEW_ID;
  private webviewView: vscode.WebviewView | undefined;
  private readonly pushDisposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly editorManager: EditorPanelManager,
    private readonly router: MessageRouter,
    private readonly mcpService: McpService,
    private readonly fileWatcherService: FileWatcherService,
  ) {
    this.pushDisposables.push(
      this.mcpService.onStatusChange.event((servers) => {
        this.postMessage({ type: 'mcp.statusUpdate', servers });
      }),
      this.fileWatcherService.onPluginFilesChanged(() => {
        this.postMessage({ type: 'plugin.refresh' });
      }),
      this.fileWatcherService.onMarketplaceFilesChanged(() => {
        this.postMessage({ type: 'marketplace.refresh' });
      }),
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
      ],
    };

    webviewView.webview.html = getWebviewHtml(
      webviewView.webview,
      this.extensionUri,
      'sidebar',
      vscode.env.language,
    );

    webviewView.webview.onDidReceiveMessage(
      (message: RequestMessage) => {
        if (
          message.type === 'sidebar.openCategory'
          && 'category' in message
          && VALID_CATEGORIES.has((message as { category: string }).category)
        ) {
          this.editorManager.openPanel((message as { category: string }).category as PanelCategory);
        } else {
          this.router.handle(message, (response) => {
            webviewView.webview.postMessage(response);
          });
        }
      },
    );

    webviewView.onDidDispose(() => {
      this.webviewView = undefined;
    });
  }

  /** 推送訊息到 sidebar webview */
  private postMessage(message: unknown): void {
    this.webviewView?.webview.postMessage(message);
  }

  /** 釋放資源 */
  dispose(): void {
    for (const d of this.pushDisposables) d.dispose();
  }
}
