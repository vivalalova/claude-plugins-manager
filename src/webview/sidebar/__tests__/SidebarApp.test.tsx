/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../__test-utils__/renderWithProviders';
import { screen, waitFor, cleanup, act } from '@testing-library/react';

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
import type { PluginListResponse, McpServer, InstalledPlugin, AvailablePlugin } from '../../../shared/types';

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

function makeMcpServers(count: number, status: McpServer['status'] = 'connected'): McpServer[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `server-${i}`,
    fullName: `server-${i}`,
    command: `cmd-${i}`,
    status,
  }));
}

function setupMocks(opts: {
  plugins?: PluginListResponse;
  mcpServers?: McpServer[];
} = {}) {
  mockSendRequest.mockImplementation(async (req: { type: string }) => {
    if (req.type === 'plugin.listAvailable') return opts.plugins ?? { installed: [], available: [], marketplaceSources: {} };
    if (req.type === 'mcp.list') return opts.mcpServers ?? [];
    return undefined;
  });
}

describe('SidebarApp attention badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('沒有需要注意的項目時不顯示任何 badge', async () => {
    setupMocks({
      plugins: {
        installed: [makeInstalled('a', 'mp')],
        available: [makeAvailable('a', 'mp', '2026-01-01T00:00:00Z')],
        marketplaceSources: {},
      },
      mcpServers: makeMcpServers(3, 'connected'),
    });

    renderWithI18n(<SidebarApp />);

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledTimes(2);
    });

    expect(document.querySelectorAll('.sidebar-update-badge')).toHaveLength(0);
    expect(document.querySelectorAll('.sidebar-button-badge')).toHaveLength(0);
  });

  it('載入中不顯示 badge（避免 flicker）', () => {
    mockSendRequest.mockReturnValue(new Promise(() => {}));

    renderWithI18n(<SidebarApp />);

    expect(document.querySelectorAll('.sidebar-update-badge')).toHaveLength(0);
  });

  it('全部 fetch 失敗時不顯示 badge', async () => {
    mockSendRequest.mockRejectedValue(new Error('network error'));

    renderWithI18n(<SidebarApp />);

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledTimes(2);
    });

    expect(document.querySelectorAll('.sidebar-update-badge')).toHaveLength(0);
  });

  it('plugin update badge 顯示（有更新時）', async () => {
    setupMocks({
      plugins: {
        installed: [makeInstalled('a', 'mp', '2026-01-01T00:00:00Z')],
        available: [makeAvailable('a', 'mp', '2026-02-01T00:00:00Z')],
        marketplaceSources: {},
      },
    });

    renderWithI18n(<SidebarApp />);

    await waitFor(() => {
      expect(document.querySelectorAll('.sidebar-update-badge')).toHaveLength(1);
    });

    const pluginButton = screen.getByText('Plugins').closest('.sidebar-button')!;
    expect(pluginButton.querySelector('.sidebar-update-badge')).toBeTruthy();
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

      renderWithI18n(<SidebarApp />);

      await waitFor(() => {
        const pluginButton = screen.getByText('Plugins').closest('.sidebar-button')!;
        const badge = pluginButton.querySelector('.sidebar-update-badge');
        expect(badge).toBeTruthy();
        expect(badge!.textContent).toBe('3');
      });
    });

    it('沒有更新 → 不顯示任何 badge（不再 fallback 到總數）', async () => {
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

      renderWithI18n(<SidebarApp />);

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledTimes(2);
      });

      const pluginButton = screen.getByText('Plugins').closest('.sidebar-button')!;
      expect(pluginButton.querySelector('.sidebar-update-badge')).toBeNull();
      expect(pluginButton.querySelector('.sidebar-button-badge')).toBeNull();
    });

    it('plugin.refresh 後 update count 更新', async () => {
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

      renderWithI18n(<SidebarApp />);

      await waitFor(() => {
        expect(document.querySelector('.sidebar-update-badge')?.textContent).toBe('1');
      });

      // 更新後：plugin 已更新，沒有 pending updates
      mockSendRequest.mockImplementation(async (req: { type: string }) => {
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

  describe('MCP issue badge', () => {
    it('2 個 failed server → 顯示 badge "2"', async () => {
      setupMocks({
        mcpServers: [
          ...makeMcpServers(2, 'failed'),
          ...makeMcpServers(3, 'connected'),
        ],
      });

      renderWithI18n(<SidebarApp />);

      await waitFor(() => {
        const mcpButton = screen.getByText('MCP Servers').closest('.sidebar-button')!;
        const badge = mcpButton.querySelector('.sidebar-update-badge');
        expect(badge).toBeTruthy();
        expect(badge!.textContent).toBe('2');
      });
    });

    it('needs-auth server 也計入 badge', async () => {
      setupMocks({
        mcpServers: [
          { name: 's1', fullName: 's1', command: 'cmd', status: 'needs-auth' },
          { name: 's2', fullName: 's2', command: 'cmd', status: 'failed' },
          { name: 's3', fullName: 's3', command: 'cmd', status: 'connected' },
        ],
      });

      renderWithI18n(<SidebarApp />);

      await waitFor(() => {
        const mcpButton = screen.getByText('MCP Servers').closest('.sidebar-button')!;
        const badge = mcpButton.querySelector('.sidebar-update-badge');
        expect(badge!.textContent).toBe('2');
      });
    });

    it('全部 connected → 不顯示 badge', async () => {
      setupMocks({
        mcpServers: makeMcpServers(5, 'connected'),
      });

      renderWithI18n(<SidebarApp />);

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledTimes(2);
      });

      const mcpButton = screen.getByText('MCP Servers').closest('.sidebar-button')!;
      expect(mcpButton.querySelector('.sidebar-update-badge')).toBeNull();
    });

    it('mcp.statusUpdate push 更新 issue badge', async () => {
      setupMocks({
        mcpServers: makeMcpServers(2, 'connected'),
      });

      let pushHandler: (msg: { type: string; [key: string]: unknown }) => void = () => {};
      mockOnPushMessage.mockImplementation((handler: typeof pushHandler) => {
        pushHandler = handler;
        return () => {};
      });

      renderWithI18n(<SidebarApp />);

      await waitFor(() => {
        expect(mockSendRequest).toHaveBeenCalledTimes(2);
      });

      // 初始無 issue badge
      expect(document.querySelectorAll('.sidebar-update-badge')).toHaveLength(0);

      // push 2 個 failed server
      await act(async () => {
        pushHandler({
          type: 'mcp.statusUpdate',
          servers: [
            { name: 's1', fullName: 's1', command: 'cmd', status: 'failed' },
            { name: 's2', fullName: 's2', command: 'cmd', status: 'connected' },
          ],
        });
      });

      await waitFor(() => {
        const mcpButton = screen.getByText('MCP Servers').closest('.sidebar-button')!;
        const badge = mcpButton.querySelector('.sidebar-update-badge');
        expect(badge).toBeTruthy();
        expect(badge!.textContent).toBe('1');
      });
    });

    it('mcp.statusUpdate 在初始 fetch 前到達時建立 attention', async () => {
      mockSendRequest.mockReturnValue(new Promise(() => {}));

      let pushHandler: (msg: { type: string; [key: string]: unknown }) => void = () => {};
      mockOnPushMessage.mockImplementation((handler: typeof pushHandler) => {
        pushHandler = handler;
        return () => {};
      });

      renderWithI18n(<SidebarApp />);

      await act(async () => {
        pushHandler({
          type: 'mcp.statusUpdate',
          servers: [
            { name: 's1', fullName: 's1', command: 'cmd', status: 'failed' },
            { name: 's2', fullName: 's2', command: 'cmd', status: 'failed' },
          ],
        });
      });

      await waitFor(() => {
        const badges = document.querySelectorAll('.sidebar-update-badge');
        expect(badges).toHaveLength(1);
        expect(badges[0].textContent).toBe('2');
      });
    });
  });

  it('push message 觸發重新 fetch', async () => {
    setupMocks({
      plugins: {
        installed: [makeInstalled('a', 'mp', '2026-01-01T00:00:00Z')],
        available: [makeAvailable('a', 'mp', '2026-02-01T00:00:00Z')],
        marketplaceSources: {},
      },
    });

    let pushHandler: (msg: { type: string; [key: string]: unknown }) => void = () => {};
    mockOnPushMessage.mockImplementation((handler: typeof pushHandler) => {
      pushHandler = handler;
      return () => {};
    });

    renderWithI18n(<SidebarApp />);

    await waitFor(() => {
      expect(document.querySelector('.sidebar-update-badge')?.textContent).toBe('1');
    });

    // marketplace.refresh 也觸發 re-fetch
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'plugin.listAvailable') return {
        installed: [
          makeInstalled('a', 'mp', '2026-01-01T00:00:00Z'),
          makeInstalled('b', 'mp', '2026-01-01T00:00:00Z'),
        ],
        available: [
          makeAvailable('a', 'mp', '2026-02-01T00:00:00Z'),
          makeAvailable('b', 'mp', '2026-02-01T00:00:00Z'),
        ],
        marketplaceSources: {},
      };
      if (req.type === 'mcp.list') return [];
      return undefined;
    });

    await act(async () => {
      pushHandler({ type: 'marketplace.refresh' });
    });

    await waitFor(() => {
      expect(document.querySelector('.sidebar-update-badge')?.textContent).toBe('2');
    });
  });

  it('部分 fetch 失敗時仍顯示成功的 badge', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'plugin.listAvailable') throw new Error('timeout');
      if (req.type === 'mcp.list') return [
        { name: 's1', fullName: 's1', command: 'cmd', status: 'failed' },
        { name: 's2', fullName: 's2', command: 'cmd', status: 'connected' },
      ];
      return undefined;
    });

    renderWithI18n(<SidebarApp />);

    await waitFor(() => {
      const badges = document.querySelectorAll('.sidebar-update-badge');
      expect(badges).toHaveLength(1);
      expect(badges[0].textContent).toBe('1'); // 1 failed MCP server
    });
  });

  it('component unmount 時 unsubscribe push handler', () => {
    const unsubscribe = vi.fn();
    mockOnPushMessage.mockReturnValue(unsubscribe);
    setupMocks();

    const { unmount } = renderWithI18n(<SidebarApp />);
    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
