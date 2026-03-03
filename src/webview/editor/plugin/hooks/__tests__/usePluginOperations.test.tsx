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
