import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter, ViewColumn, window } from 'vscode';
import { EditorPanelManager } from '../EditorPanelManager';

vi.mock('../webviewHtml', () => ({
  getWebviewHtml: vi.fn(() => '<html></html>'),
}));

function createMockPanel() {
  let disposeHandler: (() => void) | undefined;

  const panel = {
    title: '',
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
    dispose: vi.fn(() => disposeHandler?.()),
  };

  return panel;
}

function createManager() {
  const mcpService = {
    startPolling: vi.fn(),
    onStatusChange: new EventEmitter<unknown[]>(),
    onPollUnavailable: new EventEmitter<void>(),
  };
  const fileWatcherService = {
    onPluginFilesChanged: vi.fn(() => ({ dispose: vi.fn() })),
    onMarketplaceFilesChanged: vi.fn(() => ({ dispose: vi.fn() })),
  };
  const router = {
    handle: vi.fn(),
  };

  const manager = new EditorPanelManager(
    { fsPath: '/mock-extension' } as any,
    router as any,
    mcpService as any,
    fileWatcherService as any,
  );

  return { manager, mcpService, fileWatcherService, router };
}

describe('EditorPanelManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('新開 MCP 頁時啟動 polling', () => {
    const panel = createMockPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(panel as any);
    const { manager, mcpService } = createManager();

    manager.openPanel('mcp');

    expect(window.createWebviewPanel).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      ViewColumn.One,
      expect.objectContaining({ enableScripts: true }),
    );
    expect(mcpService.startPolling).toHaveBeenCalledTimes(1);
  });

  it('已開啟 panel 內切到 MCP 頁時也啟動 polling', () => {
    const panel = createMockPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(panel as any);
    const { manager, mcpService } = createManager();

    manager.openPanel('marketplace');
    vi.mocked(mcpService.startPolling).mockClear();

    manager.openPanel('mcp');

    expect(window.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'navigate', category: 'mcp' });
    expect(panel.reveal).toHaveBeenCalledWith(ViewColumn.One);
    expect(mcpService.startPolling).toHaveBeenCalledTimes(1);
  });

  it('打開非 MCP 頁時不啟動 polling', () => {
    const panel = createMockPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(panel as any);
    const { manager, mcpService } = createManager();

    manager.openPanel('plugin');

    expect(mcpService.startPolling).not.toHaveBeenCalled();
  });
});
