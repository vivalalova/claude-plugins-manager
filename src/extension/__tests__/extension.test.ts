import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands, window, mockWorkspaceFoldersChangeEmitter } from 'vscode';
import { COMMANDS } from '../constants';

const state = vi.hoisted(() => ({
  marketplaceHandlers: [] as Array<() => void>,
  pluginHandlers: [] as Array<() => void>,
  mcpHandlers: [] as Array<() => void>,
  editorOpenPanel: vi.fn(),
  editorDispose: vi.fn(),
  sidebarDispose: vi.fn(),
  mcpStartPolling: vi.fn(),
  mcpInvalidateMetadataCache: vi.fn(),
  mcpTriggerPoll: vi.fn(),
  mcpDispose: vi.fn(),
  settingsInvalidateScanCache: vi.fn(),
  fileWatcherDispose: vi.fn(),
  editorManagerInstance: null as null | { openPanel: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> },
  sidebarProviderInstance: null as null | { dispose: ReturnType<typeof vi.fn> },
}));

vi.mock('../services/CliService', () => ({
  CliService: vi.fn().mockImplementation(function CliServiceMock() {}),
}));

vi.mock('../services/MarketplaceService', () => ({
  MarketplaceService: vi.fn().mockImplementation(function MarketplaceServiceMock() {}),
}));

vi.mock('../services/SettingsFileService', () => ({
  SettingsFileService: vi.fn().mockImplementation(function SettingsFileServiceMock() {
    this.invalidateScanCache = state.settingsInvalidateScanCache;
    this.readPreferences = vi.fn();
    this.writePreference = vi.fn();
  }),
}));

vi.mock('../services/PluginService', () => ({
  PluginService: vi.fn().mockImplementation(function PluginServiceMock() {}),
}));

vi.mock('../services/TranslationService', () => ({
  TranslationService: vi.fn().mockImplementation(function TranslationServiceMock() {}),
}));

vi.mock('../services/McpService', () => ({
  McpService: vi.fn().mockImplementation(function McpServiceMock() {
    this.startPolling = state.mcpStartPolling;
    this.invalidateMetadataCache = state.mcpInvalidateMetadataCache;
    this.triggerPoll = state.mcpTriggerPoll;
    this.dispose = state.mcpDispose;
    this.onStatusChange = { event: vi.fn(() => ({ dispose: vi.fn() })) };
    this.onPollUnavailable = { event: vi.fn(() => ({ dispose: vi.fn() })) };
  }),
}));

vi.mock('../services/FileWatcherService', () => ({
  FileWatcherService: vi.fn().mockImplementation(function FileWatcherServiceMock() {
    this.onMarketplaceFilesChanged = vi.fn((handler: () => void) => {
      state.marketplaceHandlers.push(handler);
      return { dispose: vi.fn() };
    });
    this.onPluginFilesChanged = vi.fn((handler: () => void) => {
      state.pluginHandlers.push(handler);
      return { dispose: vi.fn() };
    });
    this.onMcpFilesChanged = vi.fn((handler: () => void) => {
      state.mcpHandlers.push(handler);
      return { dispose: vi.fn() };
    });
    this.dispose = state.fileWatcherDispose;
  }),
}));

vi.mock('../messaging/MessageRouter', () => ({
  MessageRouter: vi.fn().mockImplementation(function MessageRouterMock() {
    this.handle = vi.fn();
  }),
}));

vi.mock('../providers/EditorPanelManager', () => ({
  EditorPanelManager: vi.fn().mockImplementation(function EditorPanelManagerMock() {
    this.openPanel = state.editorOpenPanel;
    this.dispose = state.editorDispose;
    state.editorManagerInstance = this;
  }),
}));

vi.mock('../providers/SidebarViewProvider', () => {
  const SidebarViewProvider = vi.fn().mockImplementation(function SidebarViewProviderMock() {
    this.dispose = state.sidebarDispose;
    state.sidebarProviderInstance = this;
  });
  (SidebarViewProvider as unknown as { viewType: string }).viewType = 'mock.sidebar.view';
  return { SidebarViewProvider };
});

import { activate } from '../extension';

describe('activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceFoldersChangeEmitter.dispose();
    state.marketplaceHandlers.length = 0;
    state.pluginHandlers.length = 0;
    state.mcpHandlers.length = 0;
    state.editorManagerInstance = null;
    state.sidebarProviderInstance = null;
    window.registerWebviewViewProvider.mockReturnValue({ dispose: vi.fn() });
    commands.registerCommand.mockImplementation(() => ({ dispose: vi.fn() }));
  });

  it('註冊 sidebar、commands，並把檔案/ workspace 事件綁到對應服務', () => {
    const context = {
      extensionUri: { fsPath: '/extension' },
      subscriptions: [] as Array<{ dispose?: () => void }>,
    };

    activate(context as never);

    expect(window.registerWebviewViewProvider).toHaveBeenCalledWith(
      'mock.sidebar.view',
      state.sidebarProviderInstance,
    );
    expect(commands.registerCommand).toHaveBeenCalledTimes(5);
    expect(context.subscriptions).toHaveLength(11);

    const commandCalls = commands.registerCommand.mock.calls;
    commandCalls.find(([id]) => id === COMMANDS.openMarketplace)?.[1]();
    commandCalls.find(([id]) => id === COMMANDS.openPlugin)?.[1]();
    commandCalls.find(([id]) => id === COMMANDS.openMcp)?.[1]();

    expect(state.editorOpenPanel).toHaveBeenNthCalledWith(1, 'marketplace');
    expect(state.editorOpenPanel).toHaveBeenNthCalledWith(2, 'plugin');
    expect(state.editorOpenPanel).toHaveBeenNthCalledWith(3, 'mcp');

    state.marketplaceHandlers[0]();
    state.pluginHandlers[0]();
    state.mcpHandlers[0]();
    mockWorkspaceFoldersChangeEmitter.fire();

    expect(state.settingsInvalidateScanCache).toHaveBeenCalledTimes(1);
    expect(state.mcpInvalidateMetadataCache).toHaveBeenCalledTimes(3);
    expect(state.mcpTriggerPoll).toHaveBeenCalledTimes(2);
  });

  it('subscriptions 內的 cleanup disposable 會釋放 manager/provider/service/fileWatcher', () => {
    const context = {
      extensionUri: { fsPath: '/extension' },
      subscriptions: [] as Array<{ dispose?: () => void }>,
    };

    activate(context as never);

    for (const disposable of context.subscriptions) {
      disposable.dispose?.();
    }

    expect(state.editorDispose).toHaveBeenCalledTimes(1);
    expect(state.sidebarDispose).toHaveBeenCalledTimes(1);
    expect(state.mcpDispose).toHaveBeenCalledTimes(1);
    expect(state.fileWatcherDispose).toHaveBeenCalledTimes(1);
  });

  it('workspace folder listener 會加入 subscriptions，dispose 後不再觸發 mcp cache invalidate', () => {
    const context = {
      extensionUri: { fsPath: '/extension' },
      subscriptions: [] as Array<{ dispose?: () => void }>,
    };

    activate(context as never);

    expect(context.subscriptions).toHaveLength(11);

    for (const disposable of context.subscriptions) {
      disposable.dispose?.();
    }

    mockWorkspaceFoldersChangeEmitter.fire();

    expect(state.mcpInvalidateMetadataCache).not.toHaveBeenCalled();
  });
});
