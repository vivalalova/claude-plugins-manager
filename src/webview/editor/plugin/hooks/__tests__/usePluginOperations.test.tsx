/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { InstalledPlugin, MergedPlugin } from '../../../../../shared/types';

const { mockSendRequest, addToastMock } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  addToastMock: vi.fn(),
}));

const USER_CONFIRM_TIMEOUT = 30 * 60_000;

vi.mock('../../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  USER_CONFIRM_REQUEST_TIMEOUT_MS: 30 * 60_000,
}));

vi.mock('../../../../components/Toast', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

import { usePluginOperations } from '../usePluginOperations';

function makeInstall(
  scope: InstalledPlugin['scope'],
  enabled: boolean,
  lastUpdated = '2026-01-01T00:00:00Z',
): InstalledPlugin {
  return {
    id: `placeholder@mp`,
    version: '1.0.0',
    scope,
    enabled,
    installPath: `/plugins/${scope}`,
    installedAt: '2026-01-01T00:00:00Z',
    lastUpdated,
  };
}

function makePlugin(
  id: string,
  options?: {
    userInstall?: InstalledPlugin | null;
    projectInstalls?: InstalledPlugin[];
    localInstall?: InstalledPlugin | null;
    availableLastUpdated?: string;
    settingsEnabledScopes?: MergedPlugin['settingsEnabledScopes'];
  },
): MergedPlugin {
  const [name, marketplaceName] = id.split('@');
  return {
    id,
    name,
    marketplaceName,
    description: `${name} description`,
    userInstall: options?.userInstall ?? null,
    projectInstalls: options?.projectInstalls ?? [],
    localInstall: options?.localInstall ?? null,
    availableLastUpdated: options?.availableLastUpdated,
    settingsEnabledScopes: options?.settingsEnabledScopes,
  };
}

describe('usePluginOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('已安裝但 disabled 的 scope 勾回去時只呼叫 enable', async () => {
    const fetchAll = vi.fn().mockResolvedValue(undefined);
    const setError = vi.fn();
    const plugin = makePlugin('alpha@mp', {
      userInstall: { ...makeInstall('user', false), id: 'alpha@mp' },
    });
    mockSendRequest.mockResolvedValue({ cancelled: false });

    const { result } = renderHook(() => usePluginOperations([plugin], fetchAll, setError));

    await act(async () => {
      await result.current.handleToggle('alpha@mp', 'user', true);
    });

    expect(mockSendRequest).toHaveBeenCalledWith({
      type: 'plugin.enable',
      plugin: 'alpha@mp',
      scope: 'user',
    });
    expect(mockSendRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'plugin.install' }),
      expect.anything(),
    );
    expect(fetchAll).toHaveBeenCalledWith(false);
    expect(addToastMock).toHaveBeenCalledWith('Enabled alpha@mp');
    expect(result.current.installError).toBeNull();
  });

  it('安裝失敗時保留 installError 並清掉 loading state', async () => {
    const fetchAll = vi.fn().mockResolvedValue(undefined);
    const setError = vi.fn();
    const plugin = makePlugin('beta@mp');
    mockSendRequest.mockRejectedValue(new Error('install failed'));

    const { result } = renderHook(() => usePluginOperations([plugin], fetchAll, setError));

    await act(async () => {
      await result.current.handleToggle('beta@mp', 'project', true);
    });

    await waitFor(() => {
      expect(result.current.installError).toEqual({
        message: 'install failed',
        pluginId: 'beta@mp',
        scope: 'project',
        enable: true,
      });
    });
    expect(result.current.loadingPlugins.size).toBe(0);
    expect(fetchAll).not.toHaveBeenCalled();
  });

  it('同 scope 下另一個 plugin 正在 toggle → 第二個被擋', async () => {
    const fetchAll = vi.fn().mockResolvedValue(undefined);
    const setError = vi.fn();
    const plugins = [
      makePlugin('alpha@mp', { userInstall: { ...makeInstall('user', false), id: 'alpha@mp' } }),
      makePlugin('beta@mp', { userInstall: { ...makeInstall('user', false), id: 'beta@mp' } }),
    ];

    // alpha enable 卡住不 resolve
    let resolveAlpha!: () => void;
    mockSendRequest.mockImplementation(() => new Promise<void>((r) => { resolveAlpha = r; }));

    const { result } = renderHook(() => usePluginOperations(plugins, fetchAll, setError));

    // 啟動 alpha enable（不 await，讓它 pending）
    let alphaPromise: Promise<void>;
    act(() => {
      alphaPromise = result.current.handleToggle('alpha@mp', 'user', true);
    });

    // alpha 應該在 loading
    expect(result.current.loadingPlugins.get('alpha@mp')?.has('user')).toBe(true);

    // 嘗試同 scope 的 beta enable → 應被擋
    await act(async () => {
      await result.current.handleToggle('beta@mp', 'user', true);
    });

    // beta 沒有進入 loading（被 guard 擋掉）
    expect(result.current.loadingPlugins.has('beta@mp')).toBe(false);
    // sendRequest 只被 alpha 呼叫一次
    expect(mockSendRequest).toHaveBeenCalledTimes(1);

    // 完成 alpha
    resolveAlpha();
    await act(async () => { await alphaPromise!; });
  });

  describe('settings-only enabled plugins（無 install entry）', () => {
    it('handleToggle disable — settings-only enabled plugin 送出 plugin.disable', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const setError = vi.fn();
      // settingsEnabledScopes 有 'user'，但 userInstall 為 null（未裝）
      const plugin = makePlugin('alpha@mp', { settingsEnabledScopes: ['user'] });
      mockSendRequest.mockResolvedValue({ cancelled: false });

      const { result } = renderHook(() => usePluginOperations([plugin], fetchAll, setError));

      await act(async () => {
        await result.current.handleToggle('alpha@mp', 'user', false);
      });

      expect(mockSendRequest).toHaveBeenCalledWith({
        type: 'plugin.disable',
        plugin: 'alpha@mp',
        scope: 'user',
      });
      expect(mockSendRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plugin.install' }),
        expect.anything(),
      );
      expect(fetchAll).toHaveBeenCalledWith(false);
      expect(addToastMock).toHaveBeenCalledWith('Disabled alpha@mp');
      expect(result.current.installError).toBeNull();
    });

    it('handleToggle enable — 無安裝 entry 的 plugin 送出 plugin.install', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const setError = vi.fn();
      // 無 install entry，無 settingsEnabledScopes → isInstalledInScope 回傳 false
      const plugin = makePlugin('beta@mp');
      mockSendRequest.mockResolvedValue({ cancelled: false });

      const { result } = renderHook(() => usePluginOperations([plugin], fetchAll, setError));

      await act(async () => {
        await result.current.handleToggle('beta@mp', 'user', true);
      });

      expect(mockSendRequest).toHaveBeenCalledWith(
        { type: 'plugin.install', plugin: 'beta@mp', scope: 'user' },
        USER_CONFIRM_TIMEOUT,
      );
      expect(mockSendRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plugin.enable' }),
      );
      expect(fetchAll).toHaveBeenCalledWith(false);
      expect(addToastMock).toHaveBeenCalledWith('Enabled beta@mp');
    });

    it('handleUpdateAll — settings-only plugin 無安裝日期，hasPluginUpdate 回傳 false，不進入更新', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const setError = vi.fn();
      const plugins = [
        // 已安裝且 enabled 且有可用更新的 plugin → 應被更新
        makePlugin('alpha@mp', {
          userInstall: { ...makeInstall('user', true, '2026-01-01T00:00:00Z'), id: 'alpha@mp' },
          availableLastUpdated: '2026-02-01T00:00:00Z',
        }),
        // settings-only：無 install entry → installedDates 為空 → hasPluginUpdate 回傳 false
        makePlugin('beta@mp', {
          settingsEnabledScopes: ['user'],
          availableLastUpdated: '2026-02-01T00:00:00Z',
        }),
      ];
      mockSendRequest.mockResolvedValue({ cancelled: false });

      const { result } = renderHook(() => usePluginOperations(plugins, fetchAll, setError));

      await act(async () => {
        await result.current.handleUpdateAll();
      });

      const updateCalls = mockSendRequest.mock.calls
        .map(([req]) => req as { type: string; plugin: string })
        .filter((req) => req.type === 'plugin.update');

      // 只有 alpha 被更新；beta 因無安裝 entry 被跳過
      expect(updateCalls).toEqual([
        { type: 'plugin.update', plugin: 'alpha@mp', scope: 'user' },
      ]);
      expect(fetchAll).toHaveBeenCalledWith(false);
      expect(addToastMock).toHaveBeenCalledWith('All plugins updated');
    });
  });

  it('Update All 跳過 settings-only enabled scope（無 install entry）', async () => {
    const fetchAll = vi.fn().mockResolvedValue(undefined);
    const setError = vi.fn();
    // settingsEnabledScopes 含 local，但 localInstall 為 null → 不該嘗試 local scope update
    const plugins = [
      makePlugin('swift-lsp@mp', {
        projectInstalls: [{ ...makeInstall('project', true, '2026-01-01T00:00:00Z'), id: 'swift-lsp@mp' }],
        settingsEnabledScopes: ['project', 'local'],
        availableLastUpdated: '2026-02-01T00:00:00Z',
      }),
    ];
    mockSendRequest.mockResolvedValue({ cancelled: false });

    const { result } = renderHook(() => usePluginOperations(plugins, fetchAll, setError));

    await act(async () => {
      await result.current.handleUpdateAll();
    });

    const updateCalls = mockSendRequest.mock.calls
      .map(([req]) => req as { type: string; plugin: string; scope: string })
      .filter((req) => req.type === 'plugin.update');

    // 只更新有 install entry 的 project scope，不嘗試 local
    expect(updateCalls).toEqual([
      { type: 'plugin.update', plugin: 'swift-lsp@mp', scope: 'project' },
    ]);
  });

  it('Update All 只更新 enabled 且有更新的 scope，錯誤會累積但不中斷', async () => {
    const fetchAll = vi.fn().mockResolvedValue(undefined);
    const setError = vi.fn();
    const plugins = [
      makePlugin('alpha@mp', {
        userInstall: { ...makeInstall('user', true, '2026-01-01T00:00:00Z'), id: 'alpha@mp' },
        availableLastUpdated: '2026-02-01T00:00:00Z',
      }),
      makePlugin('beta@mp', {
        projectInstalls: [{ ...makeInstall('project', true, '2026-01-01T00:00:00Z'), id: 'beta@mp' }],
        availableLastUpdated: '2026-02-01T00:00:00Z',
      }),
      makePlugin('gamma@mp', {
        userInstall: { ...makeInstall('user', false, '2026-01-01T00:00:00Z'), id: 'gamma@mp' },
        availableLastUpdated: '2026-02-01T00:00:00Z',
      }),
      makePlugin('delta@mp', {
        userInstall: { ...makeInstall('user', true, '2026-02-01T00:00:00Z'), id: 'delta@mp' },
        availableLastUpdated: '2026-02-01T00:00:00Z',
      }),
    ];
    mockSendRequest.mockImplementation(async (request: { type: string; plugin: string }) => {
      if (request.type === 'plugin.update' && request.plugin === 'beta@mp') {
        throw new Error('network down');
      }
      return { cancelled: false };
    });

    const { result } = renderHook(() => usePluginOperations(plugins, fetchAll, setError));

    await act(async () => {
      await result.current.handleUpdateAll();
    });

    const updateCalls = mockSendRequest.mock.calls.map(([request]) => request).filter(
      (request) => (request as { type: string }).type === 'plugin.update',
    );
    expect(updateCalls).toEqual([
      { type: 'plugin.update', plugin: 'alpha@mp', scope: 'user' },
      { type: 'plugin.update', plugin: 'beta@mp', scope: 'project' },
    ]);
    expect(fetchAll).toHaveBeenCalledWith(false);
    expect(addToastMock).not.toHaveBeenCalledWith('All plugins updated');
    expect(result.current.updateAllProgress).toBeNull();
    expect(result.current.updateAllErrors).toEqual([
      { pluginId: 'beta@mp', scope: 'project', message: 'network down' },
    ]);
  });
  describe('command-source 同意被使用者取消', () => {
    function enabledPlugin(id: string, scopes: Array<'user' | 'project'> = ['user']): MergedPlugin {
      return makePlugin(id, {
        userInstall: scopes.includes('user') ? { ...makeInstall('user', true, '2026-01-01T00:00:00Z'), id } : null,
        projectInstalls: scopes.includes('project')
          ? [{ ...makeInstall('project', true, '2026-01-01T00:00:00Z'), id }]
          : [],
        availableLastUpdated: '2026-02-01T00:00:00Z',
      });
    }

    function updateCalls(): Array<{ plugin: string; scope: string }> {
      return mockSendRequest.mock.calls
        .map(([req]) => req as { type: string; plugin: string; scope: string })
        .filter((req) => req.type === 'plugin.update')
        .map(({ plugin, scope }) => ({ plugin, scope }));
    }

    /** 指定 (plugin, scope) 回 cancelled:true，其餘 cancelled:false */
    function cancelOn(...targets: Array<[string, string]>): void {
      mockSendRequest.mockImplementation(async (req: { type: string; plugin?: string; scope?: string }) => {
        if (req.type === 'plugin.update' || req.type === 'plugin.install') {
          const cancelled = targets.some(([p, sc]) => p === req.plugin && sc === req.scope);
          return { cancelled };
        }
        return undefined;
      });
    }

    it('勾選安裝被取消 → 不設錯誤列、不 toast，仍重新抓資料並清掉 loading', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const plugin = makePlugin('xcode@mp');
      cancelOn(['xcode@mp', 'user']);

      const { result } = renderHook(() => usePluginOperations([plugin], fetchAll, vi.fn()));

      await act(async () => {
        await result.current.handleToggle('xcode@mp', 'user', true);
      });

      expect(mockSendRequest).toHaveBeenCalledWith(
        { type: 'plugin.install', plugin: 'xcode@mp', scope: 'user' },
        USER_CONFIRM_TIMEOUT,
      );
      expect(result.current.installError).toBeNull();
      expect(addToastMock).not.toHaveBeenCalled();
      expect(fetchAll).toHaveBeenCalledTimes(1);
      expect(result.current.loadingPlugins.size).toBe(0);
    });

    it('勾選安裝回 cancelled:false（一般外掛）→ 與原本相同：toast Enabled、重新抓資料、無錯誤', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const plugin = makePlugin('plain@mp');
      cancelOn();

      const { result } = renderHook(() => usePluginOperations([plugin], fetchAll, vi.fn()));

      await act(async () => {
        await result.current.handleToggle('plain@mp', 'user', true);
      });

      expect(addToastMock).toHaveBeenCalledWith('Enabled plain@mp');
      expect(fetchAll).toHaveBeenCalledWith(false);
      expect(result.current.installError).toBeNull();
    });

    it('handleUpdate 第一個 scope 被取消 → 無錯誤、無 Updated toast、其餘 scope 不再送', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const setError = vi.fn();
      cancelOn(['xcode@mp', 'user']);

      const { result } = renderHook(() => usePluginOperations([], fetchAll, setError));

      await act(async () => {
        await result.current.handleUpdate('xcode@mp', ['user', 'project']);
      });

      expect(updateCalls()).toEqual([{ plugin: 'xcode@mp', scope: 'user' }]);
      expect(setError).not.toHaveBeenCalledWith(expect.any(String));
      expect(addToastMock).not.toHaveBeenCalledWith('Updated xcode@mp');
      expect(fetchAll).toHaveBeenCalled();
    });

    it('handleUpdate 後面的 scope 被取消 → 前面已送的保留，其餘不再送，無 Updated toast', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const setError = vi.fn();
      cancelOn(['xcode@mp', 'project']);

      const { result } = renderHook(() => usePluginOperations([], fetchAll, setError));

      await act(async () => {
        await result.current.handleUpdate('xcode@mp', ['user', 'project', 'local']);
      });

      expect(updateCalls()).toEqual([
        { plugin: 'xcode@mp', scope: 'user' },
        { plugin: 'xcode@mp', scope: 'project' },
      ]);
      expect(addToastMock).not.toHaveBeenCalledWith('Updated xcode@mp');
      expect(setError).not.toHaveBeenCalledWith(expect.any(String));
    });

    it('handleUpdate 一般外掛（cancelled:false）→ 全部 scope 都送、帶使用者確認逾時、toast Updated', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      cancelOn();

      const { result } = renderHook(() => usePluginOperations([], fetchAll, vi.fn()));

      await act(async () => {
        await result.current.handleUpdate('plain@mp', ['user', 'project']);
      });

      expect(updateCalls()).toEqual([
        { plugin: 'plain@mp', scope: 'user' },
        { plugin: 'plain@mp', scope: 'project' },
      ]);
      for (const [, timeout] of mockSendRequest.mock.calls) {
        expect(timeout).toBe(USER_CONFIRM_TIMEOUT);
      }
      expect(addToastMock).toHaveBeenCalledWith('Updated plain@mp');
    });

    it('handleUpdateAll 取消發生在第 0 個外掛 → 其餘 scope 不送、其他外掛照常、不顯示 All plugins updated、無錯誤', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const plugins = [
        enabledPlugin('xcode@mp', ['user', 'project']),
        enabledPlugin('beta@mp', ['user']),
      ];
      cancelOn(['xcode@mp', 'user']);

      const { result } = renderHook(() => usePluginOperations(plugins, fetchAll, vi.fn()));

      await act(async () => {
        await result.current.handleUpdateAll();
      });

      expect(updateCalls()).toEqual([
        { plugin: 'xcode@mp', scope: 'user' },
        { plugin: 'beta@mp', scope: 'user' },
      ]);
      expect(addToastMock).not.toHaveBeenCalledWith('All plugins updated');
      expect(result.current.updateAllErrors).toEqual([]);
      expect(result.current.updateAllProgress).toBeNull();
      expect(fetchAll).toHaveBeenCalledWith(false);
    });

    it('handleUpdateAll 取消發生在非第 0 個外掛 → 前面的照常、該外掛其餘 scope 不送、後面的外掛照常', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const plugins = [
        enabledPlugin('alpha@mp', ['user', 'project']),
        enabledPlugin('xcode@mp', ['user', 'project']),
        enabledPlugin('gamma@mp', ['user']),
      ];
      cancelOn(['xcode@mp', 'user']);

      const { result } = renderHook(() => usePluginOperations(plugins, fetchAll, vi.fn()));

      await act(async () => {
        await result.current.handleUpdateAll();
      });

      expect(updateCalls()).toEqual([
        { plugin: 'alpha@mp', scope: 'user' },
        { plugin: 'alpha@mp', scope: 'project' },
        { plugin: 'xcode@mp', scope: 'user' },
        { plugin: 'gamma@mp', scope: 'user' },
      ]);
      expect(addToastMock).not.toHaveBeenCalledWith('All plugins updated');
      expect(result.current.updateAllErrors).toEqual([]);
    });

    it('handleUpdateAll 取消與真正失敗並存 → 只有失敗列入錯誤，取消的不列入', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const plugins = [
        enabledPlugin('xcode@mp', ['user']),
        enabledPlugin('beta@mp', ['project']),
      ];
      mockSendRequest.mockImplementation(async (req: { plugin: string }) => {
        if (req.plugin === 'beta@mp') throw new Error('network down');
        return { cancelled: true };
      });

      const { result } = renderHook(() => usePluginOperations(plugins, fetchAll, vi.fn()));

      await act(async () => {
        await result.current.handleUpdateAll();
      });

      expect(result.current.updateAllErrors).toEqual([
        { pluginId: 'beta@mp', scope: 'project', message: 'network down' },
      ]);
      expect(addToastMock).not.toHaveBeenCalledWith('All plugins updated');
    });

    it('handleUpdateAll 全部一般外掛（cancelled:false）→ 顯示 All plugins updated，並用使用者確認逾時', async () => {
      const fetchAll = vi.fn().mockResolvedValue(undefined);
      const plugins = [enabledPlugin('alpha@mp'), enabledPlugin('beta@mp')];
      cancelOn();

      const { result } = renderHook(() => usePluginOperations(plugins, fetchAll, vi.fn()));

      await act(async () => {
        await result.current.handleUpdateAll();
      });

      expect(addToastMock).toHaveBeenCalledWith('All plugins updated');
      for (const [, timeout] of mockSendRequest.mock.calls) {
        expect(timeout).toBe(USER_CONFIRM_TIMEOUT);
      }
    });
  });
});
