import * as vscode from 'vscode';
import { join } from 'path';
import { homedir } from 'os';
import { mkdir, cp, rm, readdir } from 'fs/promises';
import { COMMANDS } from './constants';
import { CliService } from './services/CliService';
import { MarketplaceService } from './services/MarketplaceService';
import { PluginService } from './services/PluginService';
import { SettingsFileService } from './services/SettingsFileService';
import { McpService } from './services/McpService';
import { TranslationService } from './services/TranslationService';
import { FileWatcherService } from './services/FileWatcherService';
import { HookExplanationService } from './services/HookExplanationService';
import { ExtensionInfoService } from './services/ExtensionInfoService';
import { MessageRouter } from './messaging/MessageRouter';
import { SidebarViewProvider } from './providers/SidebarViewProvider';
import { EditorPanelManager } from './providers/EditorPanelManager';

/** 將舊 cache 目錄遷移至新 globalStorage 目錄 */
async function migrateCacheIfNeeded(oldCacheDir: string, newCacheDir: string): Promise<void> {
  try {
    const oldEntries = await readdir(oldCacheDir);
    if (oldEntries.length === 0) {
      await rm(oldCacheDir, { recursive: true, force: true });
      return;
    }

    const newEntries = await readdir(newCacheDir).catch(() => []);
    if (newEntries.length > 0) return; // new dir already has content, skip

    await cp(oldCacheDir, newCacheDir, { recursive: true });
    await rm(oldCacheDir, { recursive: true, force: true });
  } catch {
    // old dir doesn't exist or migration failed — safe to ignore
  }
}

/** Extension 啟動進入點 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const cacheDir = join(context.globalStorageUri.fsPath, 'cache');
  await mkdir(cacheDir, { recursive: true });

  const oldCacheDir = join(homedir(), '.claude', 'plugins', '.cache');
  await migrateCacheIfNeeded(oldCacheDir, cacheDir);

  const cli = new CliService();
  const marketplaceService = new MarketplaceService(cli);
  const settingsFileService = new SettingsFileService();
  const pluginService = new PluginService(cli, settingsFileService);
  const mcpService = new McpService(cli, settingsFileService);
  const translationService = new TranslationService(cacheDir);
  const fileWatcherService = new FileWatcherService();
  const hookExplanationService = new HookExplanationService(cli, cacheDir);
  const extensionInfoService = new ExtensionInfoService(
    cli,
    context.extension.packageJSON as { version: string; displayName?: string; publisher?: string; repository?: { url?: string } },
    context.extensionUri.fsPath,
    cacheDir,
  );
  const router = new MessageRouter(marketplaceService, pluginService, mcpService, translationService, settingsFileService, hookExplanationService, extensionInfoService, cacheDir);
  // Marketplace 檔案變更 → invalidate scan cache（plugin settings 變更不影響 marketplace 掃描）
  fileWatcherService.onMarketplaceFilesChanged(() => settingsFileService.invalidateScanCache());
  // plugin settings 也會影響 plugin-provided MCP 的 enabled 狀態
  fileWatcherService.onPluginFilesChanged(() => {
    mcpService.invalidateMetadataCache();
    mcpService.triggerPoll();
  });
  // MCP 相關檔案變更 → invalidate metadata cache + 立即 poll（取代等待下一個 interval）
  fileWatcherService.onMcpFilesChanged(() => {
    mcpService.invalidateMetadataCache();
    mcpService.triggerPoll();
  });
  // Workspace 切換 → invalidate（不同 workspace 有不同的 .mcp.json）
  const workspaceFolderDisposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    mcpService.invalidateMetadataCache();
  });
  const editorManager = new EditorPanelManager(context.extensionUri, router, mcpService, fileWatcherService);

  const sidebarProvider = new SidebarViewProvider(
    context.extensionUri,
    editorManager,
    router,
    mcpService,
    fileWatcherService,
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
      },
    ),
    vscode.commands.registerCommand(
      COMMANDS.openSettings,
      () => editorManager.openPanel('settings'),
    ),
    vscode.commands.registerCommand(
      COMMANDS.openInfo,
      () => editorManager.openPanel('info'),
    ),
    workspaceFolderDisposable,
    { dispose: () => editorManager.dispose() },
    { dispose: () => sidebarProvider.dispose() },
    { dispose: () => mcpService.dispose() },
    fileWatcherService,
  );
}

/** Extension 停用 */
export function deactivate(): void {
  // cleanup handled by disposables
}
