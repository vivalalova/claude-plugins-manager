import { describe, it, expect } from 'vitest';
import { matchesContentType, type ContentTypeFilter } from '../filterUtils';
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
