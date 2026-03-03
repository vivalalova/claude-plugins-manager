/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { AvailablePlugin, InstalledPlugin, PluginListResponse } from '../../../../../shared/types';

const { mockSendRequest, mockOnPushMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(),
}));

vi.mock('../../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
}));

import { usePluginData } from '../usePluginData';

function makeInstalled(name: string, marketplaceName: string, scope: InstalledPlugin['scope']): InstalledPlugin {
  return {
    id: `${name}@${marketplaceName}`,
    version: '1.0.0',
    scope,
    enabled: true,
    installPath: `/plugins/${name}`,
    installedAt: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-01-01T00:00:00Z',
    description: `${name} installed`,
  };
}

function makeAvailable(name: string, marketplaceName: string, extra?: Partial<AvailablePlugin>): AvailablePlugin {
  return {
    pluginId: `${name}@${marketplaceName}`,
    name,
    description: `${name} available`,
    marketplaceName,
    ...extra,
  };
}

describe('usePluginData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnPushMessage.mockImplementation(() => () => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('初始載入會合併 plugin、按名稱排序並載入 workspace 資訊', async () => {
    mockSendRequest.mockImplementation(async (request: { type: string }) => {
      if (request.type === 'plugin.listAvailable') {
        return {
          installed: [makeInstalled('beta', 'mp', 'user')],
          available: [
            makeAvailable('beta', 'mp', { description: 'beta merged description' }),
            makeAvailable('alpha', 'mp'),
          ],
          marketplaceSources: { mp: 'https://example.com/mp.git' },
        } satisfies PluginListResponse;
      }
      if (request.type === 'workspace.getFolders') {
        return [{ name: 'workspace-a', path: '/workspace/a' }];
      }
      throw new Error(`unexpected request: ${request.type}`);
    });

    const { result } = renderHook(() => usePluginData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.plugins.map((plugin) => plugin.id)).toEqual(['alpha@mp', 'beta@mp']);
    expect(result.current.plugins[1].description).toBe('beta merged description');
    expect(result.current.workspaceFolders).toEqual([{ name: 'workspace-a', path: '/workspace/a' }]);
    expect(result.current.marketplaceSources).toEqual({ mp: 'https://example.com/mp.git' });
    expect(mockOnPushMessage).toHaveBeenCalledOnce();
  });

  it('收到 plugin.refresh push message 會靜默刷新列表', async () => {
    let pushHandler: ((message: { type: string }) => void) | undefined;
    let fetchCount = 0;
    mockOnPushMessage.mockImplementation((handler: (message: { type: string }) => void) => {
      pushHandler = handler;
      return () => {};
    });
    mockSendRequest.mockImplementation(async (request: { type: string }) => {
      if (request.type === 'plugin.listAvailable') {
        fetchCount++;
        return {
          installed: [],
          available: fetchCount === 1
            ? [makeAvailable('alpha', 'mp')]
            : [makeAvailable('beta', 'mp')],
          marketplaceSources: {},
        } satisfies PluginListResponse;
      }
      if (request.type === 'workspace.getFolders') {
        return [];
      }
      throw new Error(`unexpected request: ${request.type}`);
    });

    const { result } = renderHook(() => usePluginData());

    await waitFor(() => {
      expect(result.current.plugins.map((plugin) => plugin.id)).toEqual(['alpha@mp']);
    });
    expect(result.current.loading).toBe(false);

    await act(async () => {
      pushHandler?.({ type: 'plugin.refresh' });
    });

    await waitFor(() => {
      expect(result.current.plugins.map((plugin) => plugin.id)).toEqual(['beta@mp']);
    });
    expect(result.current.loading).toBe(false);
    expect(mockSendRequest.mock.calls.filter(([request]) => (request as { type: string }).type === 'plugin.listAvailable')).toHaveLength(2);
  });

  it('初始拉取失敗時回報 error 並結束 loading', async () => {
    mockSendRequest.mockImplementation(async (request: { type: string }) => {
      if (request.type === 'plugin.listAvailable') {
        throw new Error('network down');
      }
      if (request.type === 'workspace.getFolders') {
        return [];
      }
      throw new Error(`unexpected request: ${request.type}`);
    });

    const { result } = renderHook(() => usePluginData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.plugins).toEqual([]);
    expect(result.current.error).toBe('network down');
  });
});
