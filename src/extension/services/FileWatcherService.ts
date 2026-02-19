import * as vscode from 'vscode';
import { basename, dirname, join } from 'path';
import { homedir } from 'os';

/** Debounce 延遲（毫秒） */
export const FILE_WATCHER_DEBOUNCE_MS = 500;

/** 檔案變更分類，對應 UI 頁面 */
enum FileChangeCategory {
  Plugin = 'plugin',
  Marketplace = 'marketplace',
}

/**
 * 監控 Claude Code 設定檔變更，debounce 後觸發分類事件。
 * EditorPanelManager 訂閱後推送 refresh 訊號給 webview。
 */
export class FileWatcherService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly workspaceWatchers: vscode.Disposable[] = [];
  private readonly debounceTimers = new Map<FileChangeCategory, ReturnType<typeof setTimeout>>();
  private disposed = false;

  /** Plugin 相關檔案變更（settings.json、installed_plugins.json） */
  private readonly _onPluginFilesChanged = new vscode.EventEmitter<void>();
  readonly onPluginFilesChanged = this._onPluginFilesChanged.event;

  /** Marketplace 相關檔案變更（known_marketplaces.json） */
  private readonly _onMarketplaceFilesChanged = new vscode.EventEmitter<void>();
  readonly onMarketplaceFilesChanged = this._onMarketplaceFilesChanged.event;

  constructor() {
    this.setupWatchers();
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.rebuildWorkspaceWatchers()),
    );
  }

  /** 建立所有 file watchers */
  private setupWatchers(): void {
    const home = homedir();

    // ~/.claude/settings.json → plugin refresh
    this.watchFile(
      join(home, '.claude', 'settings.json'),
      FileChangeCategory.Plugin,
    );

    // ~/.claude/plugins/installed_plugins.json → plugin refresh
    this.watchFile(
      join(home, '.claude', 'plugins', 'installed_plugins.json'),
      FileChangeCategory.Plugin,
    );

    // ~/.claude/plugins/known_marketplaces.json → marketplace refresh
    this.watchFile(
      join(home, '.claude', 'plugins', 'known_marketplaces.json'),
      FileChangeCategory.Marketplace,
    );

    // workspace .claude/settings.json → plugin refresh
    this.watchWorkspaceFile('.claude/settings.json', FileChangeCategory.Plugin);

    // workspace .claude/settings.local.json → plugin refresh
    this.watchWorkspaceFile('.claude/settings.local.json', FileChangeCategory.Plugin);
  }

  /** 監控絕對路徑檔案 */
  private watchFile(absolutePath: string, category: FileChangeCategory): void {
    const dir = dirname(absolutePath);
    const filename = basename(absolutePath);
    const pattern = new vscode.RelativePattern(vscode.Uri.file(dir), filename);
    this.createWatcher(pattern, category);
  }

  /** 監控 workspace 相對路徑檔案 */
  private watchWorkspaceFile(relativePath: string, category: FileChangeCategory): void {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return;

    for (const folder of folders) {
      const pattern = new vscode.RelativePattern(folder, relativePath);
      this.createWatcher(pattern, category, true);
    }
  }

  /** workspace folder 變更時重建 workspace watchers */
  private rebuildWorkspaceWatchers(): void {
    if (this.disposed) return;
    for (const d of this.workspaceWatchers) d.dispose();
    this.workspaceWatchers.length = 0;
    this.watchWorkspaceFile('.claude/settings.json', FileChangeCategory.Plugin);
    this.watchWorkspaceFile('.claude/settings.local.json', FileChangeCategory.Plugin);
  }

  /** 建立 watcher 並綁定 change/create/delete 事件 */
  private createWatcher(pattern: vscode.RelativePattern, category: FileChangeCategory, isWorkspace = false): void {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const handler = () => this.debouncedEmit(category);

    watcher.onDidChange(handler);
    watcher.onDidCreate(handler);
    watcher.onDidDelete(handler);

    if (isWorkspace) {
      this.workspaceWatchers.push(watcher);
    } else {
      this.disposables.push(watcher);
    }
  }

  /** Debounce 後觸發對應分類的事件 */
  private debouncedEmit(category: FileChangeCategory): void {
    const existing = this.debounceTimers.get(category);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(
      category,
      setTimeout(() => {
        this.debounceTimers.delete(category);
        if (category === FileChangeCategory.Plugin) {
          this._onPluginFilesChanged.fire();
        } else {
          this._onMarketplaceFilesChanged.fire();
        }
      }, FILE_WATCHER_DEBOUNCE_MS),
    );
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
    for (const d of this.workspaceWatchers) d.dispose();
    this.workspaceWatchers.length = 0;
    this._onPluginFilesChanged.dispose();
    this._onMarketplaceFilesChanged.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
