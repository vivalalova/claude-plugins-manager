/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';

/* ── Mock vscode bridge ── */
const { mockSendRequest, mockOnPushMessage, mockPostMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
  mockPostMessage: vi.fn(),
}));
vi.mock('../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
  postMessage: mockPostMessage,
  getViewState: (_key: string, fallback: unknown) => fallback,
  setViewState: () => {},
}));

import { SidebarApp } from '../SidebarApp';
import type { Marketplace, PluginListResponse, McpServer, InstalledPlugin, AvailablePlugin } from '../../../shared/types';

function makeMarketplaces(count: number): Marketplace[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `marketplace-${i}`,
    source: 'github' as const,
    repo: `owner/marketplace-${i}`,
    installLocation: `/home/.claude/plugins/marketplaces/marketplace-${i}`,
    autoUpdate: true,
  }));
}

function makeInstalled(name: string, mp: string, lastUpdated = '2026-01-01T00:00:00Z'): InstalledPlugin {
  return {
    id: `${name}@${mp}`,
    version: '1.0.0',
    scope: 'user',
    enabled: true,
    installPath: `/path/${name}`,
    installedAt: '2026-01-01T00:00:00Z',
    lastUpdated,
  };
}

function makeAvailable(name: string, mp: string, lastUpdated?: string): AvailablePlugin {
  return {
    pluginId: `${name}@${mp}`,
    name,
    description: `${name} desc`,
    marketplaceName: mp,
    lastUpdated,
  };
}

/** installed/available 同時間戳 → hasPluginUpdate=false → 只顯示 count badge，不顯示 update badge */
function makePluginListResponse(installedCount: number): PluginListResponse {
  return {
    installed: Array.from({ length: installedCount }, (_, i) => makeInstalled(`plugin-${i}`, 'mp')),
    available: Array.from({ length: installedCount }, (_, i) => makeAvailable(`plugin-${i}`, 'mp', '2026-01-01T00:00:00Z')),
    marketplaceSources: {},
  };
}

function makeMcpServers(count: number): McpServer[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `server-${i}`,
    fullName: `server-${i}`,
    command: `cmd-${i}`,
    status: 'connected' as const,
  }));
}

function setupMocks(opts: {
  marketplaces?: Marketplace[];
  plugins?: PluginListResponse;
  mcpServers?: McpServer[];
} = {}) {
  mockSendRequest.mockImplementation(async (req: { type: string }) => {
    if (req.type === 'marketplace.list') return opts.marketplaces ?? [];
    if (req.type === 'plugin.listAvailable') return opts.plugins ?? { installed: [], available: [], marketplaceSources: {} };
    if (req.type === 'mcp.list') return opts.mcpServers ?? [];
    return undefined;
  });
}

describe('SidebarApp badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('顯示三個分類的正確 badge 數字', async () => {
    setupMocks({
      marketplaces: makeMarketplaces(3),
      plugins: makePluginListResponse(5),
      mcpServers: makeMcpServers(2),
    });

    render(<SidebarApp />);

    await waitFor(() => {
      const badges = document.querySelectorAll('.sidebar-button-badge');
      expect(badges).toHaveLength(3);
    });

    const badges = document.querySelectorAll('.sidebar-button-badge');
    expect(badges[0].textContent).toBe('3');
    expect(badges[1].textContent).toBe('5');
    expect(badges[2].textContent).toBe('2');
  });

  it('count 為 0 時不顯示 badge', async () => {
    setupMocks({
      marketplaces: [],
      plugins: makePluginListResponse(0),
      mcpServers: [],
    });

    render(<SidebarApp />);

    // 等待 fetch 完成
    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledTimes(3);
    });

    const badges = document.querySelectorAll('.sidebar-button-badge');
    expect(badges).toHaveLength(0);
  });

  it('載入中不顯示 badge（避免 flicker）', () => {
    // sendRequest 永遠不 resolve → 保持 loading 狀態
    mockSendRequest.mockReturnValue(new Promise(() => {}));

    render(<SidebarApp />);

    const badges = document.querySelectorAll('.sidebar-button-badge');
    expect(badges).toHaveLength(0);
  });

  it('push message 觸發 badge 更新', async () => {
    setupMocks({
      marketplaces: makeMarketplaces(1),
      plugins: makePluginListResponse(1),
      mcpServers: makeMcpServers(1),
    });

    // 捕獲 push handler
    let pushHandler: (msg: { type: string; [key: string]: unknown }) => void = () => {};
    mockOnPushMessage.mockImplementation((handler: typeof pushHandler) => {
      pushHandler = handler;
      return () => {};
    });

    render(<SidebarApp />);

    await waitFor(() => {
      const badges = document.querySelectorAll('.sidebar-button-badge');
      expect(badges).toHaveLength(3);
    });

    // 模擬 marketplace 變更 → 重新 fetch 返回更多
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'marketplace.list') return makeMarketplaces(5);
      if (req.type === 'plugin.listAvailable') return makePluginListResponse(1);
      if (req.type === 'mcp.list') return makeMcpServers(1);
      return undefined;
    });

    await act(async () => {
      pushHandler({ type: 'marketplace.refresh' });
    });

    await waitFor(() => {
      const badges = document.querySelectorAll('.sidebar-button-badge');
      const marketplaceBadge = badges[0];
      expect(marketplaceBadge.textContent).toBe('5');
    });
  });

  it('mcp.statusUpdate push 直接用 payload 更新 badge', async () => {
    setupMocks({
      marketplaces: [],
      plugins: makePluginListResponse(0),
      mcpServers: makeMcpServers(2),
    });

    let pushHandler: (msg: { type: string; [key: string]: unknown }) => void = () => {};
    mockOnPushMessage.mockImplementation((handler: typeof pushHandler) => {
      pushHandler = handler;
      return () => {};
    });

    render(<SidebarApp />);

    await waitFor(() => {
      const badges = document.querySelectorAll('.sidebar-button-badge');
      expect(badges).toHaveLength(1); // 只有 mcp 有 badge（count=2）
    });

    // mcp.statusUpdate 帶 servers payload
    await act(async () => {
      pushHandler({
        type: 'mcp.statusUpdate',
        servers: makeMcpServers(4),
      });
    });

    await waitFor(() => {
      const mcpBadge = document.querySelectorAll('.sidebar-button-badge');
      // marketplace=0 不顯示, plugins=0 不顯示, mcp=4 顯示
      expect(mcpBadge).toHaveLength(1);
      expect(mcpBadge[0].textContent).toBe('4');
    });
  });

  it('plugin.refresh push 重新 fetch 更新 badge', async () => {
    setupMocks({
      marketplaces: [],
      plugins: makePluginListResponse(3),
      mcpServers: [],
    });

    let pushHandler: (msg: { type: string; [key: string]: unknown }) => void = () => {};
    mockOnPushMessage.mockImplementation((handler: typeof pushHandler) => {
      pushHandler = handler;
      return () => {};
    });

    render(<SidebarApp />);

    await waitFor(() => {
      const badges = document.querySelectorAll('.sidebar-button-badge');
      expect(badges).toHaveLength(1); // 只有 plugin badge
      expect(badges[0].textContent).toBe('3');
    });

    // 更新 mock 回傳值
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'marketplace.list') return [];
      if (req.type === 'plugin.listAvailable') return makePluginListResponse(7);
      if (req.type === 'mcp.list') return [];
      return undefined;
    });

    await act(async () => {
      pushHandler({ type: 'plugin.refresh' });
    });

    await waitFor(() => {
      const badges = document.querySelectorAll('.sidebar-button-badge');
      expect(badges).toHaveLength(1);
      expect(badges[0].textContent).toBe('7');
    });
  });

  it('全部 fetch 失敗時不顯示 badge', async () => {
    mockSendRequest.mockRejectedValue(new Error('network error'));

    render(<SidebarApp />);

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledTimes(3);
    });

    const badges = document.querySelectorAll('.sidebar-button-badge');
    expect(badges).toHaveLength(0);
  });

  it('部分 fetch 失敗時仍顯示成功的 badge', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'marketplace.list') return makeMarketplaces(3);
      if (req.type === 'plugin.listAvailable') throw new Error('timeout');
      if (req.type === 'mcp.list') return makeMcpServers(2);
      return undefined;
    });

    render(<SidebarApp />);

    await waitFor(() => {
      const badges = document.querySelectorAll('.sidebar-button-badge');
      expect(badges).toHaveLength(2); // marketplace=3, mcp=2; plugin 失敗=0
    });

    const badges = document.querySelectorAll('.sidebar-button-badge');
    expect(badges[0].textContent).toBe('3');
    expect(badges[1].textContent).toBe('2');
  });

  it('mcp.statusUpdate 在初始 fetch 前到達時建立 counts', async () => {
    // 讓 fetch 永遠不完成
    mockSendRequest.mockReturnValue(new Promise(() => {}));

    let pushHandler: (msg: { type: string; [key: string]: unknown }) => void = () => {};
    mockOnPushMessage.mockImplementation((handler: typeof pushHandler) => {
      pushHandler = handler;
      return () => {};
    });

    render(<SidebarApp />);

    // counts 是 null，mcp.statusUpdate 應該建立完整 counts
    await act(async () => {
      pushHandler({
        type: 'mcp.statusUpdate',
        servers: makeMcpServers(3),
      });
    });

    await waitFor(() => {
      const badges = document.querySelectorAll('.sidebar-button-badge');
      expect(badges).toHaveLength(1);
      expect(badges[0].textContent).toBe('3');
    });
  });

  it('component unmount 時 unsubscribe push handler', () => {
    const unsubscribe = vi.fn();
    mockOnPushMessage.mockReturnValue(unsubscribe);
    setupMocks();

    const { unmount } = render(<SidebarApp />);
    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  describe('plugin update badge', () => {
    it('3 個 plugin 有更新 → 顯示 update badge "3"', async () => {
      setupMocks({
        plugins: {
          installed: [
            makeInstalled('a', 'mp', '2026-01-01T00:00:00Z'),
            makeInstalled('b', 'mp', '2026-01-01T00:00:00Z'),
            makeInstalled('c', 'mp', '2026-01-01T00:00:00Z'),
          ],
          available: [
            makeAvailable('a', 'mp', '2026-02-01T00:00:00Z'),
            makeAvailable('b', 'mp', '2026-02-01T00:00:00Z'),
            makeAvailable('c', 'mp', '2026-02-01T00:00:00Z'),
          ],
          marketplaceSources: {},
        },
      });

      render(<SidebarApp />);

      await waitFor(() => {
        const updateBadge = document.querySelector('.sidebar-update-badge');
        expect(updateBadge).toBeTruthy();
        expect(updateBadge!.textContent).toBe('3');
      });
    });

    it('沒有更新 → 不顯示 update badge，顯示一般 count badge', async () => {
      setupMocks({
        plugins: {
          installed: [
            makeInstalled('a', 'mp', '2026-01-01T00:00:00Z'),
            makeInstalled('b', 'mp', '2026-01-01T00:00:00Z'),
          ],
          available: [
            makeAvailable('a', 'mp', '2026-01-01T00:00:00Z'),
            makeAvailable('b', 'mp', '2026-01-01T00:00:00Z'),
          ],
          marketplaceSources: {},
        },
      });

      render(<SidebarApp />);

      await waitFor(() => {
        const countBadges = document.querySelectorAll('.sidebar-button-badge');
        expect(countBadges.length).toBeGreaterThan(0);
      });

      expect(document.querySelector('.sidebar-update-badge')).toBeNull();
      // plugin count badge 應顯示 "2"
      const pluginButton = screen.getByText('Plugins').closest('.sidebar-button')!;
      const countBadge = pluginButton.querySelector('.sidebar-button-badge');
      expect(countBadge!.textContent).toBe('2');
    });

    it('update badge 優先於 count badge（有更新時不顯示 count badge）', async () => {
      setupMocks({
        plugins: {
          installed: [
            makeInstalled('a', 'mp', '2026-01-01T00:00:00Z'),
            makeInstalled('b', 'mp', '2026-01-01T00:00:00Z'),
          ],
          available: [
            makeAvailable('a', 'mp', '2026-02-01T00:00:00Z'),
            makeAvailable('b', 'mp', '2026-01-01T00:00:00Z'),
          ],
          marketplaceSources: {},
        },
      });

      render(<SidebarApp />);

      await waitFor(() => {
        const updateBadge = document.querySelector('.sidebar-update-badge');
        expect(updateBadge).toBeTruthy();
        expect(updateBadge!.textContent).toBe('1');
      });

      // Plugin 行不應同時顯示 count badge
      const pluginButton = screen.getByText('Plugins').closest('.sidebar-button')!;
      expect(pluginButton.querySelector('.sidebar-button-badge')).toBeNull();
    });

    it('plugin.refresh 後 update count 更新', async () => {
      // 初始：1 個有更新
      const initialPlugins: PluginListResponse = {
        installed: [makeInstalled('a', 'mp', '2026-01-01T00:00:00Z')],
        available: [makeAvailable('a', 'mp', '2026-02-01T00:00:00Z')],
        marketplaceSources: {},
      };
      setupMocks({ plugins: initialPlugins });

      let pushHandler: (msg: { type: string; [key: string]: unknown }) => void = () => {};
      mockOnPushMessage.mockImplementation((handler: typeof pushHandler) => {
        pushHandler = handler;
        return () => {};
      });

      render(<SidebarApp />);

      await waitFor(() => {
        expect(document.querySelector('.sidebar-update-badge')?.textContent).toBe('1');
      });

      // 更新後：plugin 已更新，沒有 pending updates
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
        if (req.type === 'marketplace.list') return [];
        if (req.type === 'plugin.listAvailable') return {
          installed: [makeInstalled('a', 'mp', '2026-02-01T00:00:00Z')],
          available: [makeAvailable('a', 'mp', '2026-02-01T00:00:00Z')],
          marketplaceSources: {},
        };
        if (req.type === 'mcp.list') return [];
        return undefined;
      });

      await act(async () => {
        pushHandler({ type: 'plugin.refresh' });
      });

      await waitFor(() => {
        expect(document.querySelector('.sidebar-update-badge')).toBeNull();
      });
    });
  });
});
