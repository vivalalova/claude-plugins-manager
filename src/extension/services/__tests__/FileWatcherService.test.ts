import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workspace, mockFileWatchers, mockWorkspaceFoldersChangeEmitter } from 'vscode';
import { FileWatcherService, FILE_WATCHER_DEBOUNCE_MS } from '../FileWatcherService';

vi.mock('os', () => ({
  homedir: () => '/mock-home',
}));

describe('FileWatcherService', () => {
  let svc: FileWatcherService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockFileWatchers.length = 0;
    workspace.workspaceFolders = [
      { uri: { fsPath: '/my/project' } },
    ] as any;
  });

  afterEach(() => {
    svc?.dispose();
    vi.useRealTimers();
    workspace.workspaceFolders = undefined;
  });

  describe('watcher 初始化', () => {
    it('建立 8 個 file watcher（5 home + 3 workspace）', () => {
      svc = new FileWatcherService();
      // 5 home dir files + 3 workspace files = 8
      expect(workspace.createFileSystemWatcher).toHaveBeenCalledTimes(8);
      expect(mockFileWatchers).toHaveLength(8);
    });

    it('無 workspace 時只建立 5 個 home dir watcher', () => {
      workspace.workspaceFolders = undefined;
      svc = new FileWatcherService();
      expect(workspace.createFileSystemWatcher).toHaveBeenCalledTimes(5);
    });
  });

  describe('plugin 檔案變更 → onPluginFilesChanged 事件', () => {
    it('settings.json 變更後 debounce 觸發事件', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onPluginFilesChanged(handler);

      // watcher 0 = ~/.claude/settings.json
      mockFileWatchers[0].fireChange();

      // 未到 debounce 時間，不應觸發
      expect(handler).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('installed_plugins.json 變更也觸發 plugin 事件', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onPluginFilesChanged(handler);

      // watcher 1 = ~/.claude/plugins/installed_plugins.json
      mockFileWatchers[1].fireChange();
      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('workspace settings.json 變更觸發 plugin 事件', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onPluginFilesChanged(handler);

      // watcher 3 = workspace .claude/settings.json
      mockFileWatchers[3].fireChange();
      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('workspace settings.local.json 變更觸發 plugin 事件', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onPluginFilesChanged(handler);

      // watcher 4 = workspace .claude/settings.local.json
      mockFileWatchers[4].fireChange();
      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('marketplace 檔案變更 → onMarketplaceFilesChanged 事件', () => {
    it('known_marketplaces.json 變更後 debounce 觸發事件', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onMarketplaceFilesChanged(handler);

      // watcher 2 = ~/.claude/plugins/known_marketplaces.json
      mockFileWatchers[2].fireChange();
      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('MCP 檔案變更 → onMcpFilesChanged 事件', () => {
    it('.claude.json 變更觸發 MCP 事件', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onMcpFilesChanged(handler);

      // watcher 5 = ~/.claude.json (Mcp)
      mockFileWatchers[5].fireChange();
      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('installed_plugins.json 變更觸發 MCP 事件（plugin MCP servers）', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onMcpFilesChanged(handler);

      // watcher 6 = installed_plugins.json (Mcp)
      mockFileWatchers[6].fireChange();
      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('workspace .mcp.json 變更觸發 MCP 事件', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onMcpFilesChanged(handler);

      // watcher 7 = workspace .mcp.json (Mcp)
      mockFileWatchers[7].fireChange();
      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('debounce 行為', () => {
    it('debounce 時間內多次同分類變更只觸發一次', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onPluginFilesChanged(handler);

      // 連續觸發多個 plugin 相關檔案變更
      mockFileWatchers[0].fireChange(); // settings.json
      mockFileWatchers[1].fireChange(); // installed_plugins.json
      mockFileWatchers[0].fireChange(); // settings.json again

      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('不同分類的變更獨立 debounce', async () => {
      svc = new FileWatcherService();
      const pluginHandler = vi.fn();
      const marketplaceHandler = vi.fn();
      svc.onPluginFilesChanged(pluginHandler);
      svc.onMarketplaceFilesChanged(marketplaceHandler);

      mockFileWatchers[0].fireChange(); // plugin category
      mockFileWatchers[2].fireChange(); // marketplace category

      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(pluginHandler).toHaveBeenCalledTimes(1);
      expect(marketplaceHandler).toHaveBeenCalledTimes(1);
    });

    it('debounce 內再次觸發會重置計時器', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onPluginFilesChanged(handler);

      mockFileWatchers[0].fireChange();
      await vi.advanceTimersByTimeAsync(300); // 300ms 後再觸發
      mockFileWatchers[0].fireChange();

      await vi.advanceTimersByTimeAsync(300); // 第一次後 600ms，第二次後 300ms
      expect(handler).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(200); // 第二次後 500ms
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('create/delete 事件也觸發', () => {
    it('onDidCreate 觸發事件', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onPluginFilesChanged(handler);

      mockFileWatchers[0].fireCreate();
      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('onDidDelete 觸發事件', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onPluginFilesChanged(handler);

      mockFileWatchers[0].fireDelete();
      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('workspace folder 變更', () => {
    it('workspace folder 新增後重建 workspace watchers', async () => {
      svc = new FileWatcherService();
      const initialCount = mockFileWatchers.length; // 8 (5 home + 3 workspace)
      expect(initialCount).toBe(8);

      // 模擬新增第二個 workspace folder
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' } },
        { uri: { fsPath: '/my/second-project' } },
      ] as any;

      mockWorkspaceFoldersChangeEmitter.fire();

      // 舊的 3 個 workspace watcher 被 dispose
      // 新建 6 個 workspace watcher（2 folders × 3 files）
      // 總共 = 8 (initial) + 6 (new workspace) = 14
      const totalWatchers = mockFileWatchers.length;
      expect(totalWatchers).toBe(14);

      // 新的 workspace watcher 能觸發事件
      const handler = vi.fn();
      svc.onPluginFilesChanged(handler);
      // 找最後一個 plugin workspace watcher（settings.local.json）
      // 新 workspace watcher 順序：settings.json × 2, settings.local.json × 2, .mcp.json × 2
      // 倒數第 3 = 第二個 project 的 settings.local.json
      mockFileWatchers[totalWatchers - 3].fireChange();
      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('舊 workspace watcher 被 dispose', () => {
      svc = new FileWatcherService();
      // watcher 3, 4, 7 是 workspace watchers（settings.json, settings.local.json, .mcp.json）
      const oldWorkspaceWatchers = [mockFileWatchers[3], mockFileWatchers[4], mockFileWatchers[7]];

      workspace.workspaceFolders = [
        { uri: { fsPath: '/other/project' } },
      ] as any;

      mockWorkspaceFoldersChangeEmitter.fire();

      for (const mock of oldWorkspaceWatchers) {
        expect(mock.watcher.dispose).toHaveBeenCalled();
      }
    });
  });

  describe('dispose', () => {
    it('dispose 後不再觸發事件（timer 被清除）', async () => {
      svc = new FileWatcherService();
      const handler = vi.fn();
      svc.onPluginFilesChanged(handler);

      mockFileWatchers[0].fireChange();
      svc.dispose();

      await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
      expect(handler).not.toHaveBeenCalled();
    });

    it('dispose 清理所有 watcher', () => {
      svc = new FileWatcherService();
      svc.dispose();

      for (const mock of mockFileWatchers) {
        expect(mock.watcher.dispose).toHaveBeenCalled();
      }
    });
  });
});
