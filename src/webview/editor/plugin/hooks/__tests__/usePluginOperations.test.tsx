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

vi.mock('../../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
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
    mockSendRequest.mockResolvedValue(undefined);

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
      mockSendRequest.mockResolvedValue(undefined);

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
      mockSendRequest.mockResolvedValue(undefined);

      const { result } = renderHook(() => usePluginOperations([plugin], fetchAll, setError));

      await act(async () => {
        await result.current.handleToggle('beta@mp', 'user', true);
      });

      expect(mockSendRequest).toHaveBeenCalledWith(
        { type: 'plugin.install', plugin: 'beta@mp', scope: 'user' },
        120_000,
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
      mockSendRequest.mockResolvedValue(undefined);

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
      return undefined;
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
});
