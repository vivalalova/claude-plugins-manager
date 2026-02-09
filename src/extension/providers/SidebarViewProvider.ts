import * as vscode from 'vscode';
import { PANEL_TITLES, SIDEBAR_VIEW_ID } from '../constants';
import type { PanelCategory } from '../constants';
import type { EditorPanelManager } from './EditorPanelManager';
import { getWebviewHtml } from './webviewHtml';

const VALID_CATEGORIES = new Set<string>(Object.keys(PANEL_TITLES));

/**
 * Sidebar Webview Provider。
 * 顯示三個分類按鈕（Marketplace / Plugin / MCP），
 * 點擊後透過 EditorPanelManager 打開對應 Editor 頁面。
 */
export class SidebarViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = SIDEBAR_VIEW_ID;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly editorManager: EditorPanelManager,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
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
    );

    webviewView.webview.onDidReceiveMessage(
      (message: { type: string; category?: string }) => {
        if (
          message.type === 'sidebar.openCategory'
          && message.category
          && VALID_CATEGORIES.has(message.category)
        ) {
          this.editorManager.openPanel(message.category as PanelCategory);
        }
      },
    );
  }
}
