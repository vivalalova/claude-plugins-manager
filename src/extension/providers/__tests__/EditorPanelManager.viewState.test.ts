import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter, window, workspace, mockWorkspaceFoldersChangeEmitter } from 'vscode';
import { EditorPanelManager } from '../EditorPanelManager';
import { FileWatcherService, FILE_WATCHER_DEBOUNCE_MS } from '../../services/FileWatcherService';

vi.mock('../webviewHtml', () => ({
  getWebviewHtml: vi.fn(() => '<html></html>'),
}));

vi.mock('os', () => ({
  homedir: () => '/mock-home',
}));

function createMockPanel() {
  let disposeHandler: (() => void) | undefined;
  let viewStateHandler: ((e: { webviewPanel: unknown }) => void) | undefined;
  const viewStateDisposable = { dispose: vi.fn() };
  let visible = true;

  const panel = {
    title: '',
    get visible() {
      return visible;
    },
    webview: {
      html: '',
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
    },
    reveal: vi.fn(),
    onDidDispose: vi.fn((handler: () => void) => {
      disposeHandler = handler;
      return { dispose: vi.fn() };
    }),
    onDidChangeViewState: vi.fn((handler: (e: { webviewPanel: unknown }) => void) => {
      viewStateHandler = handler;
      return viewStateDisposable;
    }),
    dispose: vi.fn(() => disposeHandler?.()),
  };

  return {
    panel,
    viewStateDisposable,
    setVisible(next: boolean) {
      visible = next;
      viewStateHandler?.({ webviewPanel: panel });
    },
  };
}

function createManager(fileWatcherService?: unknown) {
  const mcpService = {
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    onStatusChange: new EventEmitter<unknown[]>(),
    onPollUnavailable: new EventEmitter<void>(),
  };
  const reinstall = new EventEmitter<unknown>();
  const marketplaceService = { onReinstallProgress: reinstall.event };
  const watcher = fileWatcherService ?? {
    onPluginFilesChanged: vi.fn(() => ({ dispose: vi.fn() })),
    onMarketplaceFilesChanged: vi.fn(() => ({ dispose: vi.fn() })),
    onSettingsFilesChanged: vi.fn(() => ({ dispose: vi.fn() })),
    onSkillFilesChanged: vi.fn(() => ({ dispose: vi.fn() })),
  };
  const manager = new EditorPanelManager(
    { fsPath: '/mock-extension' } as any,
    { handle: vi.fn() } as any,
    mcpService as any,
    marketplaceService as any,
    watcher as any,
  );
  return { manager };
}

const settingsRefreshCalls = (panel: ReturnType<typeof createMockPanel>['panel']) =>
  panel.webview.postMessage.mock.calls.filter(([m]) => m?.type === 'settings.refresh');

describe('EditorPanelManager 面板可見狀態變化（C9）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('轉為可見且分類 settings 時一律補送一次 settings.refresh', () => {
    const m = createMockPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(m.panel as any);
    const { manager } = createManager();
    manager.openPanel('settings');

    expect(m.panel.onDidChangeViewState).toHaveBeenCalledTimes(1);
    m.setVisible(false);
    expect(settingsRefreshCalls(m.panel)).toHaveLength(0);

    m.setVisible(true);
    expect(settingsRefreshCalls(m.panel)).toHaveLength(1);
  });

  it('轉為可見但分類非 settings 時不送 settings.refresh', () => {
    const m = createMockPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(m.panel as any);
    const { manager } = createManager();
    manager.openPanel('plugin');

    expect(m.panel.onDidChangeViewState).toHaveBeenCalledTimes(1);
    m.setVisible(false);
    m.setVisible(true);

    expect(settingsRefreshCalls(m.panel)).toHaveLength(0);
  });

  it('轉為不可見時不送 settings.refresh', () => {
    const m = createMockPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(m.panel as any);
    const { manager } = createManager();
    manager.openPanel('settings');

    expect(m.panel.onDidChangeViewState).toHaveBeenCalledTimes(1);
    m.setVisible(false);

    expect(settingsRefreshCalls(m.panel)).toHaveLength(0);
  });

  it('隱藏期間切到 settings 分類，再可見時補送', () => {
    const m = createMockPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(m.panel as any);
    const { manager } = createManager();
    manager.openPanel('plugin');
    m.setVisible(false);
    manager.openPanel('settings');
    m.panel.webview.postMessage.mockClear();

    m.setVisible(true);

    expect(settingsRefreshCalls(m.panel)).toHaveLength(1);
  });

  it('panel dispose 後釋放 listener，且不再送 settings.refresh', () => {
    const m = createMockPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(m.panel as any);
    const { manager } = createManager();
    manager.openPanel('settings');
    expect(m.panel.onDidChangeViewState).toHaveBeenCalledTimes(1);

    m.panel.dispose();
    m.setVisible(false);
    m.setVisible(true);

    expect(m.viewStateDisposable.dispose).toHaveBeenCalled();
    expect(settingsRefreshCalls(m.panel)).toHaveLength(0);
  });
});

describe('工作區資料夾變動 → EditorPanelManager 推 settings.refresh（改點 7）', () => {
  let watcher: FileWatcherService | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    workspace.workspaceFolders = undefined;
  });

  afterEach(() => {
    watcher?.dispose();
    watcher = undefined;
    vi.useRealTimers();
    workspace.workspaceFolders = undefined;
  });

  it('面板可見、分類 settings，加入資料夾後收到 settings.refresh', async () => {
    const m = createMockPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(m.panel as any);
    watcher = new FileWatcherService();
    const { manager } = createManager(watcher);
    manager.openPanel('settings');
    m.panel.webview.postMessage.mockClear();

    workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }] as any;
    mockWorkspaceFoldersChangeEmitter.fire();
    await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);

    expect(settingsRefreshCalls(m.panel)).toHaveLength(1);
  });

  it('分類非 settings 時資料夾變動不送 settings.refresh', async () => {
    const m = createMockPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(m.panel as any);
    watcher = new FileWatcherService();
    const { manager } = createManager(watcher);
    manager.openPanel('plugin');
    m.panel.webview.postMessage.mockClear();

    workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }] as any;
    mockWorkspaceFoldersChangeEmitter.fire();
    await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);

    expect(settingsRefreshCalls(m.panel)).toHaveLength(0);
  });
});
