/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchesContentType,
  matchesSearch,
  readContentTypeFilters,
  writeContentTypeFilters,
  CONTENT_TYPE_STORAGE_KEY,
  hasPluginUpdate,
  type ContentTypeFilter,
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
    localStorage.clear();
  });

  it('localStorage 無資料 → 空 Set', () => {
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

  it('localStorage 含無效值 → 過濾掉，只保留合法 filter', () => {
    localStorage.setItem(CONTENT_TYPE_STORAGE_KEY, '["skills","invalid","mcp"]');
    expect(readContentTypeFilters()).toEqual(new Set(['skills', 'mcp']));
  });

  it('localStorage 含非 JSON → 清除並回空 Set', () => {
    localStorage.setItem(CONTENT_TYPE_STORAGE_KEY, 'not-json');
    expect(readContentTypeFilters()).toEqual(new Set());
    expect(localStorage.getItem(CONTENT_TYPE_STORAGE_KEY)).toBeNull();
  });

  it('localStorage 含非陣列 JSON → 回空 Set', () => {
    localStorage.setItem(CONTENT_TYPE_STORAGE_KEY, '{"a":1}');
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
