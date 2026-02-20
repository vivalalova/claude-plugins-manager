import * as vscode from 'vscode';
import { COMMANDS } from './constants';
import { CliService } from './services/CliService';
import { MarketplaceService } from './services/MarketplaceService';
import { PluginService } from './services/PluginService';
import { SettingsFileService } from './services/SettingsFileService';
import { McpService } from './services/McpService';
import { TranslationService } from './services/TranslationService';
import { FileWatcherService } from './services/FileWatcherService';
import { MessageRouter } from './messaging/MessageRouter';
import { SidebarViewProvider } from './providers/SidebarViewProvider';
import { EditorPanelManager } from './providers/EditorPanelManager';

/** Extension 啟動進入點 */
export function activate(context: vscode.ExtensionContext): void {
  const cli = new CliService();
  const marketplaceService = new MarketplaceService(cli);
  const settingsFileService = new SettingsFileService();
  const pluginService = new PluginService(cli, settingsFileService);
  const mcpService = new McpService(cli);
  const translationService = new TranslationService();
  const fileWatcherService = new FileWatcherService();
  const router = new MessageRouter(marketplaceService, pluginService, mcpService, translationService);
  // MCP 相關檔案變更 → invalidate metadata cache
  fileWatcherService.onMcpFilesChanged(() => mcpService.invalidateMetadataCache());
  // Workspace 切換 → invalidate（不同 workspace 有不同的 .mcp.json）
  vscode.workspace.onDidChangeWorkspaceFolders(() => mcpService.invalidateMetadataCache());
  const editorManager = new EditorPanelManager(context.extensionUri, router, mcpService, fileWatcherService);

  const sidebarProvider = new SidebarViewProvider(
    context.extensionUri,
    editorManager,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarViewProvider.viewType,
      sidebarProvider,
    ),
    vscode.commands.registerCommand(
      COMMANDS.openMarketplace,
      () => editorManager.openPanel('marketplace'),
    ),
    vscode.commands.registerCommand(
      COMMANDS.openPlugin,
      () => editorManager.openPanel('plugin'),
    ),
    vscode.commands.registerCommand(
      COMMANDS.openMcp,
      () => {
        editorManager.openPanel('mcp');
        mcpService.startPolling();
      },
    ),
    { dispose: () => editorManager.dispose() },
    { dispose: () => mcpService.dispose() },
    fileWatcherService,
  );
}

/** Extension 停用 */
export function deactivate(): void {
  // cleanup handled by disposables
}
