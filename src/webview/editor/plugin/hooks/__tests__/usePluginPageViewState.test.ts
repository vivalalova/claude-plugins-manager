/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MergedPlugin, InstalledPlugin, PluginScope } from '../../../../../shared/types';

/* ── Mock vscode bridge (filterUtils imports it) ── */
vi.mock('../../../../vscode', () => ({
  getViewState: vi.fn().mockReturnValue(undefined),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
}));

import { usePluginPageViewState } from '../usePluginPageViewState';
import type { PluginPageGroupedSection } from '../usePluginPageViewState';

/* ── Helpers ── */

function makeInstall(scope: PluginScope, enabled: boolean): InstalledPlugin {
  return {
    id: 'test@mp',
    version: '1.0.0',
    scope,
    enabled,
    installPath: '/plugins/test',
    installedAt: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-01-01T00:00:00Z',
  };
}

function makeMerged(opts: {
  id: string;
  name?: string;
  userInstallEnabled?: boolean;
  settingsEnabledScopes?: PluginScope[];
  availableLastUpdated?: string;
  userInstallLastUpdated?: string;
}): MergedPlugin {
  const userInstall =
    opts.userInstallEnabled !== undefined
      ? { ...makeInstall('user', opts.userInstallEnabled), id: opts.id }
      : null;

  if (userInstall && opts.userInstallLastUpdated) {
    userInstall.lastUpdated = opts.userInstallLastUpdated;
  }

  return {
    id: opts.id,
    name: opts.name ?? opts.id,
    userInstall,
    projectInstalls: [],
    localInstall: null,
    settingsEnabledScopes: opts.settingsEnabledScopes,
    availableLastUpdated: opts.availableLastUpdated,
  };
}

function makeSection(marketplace: string, items: MergedPlugin[]): PluginPageGroupedSection {
  return {
    id: 1,
    groups: new Map([[marketplace, items]]),
  };
}

function runHook(
  sections: PluginPageGroupedSection[],
  opts?: {
    hiddenPlugins?: ReadonlySet<string>;
    showHidden?: boolean;
  },
) {
  const { result } = renderHook(() =>
    usePluginPageViewState({
      groupedSections: sections,
      hiddenPlugins: opts?.hiddenPlugins ?? new Set(),
      showHidden: opts?.showHidden ?? false,
      translateLang: '',
      activeTexts: new Set(),
      queuedTexts: new Set(),
    }),
  );
  return result.current;
}

/* ── sectionStats: enabledCount / allEnabled / visibleCount ── */

describe('sectionStats — enabledCount', () => {
  it('install.enabled=true 計入 enabledCount', () => {
    const items = [
      makeMerged({ id: 'alpha@mp', userInstallEnabled: true }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.enabledCount).toBe(1);
    expect(sectionStats.get('mp')?.visibleCount).toBe(1);
  });

  it('install.enabled=false 不計入 enabledCount', () => {
    const items = [
      makeMerged({ id: 'beta@mp', userInstallEnabled: false }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.enabledCount).toBe(0);
    expect(sectionStats.get('mp')?.visibleCount).toBe(1);
  });

  it('settings-only plugin（無 install）透過 settingsEnabledScopes 計入 enabledCount', () => {
    const items = [
      makeMerged({ id: 'gamma@mp', settingsEnabledScopes: ['user'] }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.enabledCount).toBe(1);
    expect(sectionStats.get('mp')?.visibleCount).toBe(1);
  });

  it('三 plugin 混合：2 enabled（1 install + 1 settings），1 disabled → enabledCount=2, visibleCount=3', () => {
    const items = [
      makeMerged({ id: 'alpha@mp', userInstallEnabled: true }),
      makeMerged({ id: 'beta@mp', userInstallEnabled: false }),
      makeMerged({ id: 'gamma@mp', settingsEnabledScopes: ['user'] }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    const stats = sectionStats.get('mp')!;
    expect(stats.enabledCount).toBe(2);
    expect(stats.visibleCount).toBe(3);
  });
});

describe('sectionStats — allEnabled', () => {
  it('有 enabled + disabled 混合 → allEnabled=false', () => {
    const items = [
      makeMerged({ id: 'alpha@mp', userInstallEnabled: true }),
      makeMerged({ id: 'beta@mp', userInstallEnabled: false }),
      makeMerged({ id: 'gamma@mp', settingsEnabledScopes: ['user'] }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.allEnabled).toBe(false);
  });

  it('全部啟用（install + settings 混合）→ allEnabled=true', () => {
    const items = [
      makeMerged({ id: 'alpha@mp', userInstallEnabled: true }),
      makeMerged({ id: 'beta@mp', userInstallEnabled: true }),
      makeMerged({ id: 'gamma@mp', settingsEnabledScopes: ['user'] }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.allEnabled).toBe(true);
  });

  it('全部禁用 → allEnabled=false', () => {
    const items = [
      makeMerged({ id: 'alpha@mp', userInstallEnabled: false }),
      makeMerged({ id: 'beta@mp', userInstallEnabled: false }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.allEnabled).toBe(false);
  });

  it('單一 plugin 啟用 → allEnabled=true', () => {
    const items = [makeMerged({ id: 'solo@mp', userInstallEnabled: true })];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.allEnabled).toBe(true);
  });

  it('visible 為空（全 hidden，showHidden=false）→ allEnabled=false', () => {
    const items = [makeMerged({ id: 'alpha@mp', userInstallEnabled: true })];
    const { sectionStats } = runHook([makeSection('mp', items)], {
      hiddenPlugins: new Set(['alpha@mp']),
      showHidden: false,
    });
    expect(sectionStats.get('mp')?.allEnabled).toBe(false);
  });
});

describe('sectionStats — hiddenCount / visibleCount', () => {
  it('hidden plugin 不計入 visibleCount，hiddenCount=1', () => {
    const items = [
      makeMerged({ id: 'alpha@mp', userInstallEnabled: true }),
      makeMerged({ id: 'beta@mp', userInstallEnabled: false }),
      makeMerged({ id: 'gamma@mp', settingsEnabledScopes: ['user'] }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)], {
      hiddenPlugins: new Set(['gamma@mp']),
      showHidden: false,
    });
    const stats = sectionStats.get('mp')!;
    // gamma is hidden → only alpha + beta visible
    expect(stats.visibleCount).toBe(2);
    expect(stats.hiddenCount).toBe(1);
    // gamma (settings-only enabled) is excluded, only alpha counts
    expect(stats.enabledCount).toBe(1);
  });

  it('showHidden=true → 即使在 hiddenPlugins 中也顯示，hiddenCount=0', () => {
    const items = [
      makeMerged({ id: 'alpha@mp', userInstallEnabled: true }),
      makeMerged({ id: 'beta@mp', userInstallEnabled: false }),
      makeMerged({ id: 'gamma@mp', settingsEnabledScopes: ['user'] }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)], {
      hiddenPlugins: new Set(['gamma@mp']),
      showHidden: true,
    });
    const stats = sectionStats.get('mp')!;
    expect(stats.visibleCount).toBe(3);
    expect(stats.hiddenCount).toBe(0);
    expect(stats.enabledCount).toBe(2);
  });

  it('全部隱藏且 showHidden=false → visibleCount=0, hiddenCount=items.length', () => {
    const items = [
      makeMerged({ id: 'alpha@mp', userInstallEnabled: true }),
      makeMerged({ id: 'beta@mp', userInstallEnabled: true }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)], {
      hiddenPlugins: new Set(['alpha@mp', 'beta@mp']),
      showHidden: false,
    });
    const stats = sectionStats.get('mp')!;
    expect(stats.visibleCount).toBe(0);
    expect(stats.hiddenCount).toBe(2);
    expect(stats.enabledCount).toBe(0);
    expect(stats.allEnabled).toBe(false);
  });
});

describe('sectionStats — updateCount', () => {
  it('enabled plugin 且 availableLastUpdated > install.lastUpdated → updateCount++', () => {
    const items = [
      makeMerged({
        id: 'alpha@mp',
        userInstallEnabled: true,
        availableLastUpdated: '2026-02-20T00:00:00Z',
        userInstallLastUpdated: '2026-01-01T00:00:00Z',
      }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.updateCount).toBe(1);
  });

  it('disabled plugin 有更新 → updateCount 不計', () => {
    const items = [
      makeMerged({
        id: 'alpha@mp',
        userInstallEnabled: false,
        availableLastUpdated: '2026-02-20T00:00:00Z',
        userInstallLastUpdated: '2026-01-01T00:00:00Z',
      }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.updateCount).toBe(0);
  });

  it('enabled plugin 無更新（日期相同）→ updateCount=0', () => {
    const items = [
      makeMerged({
        id: 'alpha@mp',
        userInstallEnabled: true,
        availableLastUpdated: '2026-01-01T00:00:00Z',
        userInstallLastUpdated: '2026-01-01T00:00:00Z',
      }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.updateCount).toBe(0);
  });

  it('混合：1 enabled with update + 1 enabled no update + 1 disabled with update → updateCount=1', () => {
    const items = [
      makeMerged({
        id: 'alpha@mp',
        userInstallEnabled: true,
        availableLastUpdated: '2026-03-01T00:00:00Z',
        userInstallLastUpdated: '2026-01-01T00:00:00Z',
      }),
      makeMerged({
        id: 'beta@mp',
        userInstallEnabled: true,
        availableLastUpdated: '2026-01-01T00:00:00Z',
        userInstallLastUpdated: '2026-01-01T00:00:00Z',
      }),
      makeMerged({
        id: 'gamma@mp',
        userInstallEnabled: false,
        availableLastUpdated: '2026-03-01T00:00:00Z',
        userInstallLastUpdated: '2026-01-01T00:00:00Z',
      }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.updateCount).toBe(1);
  });
});

describe('sectionStats — backward compat (no settingsEnabledScopes)', () => {
  it('plugin 無 settingsEnabledScopes → 僅依賴 install entries 判斷 enabled', () => {
    const items = [
      makeMerged({ id: 'alpha@mp', userInstallEnabled: true }),
      makeMerged({ id: 'beta@mp', userInstallEnabled: false }),
      // no settingsEnabledScopes, no install
      makeMerged({ id: 'gamma@mp' }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    const stats = sectionStats.get('mp')!;
    // alpha enabled via install, beta disabled, gamma has no install and no settingsEnabledScopes
    expect(stats.enabledCount).toBe(1);
    expect(stats.visibleCount).toBe(3);
    expect(stats.allEnabled).toBe(false);
  });

  it('settingsEnabledScopes=[] （空陣列）→ 不計入 enabledCount', () => {
    const items = [
      makeMerged({ id: 'alpha@mp', settingsEnabledScopes: [] }),
    ];
    const { sectionStats } = runHook([makeSection('mp', items)]);
    expect(sectionStats.get('mp')?.enabledCount).toBe(0);
  });
});

describe('sectionStats — 多 marketplace sections', () => {
  it('兩個不同 marketplace 各自獨立計算 stats', () => {
    const section: PluginPageGroupedSection = {
      id: 1,
      groups: new Map([
        ['mp1', [
          makeMerged({ id: 'a@mp1', userInstallEnabled: true }),
          makeMerged({ id: 'b@mp1', userInstallEnabled: false }),
        ]],
        ['mp2', [
          makeMerged({ id: 'c@mp2', settingsEnabledScopes: ['user'] }),
        ]],
      ]),
    };
    const { sectionStats } = runHook([section]);
    const mp1 = sectionStats.get('mp1')!;
    const mp2 = sectionStats.get('mp2')!;
    expect(mp1.enabledCount).toBe(1);
    expect(mp1.visibleCount).toBe(2);
    expect(mp1.allEnabled).toBe(false);
    expect(mp2.enabledCount).toBe(1);
    expect(mp2.visibleCount).toBe(1);
    expect(mp2.allEnabled).toBe(true);
  });

  it('groups 包含空陣列的 marketplace → 跳過，不產生 stats entry', () => {
    const section: PluginPageGroupedSection = {
      id: 1,
      groups: new Map([
        ['empty-mp', []],
        ['mp', [makeMerged({ id: 'a@mp', userInstallEnabled: true })]],
      ]),
    };
    const { sectionStats } = runHook([section]);
    expect(sectionStats.has('empty-mp')).toBe(false);
    expect(sectionStats.get('mp')?.visibleCount).toBe(1);
  });
});

describe('totalVisiblePlugins', () => {
  it('單一 section → totalVisiblePlugins = visibleCount', () => {
    const items = [
      makeMerged({ id: 'a@mp', userInstallEnabled: true }),
      makeMerged({ id: 'b@mp', userInstallEnabled: false }),
    ];
    const { totalVisiblePlugins } = runHook([makeSection('mp', items)]);
    expect(totalVisiblePlugins).toBe(2);
  });

  it('多 section 加總 → totalVisiblePlugins = 所有 marketplace visibleCount 加總', () => {
    const section: PluginPageGroupedSection = {
      id: 1,
      groups: new Map([
        ['mp1', [
          makeMerged({ id: 'a@mp1', userInstallEnabled: true }),
          makeMerged({ id: 'b@mp1', userInstallEnabled: false }),
        ]],
        ['mp2', [
          makeMerged({ id: 'c@mp2', settingsEnabledScopes: ['user'] }),
        ]],
      ]),
    };
    const { totalVisiblePlugins } = runHook([section]);
    expect(totalVisiblePlugins).toBe(3);
  });

  it('hidden plugin 不計入 totalVisiblePlugins', () => {
    const items = [
      makeMerged({ id: 'a@mp', userInstallEnabled: true }),
      makeMerged({ id: 'b@mp', userInstallEnabled: false }),
    ];
    const { totalVisiblePlugins } = runHook([makeSection('mp', items)], {
      hiddenPlugins: new Set(['b@mp']),
      showHidden: false,
    });
    expect(totalVisiblePlugins).toBe(1);
  });

  it('無 sections → totalVisiblePlugins=0', () => {
    const { totalVisiblePlugins } = runHook([]);
    expect(totalVisiblePlugins).toBe(0);
  });
});

describe('visiblePlugins', () => {
  it('回傳所有 visible plugin 的扁平陣列', () => {
    const section: PluginPageGroupedSection = {
      id: 1,
      groups: new Map([
        ['mp1', [makeMerged({ id: 'a@mp1', userInstallEnabled: true })]],
        ['mp2', [makeMerged({ id: 'b@mp2', userInstallEnabled: false })]],
      ]),
    };
    const { visiblePlugins } = runHook([section]);
    expect(visiblePlugins.map((p) => p.id)).toEqual(
      expect.arrayContaining(['a@mp1', 'b@mp2']),
    );
    expect(visiblePlugins).toHaveLength(2);
  });

  it('hidden plugin 不出現在 visiblePlugins', () => {
    const items = [
      makeMerged({ id: 'a@mp', userInstallEnabled: true }),
      makeMerged({ id: 'b@mp', userInstallEnabled: false }),
    ];
    const { visiblePlugins } = runHook([makeSection('mp', items)], {
      hiddenPlugins: new Set(['b@mp']),
      showHidden: false,
    });
    expect(visiblePlugins.map((p) => p.id)).toEqual(['a@mp']);
  });
});
