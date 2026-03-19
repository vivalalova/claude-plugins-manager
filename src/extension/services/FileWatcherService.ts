import * as vscode from 'vscode';
import { basename, dirname, join } from 'path';
import { homedir } from 'os';

/** Debounce 延遲（毫秒） */
export const FILE_WATCHER_DEBOUNCE_MS = 500;

/** 檔案變更分類，對應 UI 頁面 */
enum FileChangeCategory {
  Plugin = 'plugin',
  Marketplace = 'marketplace',
  Mcp = 'mcp',
  Settings = 'settings',
  Skill = 'skill',
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

  /** MCP 相關檔案變更（.claude.json、.mcp.json、installed_plugins.json） */
  private readonly _onMcpFilesChanged = new vscode.EventEmitter<void>();
  readonly onMcpFilesChanged = this._onMcpFilesChanged.event;

  /** Settings 相關檔案變更（settings.json、settings.local.json） */
  private readonly _onSettingsFilesChanged = new vscode.EventEmitter<void>();
  readonly onSettingsFilesChanged = this._onSettingsFilesChanged.event;

  /** Skill 相關檔案變更（~/.claude/skills/**、workspace .claude/skills/**） */
  private readonly _onSkillFilesChanged = new vscode.EventEmitter<void>();
  readonly onSkillFilesChanged = this._onSkillFilesChanged.event;

  constructor() {
    this.setupWatchers();
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.rebuildWorkspaceWatchers()),
    );
  }

  /** 建立所有 file watchers */
  private setupWatchers(): void {
    const home = homedir();

    // ~/.claude/settings.json → settings refresh
    this.watchFile(
      join(home, '.claude', 'settings.json'),
      FileChangeCategory.Settings,
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

    // workspace .claude/settings.json → settings refresh
    this.watchWorkspaceFile('.claude/settings.json', FileChangeCategory.Settings);

    // workspace .claude/settings.local.json → settings refresh
    this.watchWorkspaceFile('.claude/settings.local.json', FileChangeCategory.Settings);

    // ~/.claude.json → MCP metadata refresh（user + local scope MCP servers）
    this.watchFile(
      join(home, '.claude.json'),
      FileChangeCategory.Mcp,
    );

    // ~/.claude/plugins/installed_plugins.json → MCP metadata refresh（plugin MCP servers）
    this.watchFile(
      join(home, '.claude', 'plugins', 'installed_plugins.json'),
      FileChangeCategory.Mcp,
    );

    // workspace .mcp.json → MCP metadata refresh（project scope）
    this.watchWorkspaceFile('.mcp.json', FileChangeCategory.Mcp);

    // ~/.claude/skills/** → skill refresh
    this.watchDir(join(home, '.claude', 'skills'), '**/*', FileChangeCategory.Skill);

    // workspace .claude/skills/** → skill refresh
    this.watchWorkspaceFile('.claude/skills/**/*', FileChangeCategory.Skill);
  }

  /** 監控絕對路徑目錄（glob pattern） */
  private watchDir(absoluteDir: string, glob: string, category: FileChangeCategory): void {
    const pattern = new vscode.RelativePattern(vscode.Uri.file(absoluteDir), glob);
    this.createWatcher(pattern, category);
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
    this.watchWorkspaceFile('.claude/settings.json', FileChangeCategory.Settings);
    this.watchWorkspaceFile('.claude/settings.local.json', FileChangeCategory.Settings);
    this.watchWorkspaceFile('.mcp.json', FileChangeCategory.Mcp);
    this.watchWorkspaceFile('.claude/skills/**/*', FileChangeCategory.Skill);
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
        } else if (category === FileChangeCategory.Marketplace) {
          this._onMarketplaceFilesChanged.fire();
        } else if (category === FileChangeCategory.Settings) {
          this._onSettingsFilesChanged.fire();
        } else if (category === FileChangeCategory.Skill) {
          this._onSkillFilesChanged.fire();
        } else {
          this._onMcpFilesChanged.fire();
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
    this._onMcpFilesChanged.dispose();
    this._onSettingsFilesChanged.dispose();
    this._onSkillFilesChanged.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
