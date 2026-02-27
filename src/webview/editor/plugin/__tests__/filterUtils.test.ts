/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';

/* ── Mock vscode bridge ── */
const mockViewState: Record<string, unknown> = {};
vi.mock('../../../vscode', () => ({
  getViewState: (key: string, fallback: unknown) => key in mockViewState ? mockViewState[key] : fallback,
  setViewState: (key: string, value: unknown) => { mockViewState[key] = value; },
}));

import {
  matchesContentType,
  matchesSearch,
  readContentTypeFilters,
  writeContentTypeFilters,
  CONTENT_TYPE_STORAGE_KEY,
  hasPluginUpdate,
  compareByName,
  compareByLastUpdated,
  getPluginComparator,
  readPluginSort,
  writePluginSort,
  readExpandedSections,
  writeExpandedSections,
  readSectionAssignments,
  writeSectionAssignments,
  PLUGIN_SORT_KEY,
  PLUGIN_EXPANDED_KEY,
  PLUGIN_SECTIONS_KEY,
  type ContentTypeFilter,
  type PluginSortBy,
} from '../filterUtils';
import type { MergedPlugin, PluginContents, InstalledPlugin, PluginScope } from '../../../../shared/types';

/** 建立測試用 MergedPlugin */
function makeMerged(opts?: {
  name?: string;
  description?: string;
  contents?: Partial<PluginContents>;
}): MergedPlugin {
  return {
    id: 'test@mp',
    name: opts?.name ?? 'test',
    description: opts?.description,
    userInstall: null,
    projectInstalls: [],
    localInstall: null,
    contents: opts?.contents ? {
      commands: [],
      skills: [],
      agents: [],
      mcpServers: [],
      hooks: false,
      ...opts.contents,
    } : undefined,
  };
}

describe('matchesContentType', () => {
  describe('無 filter 時', () => {
    it('filters 為空 Set → 所有 plugin 通過', () => {
      const plugin = makeMerged({ contents: { skills: [{ name: 'a', description: '' }] } });
      expect(matchesContentType(plugin, new Set())).toBe(true);
    });
  });

  describe('無 contents 的 plugin（保守顯示）', () => {
    it('有 filter 但 plugin 無 contents → 通過', () => {
      const plugin = makeMerged(); // contents = undefined
      expect(matchesContentType(plugin, new Set(['skills']))).toBe(true);
    });
  });

  describe('單一 filter', () => {
    it.each<[ContentTypeFilter, Partial<PluginContents>]>([
      ['commands', { commands: [{ name: 'cmd', description: '' }] }],
      ['skills', { skills: [{ name: 'sk', description: '' }] }],
      ['agents', { agents: [{ name: 'ag', description: '' }] }],
      ['mcp', { mcpServers: ['server-1'] }],
    ])('%s filter 命中有內容的 plugin', (type, partial) => {
      const plugin = makeMerged({ contents: partial });
      expect(matchesContentType(plugin, new Set([type]))).toBe(true);
    });

    it('skills filter 不命中只有 commands 的 plugin', () => {
      const plugin = makeMerged({ contents: { commands: [{ name: 'cmd', description: '' }] } });
      expect(matchesContentType(plugin, new Set(['skills']))).toBe(false);
    });

    it('mcp filter 不命中 mcpServers 為空的 plugin', () => {
      const plugin = makeMerged({ contents: { mcpServers: [] } });
      expect(matchesContentType(plugin, new Set(['mcp']))).toBe(false);
    });
  });

  describe('多選 filter（OR 邏輯）', () => {
    it('Skills + MCP → 有 skills 的 plugin 通過', () => {
      const plugin = makeMerged({ contents: { skills: [{ name: 'sk', description: '' }] } });
      expect(matchesContentType(plugin, new Set(['skills', 'mcp']))).toBe(true);
    });

    it('Skills + MCP → 有 mcp 的 plugin 通過', () => {
      const plugin = makeMerged({ contents: { mcpServers: ['s1'] } });
      expect(matchesContentType(plugin, new Set(['skills', 'mcp']))).toBe(true);
    });

    it('Skills + MCP → 只有 commands 的 plugin 不通過', () => {
      const plugin = makeMerged({ contents: { commands: [{ name: 'c', description: '' }] } });
      expect(matchesContentType(plugin, new Set(['skills', 'mcp']))).toBe(false);
    });
  });

  describe('空 contents（所有陣列皆空）', () => {
    it('有 filter 但所有 content 為空 → 不通過', () => {
      const plugin = makeMerged({ contents: {} });
      expect(matchesContentType(plugin, new Set(['commands', 'skills', 'agents', 'mcp']))).toBe(false);
    });
  });
});

describe('matchesSearch', () => {
  it('空 query → 所有 plugin 通過', () => {
    expect(matchesSearch(makeMerged(), '')).toBe(true);
  });

  it('匹配 plugin name', () => {
    const plugin = makeMerged({ name: 'my-awesome-plugin' });
    expect(matchesSearch(plugin, 'awesome')).toBe(true);
  });

  it('匹配 plugin description', () => {
    const plugin = makeMerged({ description: 'A tool for code review' });
    expect(matchesSearch(plugin, 'review')).toBe(true);
  });

  it('不匹配 name 或 description → false', () => {
    const plugin = makeMerged({ name: 'foo', description: 'bar' });
    expect(matchesSearch(plugin, 'xyz')).toBe(false);
  });

  it('case-insensitive 搜尋', () => {
    const plugin = makeMerged({ name: 'MyPlugin' });
    expect(matchesSearch(plugin, 'myplugin')).toBe(true);
    expect(matchesSearch(plugin, 'MYPLUGIN')).toBe(true);
  });

  describe('搜尋 plugin contents', () => {
    it('匹配 skill name', () => {
      const plugin = makeMerged({
        name: 'tools',
        contents: { skills: [{ name: 'commit', description: 'Create git commits' }] },
      });
      expect(matchesSearch(plugin, 'commit')).toBe(true);
    });

    it('匹配 skill description', () => {
      const plugin = makeMerged({
        name: 'tools',
        contents: { skills: [{ name: 'sk', description: 'Automate deployment pipeline' }] },
      });
      expect(matchesSearch(plugin, 'deployment')).toBe(true);
    });

    it('匹配 command name（部分匹配）', () => {
      const plugin = makeMerged({
        name: 'tools',
        contents: { commands: [{ name: 'review-pr', description: 'Review pull requests' }] },
      });
      expect(matchesSearch(plugin, 'review')).toBe(true);
    });

    it('匹配 command description', () => {
      const plugin = makeMerged({
        name: 'tools',
        contents: { commands: [{ name: 'cmd', description: 'Lint and fix code style' }] },
      });
      expect(matchesSearch(plugin, 'lint')).toBe(true);
    });

    it('匹配 agent name', () => {
      const plugin = makeMerged({
        name: 'tools',
        contents: { agents: [{ name: 'browser-agent', description: 'Browse the web' }] },
      });
      expect(matchesSearch(plugin, 'browser')).toBe(true);
    });

    it('匹配 agent description', () => {
      const plugin = makeMerged({
        name: 'tools',
        contents: { agents: [{ name: 'ag', description: 'Crawl and scrape websites' }] },
      });
      expect(matchesSearch(plugin, 'scrape')).toBe(true);
    });

    it('不搜尋 mcpServers（純 string，非 ContentItem）', () => {
      const plugin = makeMerged({
        name: 'tools',
        contents: { mcpServers: ['my-server'] },
      });
      expect(matchesSearch(plugin, 'my-server')).toBe(false);
    });

    it('contents 為 undefined → 只搜 name/description', () => {
      const plugin = makeMerged({ name: 'foo', description: 'bar' });
      expect(matchesSearch(plugin, 'foo')).toBe(true);
      expect(matchesSearch(plugin, 'baz')).toBe(false);
    });

    it('多個 content items 中任一匹配即通過', () => {
      const plugin = makeMerged({
        name: 'tools',
        contents: {
          skills: [
            { name: 'alpha', description: '' },
            { name: 'beta', description: 'target found here' },
          ],
        },
      });
      expect(matchesSearch(plugin, 'target')).toBe(true);
    });
  });
});

describe('readContentTypeFilters / writeContentTypeFilters', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockViewState)) delete mockViewState[key];
  });

  it('viewState 無資料 → 空 Set', () => {
    expect(readContentTypeFilters()).toEqual(new Set());
  });

  it('write 後 read round-trip 保持一致', () => {
    const filters: Set<ContentTypeFilter> = new Set(['skills', 'mcp']);
    writeContentTypeFilters(filters);
    expect(readContentTypeFilters()).toEqual(filters);
  });

  it('單一 filter round-trip', () => {
    writeContentTypeFilters(new Set(['commands']));
    expect(readContentTypeFilters()).toEqual(new Set(['commands']));
  });

  it('空 Set → 寫入空陣列 → read 回空 Set', () => {
    writeContentTypeFilters(new Set());
    expect(readContentTypeFilters()).toEqual(new Set());
  });

  it('viewState 含無效值 → 過濾掉，只保留合法 filter', () => {
    mockViewState[CONTENT_TYPE_STORAGE_KEY] = ['skills', 'invalid', 'mcp'];
    expect(readContentTypeFilters()).toEqual(new Set(['skills', 'mcp']));
  });

  it('viewState 含非陣列 → 回空 Set', () => {
    mockViewState[CONTENT_TYPE_STORAGE_KEY] = { a: 1 };
    expect(readContentTypeFilters()).toEqual(new Set());
  });

  it('所有 4 種 filter round-trip', () => {
    const all: Set<ContentTypeFilter> = new Set(['commands', 'skills', 'agents', 'mcp']);
    writeContentTypeFilters(all);
    expect(readContentTypeFilters()).toEqual(all);
  });
});

describe('hasPluginUpdate', () => {
  function makeInstall(lastUpdated: string): InstalledPlugin {
    return {
      id: 'test@mp',
      version: '1.0.0',
      scope: 'user' as PluginScope,
      enabled: true,
      installPath: '/path',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated,
    };
  }

  it('無 availableLastUpdated → false', () => {
    const p = makeMerged();
    expect(hasPluginUpdate(p)).toBe(false);
  });

  it('有 availableLastUpdated 但未安裝 → false', () => {
    const p: MergedPlugin = {
      ...makeMerged(),
      availableLastUpdated: '2026-02-01T00:00:00Z',
    };
    expect(hasPluginUpdate(p)).toBe(false);
  });

  it('availableLastUpdated > installed lastUpdated → true（有更新）', () => {
    const p: MergedPlugin = {
      ...makeMerged(),
      availableLastUpdated: '2026-02-20T00:00:00Z',
      userInstall: makeInstall('2026-01-01T00:00:00Z'),
    };
    expect(hasPluginUpdate(p)).toBe(true);
  });

  it('availableLastUpdated === installed lastUpdated → false（無更新）', () => {
    const p: MergedPlugin = {
      ...makeMerged(),
      availableLastUpdated: '2026-01-01T00:00:00Z',
      userInstall: makeInstall('2026-01-01T00:00:00Z'),
    };
    expect(hasPluginUpdate(p)).toBe(false);
  });

  it('availableLastUpdated < installed lastUpdated → false（已是最新）', () => {
    const p: MergedPlugin = {
      ...makeMerged(),
      availableLastUpdated: '2026-01-01T00:00:00Z',
      userInstall: makeInstall('2026-02-20T00:00:00Z'),
    };
    expect(hasPluginUpdate(p)).toBe(false);
  });

  it('多個 scope 安裝，取最新 lastUpdated 比較', () => {
    const p: MergedPlugin = {
      ...makeMerged(),
      availableLastUpdated: '2026-02-15T00:00:00Z',
      userInstall: makeInstall('2026-01-01T00:00:00Z'),
      projectInstalls: [{ ...makeInstall('2026-02-20T00:00:00Z'), scope: 'project' as PluginScope }],
      localInstall: null,
    };
    // project install lastUpdated (2026-02-20) > available (2026-02-15) → false
    expect(hasPluginUpdate(p)).toBe(false);
  });

  it('多個 scope 安裝，available 比所有 installed 都新 → true', () => {
    const p: MergedPlugin = {
      ...makeMerged(),
      availableLastUpdated: '2026-03-01T00:00:00Z',
      userInstall: makeInstall('2026-01-01T00:00:00Z'),
      projectInstalls: [{ ...makeInstall('2026-02-01T00:00:00Z'), scope: 'project' as PluginScope }],
      localInstall: { ...makeInstall('2026-01-15T00:00:00Z'), scope: 'local' as PluginScope },
    };
    expect(hasPluginUpdate(p)).toBe(true);
  });
});

describe('compareByName', () => {
  it('按名稱字母升序排列', () => {
    const a = makeMerged({ name: 'alpha' });
    const b = makeMerged({ name: 'beta' });
    expect(compareByName(a, b)).toBeLessThan(0);
    expect(compareByName(b, a)).toBeGreaterThan(0);
  });

  it('相同名稱 → 0', () => {
    const a = makeMerged({ name: 'same' });
    const b = makeMerged({ name: 'same' });
    expect(compareByName(a, b)).toBe(0);
  });

  it('case-insensitive 排序', () => {
    const a = makeMerged({ name: 'Alpha' });
    const b = makeMerged({ name: 'beta' });
    expect(compareByName(a, b)).toBeLessThan(0);
  });
});

describe('compareByLastUpdated', () => {
  it('較新日期排前面（降序）', () => {
    const newer: MergedPlugin = { ...makeMerged({ name: 'a' }), availableLastUpdated: '2026-02-20T00:00:00Z' };
    const older: MergedPlugin = { ...makeMerged({ name: 'b' }), availableLastUpdated: '2026-01-01T00:00:00Z' };
    expect(compareByLastUpdated(newer, older)).toBeLessThan(0);
    expect(compareByLastUpdated(older, newer)).toBeGreaterThan(0);
  });

  it('無日期排最後', () => {
    const withDate: MergedPlugin = { ...makeMerged({ name: 'a' }), availableLastUpdated: '2026-01-01T00:00:00Z' };
    const noDate = makeMerged({ name: 'b' });
    expect(compareByLastUpdated(withDate, noDate)).toBeLessThan(0);
    expect(compareByLastUpdated(noDate, withDate)).toBeGreaterThan(0);
  });

  it('兩者皆無日期 → fallback 按名稱排序', () => {
    const a = makeMerged({ name: 'alpha' });
    const b = makeMerged({ name: 'beta' });
    expect(compareByLastUpdated(a, b)).toBeLessThan(0);
  });

  it('日期相同 → fallback 按名稱排序', () => {
    const a: MergedPlugin = { ...makeMerged({ name: 'alpha' }), availableLastUpdated: '2026-02-01T00:00:00Z' };
    const b: MergedPlugin = { ...makeMerged({ name: 'beta' }), availableLastUpdated: '2026-02-01T00:00:00Z' };
    expect(compareByLastUpdated(a, b)).toBeLessThan(0);
  });

  it('優先使用 availableLastUpdated，fallback 到 lastUpdated', () => {
    const withAvailable: MergedPlugin = { ...makeMerged({ name: 'a' }), availableLastUpdated: '2026-02-20T00:00:00Z' };
    const withInstalled: MergedPlugin = { ...makeMerged({ name: 'b' }), lastUpdated: '2026-01-01T00:00:00Z' };
    expect(compareByLastUpdated(withAvailable, withInstalled)).toBeLessThan(0);
  });

  it('invalid date string 視為無日期，排最後', () => {
    const valid: MergedPlugin = { ...makeMerged({ name: 'a' }), availableLastUpdated: '2026-01-01T00:00:00Z' };
    const invalid: MergedPlugin = { ...makeMerged({ name: 'b' }), availableLastUpdated: 'not-a-date' };
    expect(compareByLastUpdated(valid, invalid)).toBeLessThan(0);
    expect(compareByLastUpdated(invalid, valid)).toBeGreaterThan(0);
  });

  it('兩者都是 invalid date → fallback 按名稱排序', () => {
    const a: MergedPlugin = { ...makeMerged({ name: 'alpha' }), availableLastUpdated: 'N/A' };
    const b: MergedPlugin = { ...makeMerged({ name: 'beta' }), availableLastUpdated: 'unknown' };
    expect(compareByLastUpdated(a, b)).toBeLessThan(0);
  });
});

describe('getPluginComparator', () => {
  it('name → 回傳 compareByName', () => {
    expect(getPluginComparator('name')).toBe(compareByName);
  });

  it('lastUpdated → 回傳 compareByLastUpdated', () => {
    expect(getPluginComparator('lastUpdated')).toBe(compareByLastUpdated);
  });
});

describe('readPluginSort / writePluginSort', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockViewState)) delete mockViewState[key];
  });

  it('viewState 無資料 → 預設 name', () => {
    expect(readPluginSort()).toBe('name');
  });

  it('write lastUpdated → read 回 lastUpdated', () => {
    writePluginSort('lastUpdated');
    expect(readPluginSort()).toBe('lastUpdated');
  });

  it('write name → read 回 name', () => {
    writePluginSort('name');
    expect(readPluginSort()).toBe('name');
  });

  it('viewState 含無效值 → fallback name', () => {
    mockViewState[PLUGIN_SORT_KEY] = 'invalid';
    expect(readPluginSort()).toBe('name');
  });
});

describe('readExpandedSections / writeExpandedSections', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockViewState)) delete mockViewState[key];
  });

  it('viewState 無資料 → 空 Set', () => {
    expect(readExpandedSections()).toEqual(new Set());
  });

  it('write 後 read round-trip 保持一致', () => {
    writeExpandedSections(new Set(['mp1', 'mp2']));
    expect(readExpandedSections()).toEqual(new Set(['mp1', 'mp2']));
  });

  it('空 Set round-trip', () => {
    writeExpandedSections(new Set());
    expect(readExpandedSections()).toEqual(new Set());
  });

  it('viewState 含非陣列 → 回空 Set', () => {
    mockViewState[PLUGIN_EXPANDED_KEY] = 'not-array';
    expect(readExpandedSections()).toEqual(new Set());
  });
});

describe('readSectionAssignments / writeSectionAssignments', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockViewState)) delete mockViewState[key];
  });

  it('viewState 無資料 → 空 assignments，nextId=1', () => {
    const result = readSectionAssignments();
    expect(result).toEqual({ assignments: {}, nextId: 1 });
  });

  it('write 後 read round-trip 保持一致', () => {
    const data = { assignments: { mp1: 1, mp2: 2 }, nextId: 3 };
    writeSectionAssignments(data);
    expect(readSectionAssignments()).toEqual(data);
  });

  it('空 assignments round-trip', () => {
    writeSectionAssignments({ assignments: {}, nextId: 1 });
    expect(readSectionAssignments()).toEqual({ assignments: {}, nextId: 1 });
  });

  it('viewState 含無效資料（非 object）→ fallback 空 assignments', () => {
    mockViewState[PLUGIN_SECTIONS_KEY] = 42;
    expect(readSectionAssignments()).toEqual({ assignments: {}, nextId: 1 });
  });

  it('viewState 含 object 但缺 assignments 欄位 → fallback 空 assignments', () => {
    mockViewState[PLUGIN_SECTIONS_KEY] = { foo: 'bar' };
    expect(readSectionAssignments()).toEqual({ assignments: {}, nextId: 1 });
  });

  it('assignments 含非數字 value → 過濾掉無效 entry', () => {
    mockViewState[PLUGIN_SECTIONS_KEY] = { assignments: { mp1: 1, mp2: 'bad', mp3: null }, nextId: 2 };
    const result = readSectionAssignments();
    expect(result.assignments).toEqual({ mp1: 1 });
  });

  it('nextId 小於 max(assignments values)+1 → 自動修正', () => {
    mockViewState[PLUGIN_SECTIONS_KEY] = { assignments: { mp1: 1, mp2: 3 }, nextId: 2 };
    const result = readSectionAssignments();
    expect(result.nextId).toBe(4); // max is 3, nextId must be >= 4
  });

  it('migration：舊 plugin.section2 格式轉換 → assignments[mp]=1', () => {
    mockViewState['plugin.section2'] = ['mp1', 'mp2'];
    const result = readSectionAssignments();
    expect(result).toEqual({ assignments: { mp1: 1, mp2: 1 }, nextId: 2 });
  });

  it('migration：舊 plugin.section2 為空陣列 → 空 assignments', () => {
    mockViewState['plugin.section2'] = [];
    expect(readSectionAssignments()).toEqual({ assignments: {}, nextId: 1 });
  });

  it('新格式優先於舊格式 migration', () => {
    // 同時有新舊格式時，新格式優先
    mockViewState[PLUGIN_SECTIONS_KEY] = { assignments: { mp1: 2 }, nextId: 3 };
    mockViewState['plugin.section2'] = ['mp99'];
    expect(readSectionAssignments()).toEqual({ assignments: { mp1: 2 }, nextId: 3 });
  });
});
