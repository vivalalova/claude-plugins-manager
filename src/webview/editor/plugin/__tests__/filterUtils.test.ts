/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchesContentType,
  readContentTypeFilters,
  writeContentTypeFilters,
  CONTENT_TYPE_STORAGE_KEY,
  type ContentTypeFilter,
} from '../filterUtils';
import type { MergedPlugin, PluginContents } from '../../../../shared/types';

/** 建立測試用 MergedPlugin（只需 contents 欄位） */
function makeMerged(contents?: Partial<PluginContents>): MergedPlugin {
  return {
    id: 'test@mp',
    name: 'test',
    userInstall: null,
    projectInstalls: [],
    localInstall: null,
    contents: contents ? {
      commands: [],
      skills: [],
      agents: [],
      mcpServers: [],
      hooks: false,
      ...contents,
    } : undefined,
  };
}

describe('matchesContentType', () => {
  describe('無 filter 時', () => {
    it('filters 為空 Set → 所有 plugin 通過', () => {
      const plugin = makeMerged({ skills: [{ name: 'a', description: '' }] });
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
      const plugin = makeMerged(partial);
      expect(matchesContentType(plugin, new Set([type]))).toBe(true);
    });

    it('skills filter 不命中只有 commands 的 plugin', () => {
      const plugin = makeMerged({ commands: [{ name: 'cmd', description: '' }] });
      expect(matchesContentType(plugin, new Set(['skills']))).toBe(false);
    });

    it('mcp filter 不命中 mcpServers 為空的 plugin', () => {
      const plugin = makeMerged({ mcpServers: [] });
      expect(matchesContentType(plugin, new Set(['mcp']))).toBe(false);
    });
  });

  describe('多選 filter（OR 邏輯）', () => {
    it('Skills + MCP → 有 skills 的 plugin 通過', () => {
      const plugin = makeMerged({ skills: [{ name: 'sk', description: '' }] });
      expect(matchesContentType(plugin, new Set(['skills', 'mcp']))).toBe(true);
    });

    it('Skills + MCP → 有 mcp 的 plugin 通過', () => {
      const plugin = makeMerged({ mcpServers: ['s1'] });
      expect(matchesContentType(plugin, new Set(['skills', 'mcp']))).toBe(true);
    });

    it('Skills + MCP → 只有 commands 的 plugin 不通過', () => {
      const plugin = makeMerged({ commands: [{ name: 'c', description: '' }] });
      expect(matchesContentType(plugin, new Set(['skills', 'mcp']))).toBe(false);
    });
  });

  describe('空 contents（所有陣列皆空）', () => {
    it('有 filter 但所有 content 為空 → 不通過', () => {
      const plugin = makeMerged({});
      expect(matchesContentType(plugin, new Set(['commands', 'skills', 'agents', 'mcp']))).toBe(false);
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
