/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { AvailablePlugin, EnabledPluginsMap, InstalledPlugin, PluginListResponse, PluginScope } from '../../../../../shared/types';

const { mockSendRequest, mockOnPushMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(),
}));

vi.mock('../../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
}));

import { usePluginData, mergePlugins } from '../usePluginData';

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

  it('較舊的 fetchAll 結果晚到時，不得覆寫較新的列表', async () => {
    let resolveFirst: ((value: PluginListResponse) => void) | undefined;
    let resolveSecond: ((value: PluginListResponse) => void) | undefined;
    let requestCount = 0;

    mockSendRequest.mockImplementation((request: { type: string }) => {
      if (request.type === 'plugin.listAvailable') {
        requestCount++;
        return new Promise<PluginListResponse>((resolve) => {
          if (requestCount === 1) resolveFirst = resolve;
          else resolveSecond = resolve;
        });
      }
      if (request.type === 'workspace.getFolders') {
        return Promise.resolve([]);
      }
      throw new Error(`unexpected request: ${request.type}`);
    });

    const { result } = renderHook(() => usePluginData());

    await act(async () => {
      void result.current.fetchAll(false);
    });

    await act(async () => {
      resolveSecond?.({
        installed: [],
        available: [makeAvailable('fresh', 'mp')],
        marketplaceSources: { mp: 'fresh-source' },
      });
    });

    await waitFor(() => {
      expect(result.current.plugins.map((plugin) => plugin.id)).toEqual(['fresh@mp']);
    });

    await act(async () => {
      resolveFirst?.({
        installed: [],
        available: [makeAvailable('stale', 'mp')],
        marketplaceSources: { mp: 'stale-source' },
      });
    });

    await waitFor(() => {
      expect(result.current.plugins.map((plugin) => plugin.id)).toEqual(['fresh@mp']);
      expect(result.current.marketplaceSources).toEqual({ mp: 'fresh-source' });
    });
  });

  it('workspace.getFolders 初次失敗後，可由後續 fetchAll 重試恢復', async () => {
    let workspaceShouldFail = true;

    mockSendRequest.mockImplementation(async (request: { type: string }) => {
      if (request.type === 'plugin.listAvailable') {
        return {
          installed: [],
          available: [makeAvailable('alpha', 'mp')],
          marketplaceSources: {},
        } satisfies PluginListResponse;
      }
      if (request.type === 'workspace.getFolders') {
        if (workspaceShouldFail) {
          throw new Error('temporary host error');
        }
        return [{ name: 'workspace-a', path: '/workspace/a' }];
      }
      throw new Error(`unexpected request: ${request.type}`);
    });

    const { result } = renderHook(() => usePluginData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.workspaceFolders).toEqual([]);

    workspaceShouldFail = false;

    await act(async () => {
      await result.current.fetchAll(false);
    });

    await waitFor(() => {
      expect(result.current.workspaceFolders).toEqual([{ name: 'workspace-a', path: '/workspace/a' }]);
    });
  });
});

/* ── mergePlugins with enabledByScope ── */

function makeEnabledByScope(
  overrides?: Partial<Record<PluginScope, EnabledPluginsMap>>,
): Record<PluginScope, EnabledPluginsMap> {
  return { user: {}, project: {}, local: {}, ...overrides };
}

describe('mergePlugins — enabledByScope', () => {
  it('enabledPlugins 有 plugin 但 installed 沒有 → settingsEnabledScopes 包含該 scope', () => {
    const result = mergePlugins(
      [],
      [makeAvailable('autofix-bot', 'mp', { sourceUrl: 'https://github.com/org/repo' })],
      makeEnabledByScope({ user: { 'autofix-bot@mp': true } }),
    );
    const plugin = result.find((p) => p.id === 'autofix-bot@mp')!;
    expect(plugin.settingsEnabledScopes).toContain('user');
  });

  it('多 scope 啟用 — installed 只有 user，project 靠 enabledByScope 補齊', () => {
    const result = mergePlugins(
      [makeInstalled('bot', 'mp', 'user')],
      [makeAvailable('bot', 'mp')],
      makeEnabledByScope({
        user: { 'bot@mp': true },
        project: { 'bot@mp': true },
      }),
    );
    const plugin = result.find((p) => p.id === 'bot@mp')!;
    expect(plugin.settingsEnabledScopes).toContain('user');
    expect(plugin.settingsEnabledScopes).toContain('project');
    expect(plugin.userInstall?.enabled).toBe(true);
  });

  it('enabledByScope 未提供 → settingsEnabledScopes 不存在（向後相容）', () => {
    const result = mergePlugins([], [makeAvailable('alpha', 'mp')]);
    expect(result[0].settingsEnabledScopes).toBeUndefined();
  });

  it('plugin 不在 enabledPlugins 中 → settingsEnabledScopes 不存在', () => {
    const result = mergePlugins(
      [],
      [makeAvailable('alpha', 'mp')],
      makeEnabledByScope(),
    );
    expect(result[0].settingsEnabledScopes).toBeUndefined();
  });

  it('enabledPlugins 有 plugin 但 available/installed 都沒有 → 忽略', () => {
    const result = mergePlugins(
      [],
      [],
      makeEnabledByScope({ user: { 'ghost@mp': true } }),
    );
    expect(result).toHaveLength(0);
  });

  it('三個 scope 同時啟用', () => {
    const result = mergePlugins(
      [],
      [makeAvailable('triple', 'mp')],
      makeEnabledByScope({
        user: { 'triple@mp': true },
        project: { 'triple@mp': true },
        local: { 'triple@mp': true },
      }),
    );
    const plugin = result.find((p) => p.id === 'triple@mp')!;
    expect(plugin.settingsEnabledScopes).toEqual(
      expect.arrayContaining(['user', 'project', 'local']),
    );
  });

  it('enabledPlugins value 為 false → 不列入 settingsEnabledScopes', () => {
    const result = mergePlugins(
      [],
      [makeAvailable('disabled', 'mp')],
      makeEnabledByScope({ user: { 'disabled@mp': false } }),
    );
    expect(result[0].settingsEnabledScopes).toBeUndefined();
  });
});
