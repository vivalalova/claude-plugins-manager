import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter, env, Uri } from 'vscode';
import { SidebarViewProvider } from '../SidebarViewProvider';

const { getWebviewHtmlMock } = vi.hoisted(() => ({
  getWebviewHtmlMock: vi.fn(() => '<html>sidebar</html>'),
}));

vi.mock('../webviewHtml', () => ({
  getWebviewHtml: getWebviewHtmlMock,
}));

function createWebviewView() {
  let messageHandler: ((message: unknown) => void) | undefined;
  let disposeHandler: (() => void) | undefined;

  const webviewView = {
    webview: {
      options: undefined as unknown,
      html: '',
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn((handler: (message: unknown) => void) => {
        messageHandler = handler;
        return { dispose: vi.fn() };
      }),
    },
    onDidDispose: vi.fn((handler: () => void) => {
      disposeHandler = handler;
      return { dispose: vi.fn() };
    }),
  };

  return {
    webviewView,
    receiveMessage: (message: unknown) => messageHandler?.(message),
    dispose: () => disposeHandler?.(),
  };
}

describe('SidebarViewProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (env as { language?: string }).language = 'ja';
  });

  it('resolve 後 valid category message 直接打開對應 editor panel', () => {
    const mcpEmitter = new EventEmitter<unknown[]>();
    const editorManager = { openPanel: vi.fn() };
    const router = { handle: vi.fn() };
    const fileWatcherService = {
      onPluginFilesChanged: vi.fn(() => ({ dispose: vi.fn() })),
      onMarketplaceFilesChanged: vi.fn(() => ({ dispose: vi.fn() })),
    };
    const provider = new SidebarViewProvider(
      Uri.file('/extension') as never,
      editorManager as never,
      router as never,
      { onStatusChange: mcpEmitter } as never,
      fileWatcherService as never,
    );
    const { webviewView, receiveMessage } = createWebviewView();

    provider.resolveWebviewView(webviewView as never);
    receiveMessage({ type: 'sidebar.openCategory', category: 'plugin' });

    expect(editorManager.openPanel).toHaveBeenCalledWith('plugin');
    expect(router.handle).not.toHaveBeenCalled();
    expect(webviewView.webview.options).toEqual({
      enableScripts: true,
      localResourceRoots: [{ fsPath: '/extension/dist/webview' }],
    });
    expect(webviewView.webview.html).toBe('<html>sidebar</html>');
    expect(getWebviewHtmlMock).toHaveBeenCalledWith(
      webviewView.webview,
      { fsPath: '/extension' },
      'sidebar',
      'ja',
    );
  });

  it('非 sidebar 導航訊息會交給 router 並把 response 回傳給 webview', () => {
    const mcpEmitter = new EventEmitter<unknown[]>();
    const editorManager = { openPanel: vi.fn() };
    const router = {
      handle: vi.fn((message: unknown, respond: (response: unknown) => void) => {
        respond({ type: 'response', ok: true, original: message });
      }),
    };
    const fileWatcherService = {
      onPluginFilesChanged: vi.fn(() => ({ dispose: vi.fn() })),
      onMarketplaceFilesChanged: vi.fn(() => ({ dispose: vi.fn() })),
    };
    const provider = new SidebarViewProvider(
      Uri.file('/extension') as never,
      editorManager as never,
      router as never,
      { onStatusChange: mcpEmitter } as never,
      fileWatcherService as never,
    );
    const { webviewView, receiveMessage } = createWebviewView();

    provider.resolveWebviewView(webviewView as never);
    receiveMessage({ type: 'sidebar.openCategory', category: 'invalid' });

    expect(editorManager.openPanel).not.toHaveBeenCalled();
    expect(router.handle).toHaveBeenCalledOnce();
    expect(webviewView.webview.postMessage).toHaveBeenCalledWith({
      type: 'response',
      ok: true,
      original: { type: 'sidebar.openCategory', category: 'invalid' },
    });
  });

  it('push events 會轉發到目前的 sidebar webview，dispose 後停止轉發', () => {
    const mcpEmitter = new EventEmitter<unknown[]>();
    let onPluginFilesChanged: (() => void) | undefined;
    let onMarketplaceFilesChanged: (() => void) | undefined;
    const fileWatcherService = {
      onPluginFilesChanged: vi.fn((handler: () => void) => {
        onPluginFilesChanged = handler;
        return { dispose: vi.fn() };
      }),
      onMarketplaceFilesChanged: vi.fn((handler: () => void) => {
        onMarketplaceFilesChanged = handler;
        return { dispose: vi.fn() };
      }),
    };
    const provider = new SidebarViewProvider(
      Uri.file('/extension') as never,
      { openPanel: vi.fn() } as never,
      { handle: vi.fn() } as never,
      { onStatusChange: mcpEmitter } as never,
      fileWatcherService as never,
    );
    const { webviewView, dispose } = createWebviewView();

    provider.resolveWebviewView(webviewView as never);

    mcpEmitter.fire([{ name: 'server-a' }]);
    onPluginFilesChanged?.();
    onMarketplaceFilesChanged?.();

    expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'mcp.statusUpdate',
      servers: [{ name: 'server-a' }],
    });
    expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
      type: 'plugin.refresh',
    });
    expect(webviewView.webview.postMessage).toHaveBeenNthCalledWith(3, {
      type: 'marketplace.refresh',
    });

    dispose();
    mcpEmitter.fire([{ name: 'server-b' }]);

    expect(webviewView.webview.postMessage).toHaveBeenCalledTimes(3);
  });

  it('dispose 會釋放 constructor 建立的 push subscriptions', () => {
    const mcpEmitter = new EventEmitter<unknown[]>();
    const mcpDispose = vi.fn();
    const pluginDispose = vi.fn();
    const marketplaceDispose = vi.fn();
    const provider = new SidebarViewProvider(
      Uri.file('/extension') as never,
      { openPanel: vi.fn() } as never,
      { handle: vi.fn() } as never,
      {
        onStatusChange: {
          event: () => ({ dispose: mcpDispose }),
        },
      } as never,
      {
        onPluginFilesChanged: vi.fn(() => ({ dispose: pluginDispose })),
        onMarketplaceFilesChanged: vi.fn(() => ({ dispose: marketplaceDispose })),
      } as never,
    );

    provider.dispose();

    expect(mcpDispose).toHaveBeenCalledTimes(1);
    expect(pluginDispose).toHaveBeenCalledTimes(1);
    expect(marketplaceDispose).toHaveBeenCalledTimes(1);
    void mcpEmitter;
  });
});
