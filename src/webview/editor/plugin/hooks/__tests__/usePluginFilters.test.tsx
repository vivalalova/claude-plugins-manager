/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { InstalledPlugin, MergedPlugin } from '../../../../../shared/types';

const { mockViewState, mockPersistedState, mockSetGlobalState, mockInitGlobalState } = vi.hoisted(() => {
  const mockViewState: Record<string, unknown> = {};
  const mockPersistedState: Record<string, unknown> = {};
  const mockSetGlobalState = vi.fn(async (key: string, value: unknown) => {
    mockViewState[key] = value;
  });
  const mockInitGlobalState = vi.fn(async (entries: Array<{ key: string; fallback: unknown }>) => {
    for (const { key, fallback } of entries) {
      mockViewState[key] = key in mockPersistedState ? mockPersistedState[key] : key in mockViewState ? mockViewState[key] : fallback;
    }
    return Object.fromEntries(entries.map(({ key }) => [key, mockViewState[key]]));
  });
  return { mockViewState, mockPersistedState, mockSetGlobalState, mockInitGlobalState };
});

vi.mock('../../../../vscode', () => ({
  getViewState: (key: string, fallback: unknown) => (key in mockViewState ? mockViewState[key] : fallback),
  setViewState: (key: string, value: unknown) => { mockViewState[key] = value; },
  setGlobalState: (...args: unknown[]) => mockSetGlobalState(...args),
  initGlobalState: (...args: unknown[]) => mockInitGlobalState(...args),
}));

import { usePluginFilters } from '../usePluginFilters';

function makePlugin(id: string): MergedPlugin {
  const [name, marketplaceName] = id.split('@');
  return {
    id,
    name,
    marketplaceName,
    description: `${name} description`,
    userInstall: null,
    projectInstalls: [],
    localInstall: null,
  };
}

describe('usePluginFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockViewState)) delete mockViewState[key];
    for (const key of Object.keys(mockPersistedState)) delete mockPersistedState[key];
  });

  afterEach(() => {
    cleanup();
  });

  it('非零 section 的 marketplace 即使被搜尋過濾掉，仍保留空 group', async () => {
    mockViewState['plugin.sections'] = {
      assignments: { mp2: 1 },
      nextId: 2,
      sectionOrder: [1],
    };

    const { result } = renderHook(() => usePluginFilters([
      makePlugin('alpha@mp1'),
      makePlugin('beta@mp2'),
    ]));

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    act(() => {
      result.current.flushSearch('no-match');
    });

    await waitFor(() => {
      expect(result.current.groupedSections).toHaveLength(2);
    });

    expect(result.current.groupedSections[0].id).toBe(0);
    expect([...result.current.groupedSections[0].groups.entries()]).toEqual([]);
    expect(result.current.groupedSections[1].id).toBe(1);
    expect([...result.current.groupedSections[1].groups.entries()]).toEqual([
      ['mp2', []],
    ]);
  });

  it('moveToSection 回到 section 0 時會清掉孤兒 section order 與 sectionNames', async () => {
    mockViewState['plugin.sections'] = {
      assignments: { mp2: 1 },
      nextId: 2,
      sectionOrder: [1],
      sectionNames: { 1: 'Custom Section' },
    };

    const { result } = renderHook(() => usePluginFilters([
      makePlugin('beta@mp2'),
    ]));

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    act(() => {
      result.current.moveToSection('mp2', 0);
    });

    await waitFor(() => {
      expect(result.current.groupedSections).toHaveLength(1);
    });

    expect(result.current.groupedSections[0].id).toBe(0);
    expect(result.current.sectionNames).toBeUndefined();
    expect(mockViewState['plugin.sections']).toEqual({
      assignments: {},
      nextId: 2,
      sectionOrder: [],
      sectionNames: undefined,
    });
    expect(mockSetGlobalState).toHaveBeenCalledWith('plugin.sections', {
      assignments: {},
      nextId: 2,
      sectionOrder: [],
      sectionNames: undefined,
    });
  });

  describe('filterEnabled 包含 settings-only plugin', () => {
    it('filterEnabled=true → 包含已安裝啟用 + settings-only；排除已安裝停用', async () => {
      const alpha: MergedPlugin = {
        ...makePlugin('alpha@mp'),
        userInstall: {
          id: 'alpha@mp',
          version: '1.0.0',
          scope: 'user',
          enabled: true,
          installPath: '/plugins/user',
          installedAt: '2026-01-01T00:00:00Z',
          lastUpdated: '2026-01-01T00:00:00Z',
        },
      };
      const beta: MergedPlugin = {
        ...makePlugin('beta@mp'),
        userInstall: {
          id: 'beta@mp',
          version: '1.0.0',
          scope: 'user',
          enabled: false,
          installPath: '/plugins/user',
          installedAt: '2026-01-01T00:00:00Z',
          lastUpdated: '2026-01-01T00:00:00Z',
        },
      };
      const gamma: MergedPlugin = {
        ...makePlugin('gamma@mp'),
        settingsEnabledScopes: ['user'],
      };

      mockViewState['plugin.filter.enabled'] = true;

      const { result } = renderHook(() => usePluginFilters([alpha, beta, gamma]));

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const allPlugins = [...result.current.groupedSections.flatMap((s) => [...s.groups.values()].flat())];
      const ids = allPlugins.map((p) => p.id);

      expect(ids).toContain('alpha@mp');
      expect(ids).toContain('gamma@mp');
      expect(ids).not.toContain('beta@mp');
    });

    it('filterEnabled=false → 包含全部三個 plugin', async () => {
      const alpha: MergedPlugin = {
        ...makePlugin('alpha@mp'),
        userInstall: {
          id: 'alpha@mp',
          version: '1.0.0',
          scope: 'user',
          enabled: true,
          installPath: '/plugins/user',
          installedAt: '2026-01-01T00:00:00Z',
          lastUpdated: '2026-01-01T00:00:00Z',
        },
      };
      const beta: MergedPlugin = {
        ...makePlugin('beta@mp'),
        userInstall: {
          id: 'beta@mp',
          version: '1.0.0',
          scope: 'user',
          enabled: false,
          installPath: '/plugins/user',
          installedAt: '2026-01-01T00:00:00Z',
          lastUpdated: '2026-01-01T00:00:00Z',
        },
      };
      const gamma: MergedPlugin = {
        ...makePlugin('gamma@mp'),
        settingsEnabledScopes: ['user'],
      };

      // filterEnabled 預設為 false（mockViewState 未設定）

      const { result } = renderHook(() => usePluginFilters([alpha, beta, gamma]));

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      const allPlugins = [...result.current.groupedSections.flatMap((s) => [...s.groups.values()].flat())];
      const ids = allPlugins.map((p) => p.id);

      expect(ids).toContain('alpha@mp');
      expect(ids).toContain('beta@mp');
      expect(ids).toContain('gamma@mp');
    });
  });

  it('search 只用 viewState（不持久化到 globalState），初始化時從 viewState 讀回', async () => {
    vi.useFakeTimers();
    mockViewState['plugin.search'] = 'from-viewstate';

    try {
      const { result } = renderHook(() => usePluginFilters([
        makePlugin('alpha@mp1'),
      ]));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.ready).toBe(true);
      expect(result.current.search).toBe('from-viewstate');
      // search 不應寫入 globalState
      expect(mockSetGlobalState).not.toHaveBeenCalledWith('plugin.search', expect.anything());

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(mockViewState['plugin.search']).toBe('from-viewstate');
    } finally {
      vi.useRealTimers();
    }
  });
});
