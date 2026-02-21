import { describe, it, expect } from 'vitest';
import {
  buildResourceMap,
  findConflicts,
} from '../dependencyUtils';
import type { MergedPlugin, PluginContents } from '../../../../shared/types';

function makeContents(overrides: Partial<PluginContents> = {}): PluginContents {
  return {
    commands: [],
    skills: [],
    agents: [],
    mcpServers: [],
    hooks: false,
    ...overrides,
  };
}

function makePlugin(id: string, contents?: Partial<PluginContents>): MergedPlugin {
  const [name, marketplace] = id.split('@');
  return {
    id,
    name,
    marketplaceName: marketplace,
    contents: contents ? makeContents(contents) : undefined,
    userInstall: null,
    projectInstalls: [],
    localInstall: null,
  };
}

describe('dependencyUtils', () => {
  describe('buildResourceMap', () => {
    it('MCP server 被正確映射到提供者 plugin', () => {
      const plugins = [
        makePlugin('a@mp', { mcpServers: ['web-search', 'db-query'] }),
        makePlugin('b@mp', { mcpServers: ['code-runner'] }),
      ];

      const map = buildResourceMap(plugins);

      expect(map.get('mcp:web-search')).toEqual([{ type: 'mcp', name: 'web-search', pluginId: 'a@mp' }]);
      expect(map.get('mcp:db-query')).toEqual([{ type: 'mcp', name: 'db-query', pluginId: 'a@mp' }]);
      expect(map.get('mcp:code-runner')).toEqual([{ type: 'mcp', name: 'code-runner', pluginId: 'b@mp' }]);
    });

    it('commands/skills/agents 被正確映射', () => {
      const plugins = [
        makePlugin('a@mp', {
          commands: [{ name: 'cmd-x', description: '' }],
          skills: [{ name: 'skill-y', description: '' }],
          agents: [{ name: 'agent-z', description: '' }],
        }),
      ];

      const map = buildResourceMap(plugins);

      expect(map.get('command:cmd-x')).toEqual([{ type: 'command', name: 'cmd-x', pluginId: 'a@mp' }]);
      expect(map.get('skill:skill-y')).toEqual([{ type: 'skill', name: 'skill-y', pluginId: 'a@mp' }]);
      expect(map.get('agent:agent-z')).toEqual([{ type: 'agent', name: 'agent-z', pluginId: 'a@mp' }]);
    });

    it('無 contents 的 plugin 被跳過', () => {
      const plugins = [
        makePlugin('no-content@mp'),
        makePlugin('has-content@mp', { mcpServers: ['srv'] }),
      ];

      const map = buildResourceMap(plugins);

      expect(map.size).toBe(1);
      expect(map.get('mcp:srv')).toHaveLength(1);
    });

    it('同名 resource 來自多個 plugin → 同一 key 下多筆', () => {
      const plugins = [
        makePlugin('a@mp1', { mcpServers: ['shared-srv'] }),
        makePlugin('b@mp2', { mcpServers: ['shared-srv'] }),
      ];

      const map = buildResourceMap(plugins);

      expect(map.get('mcp:shared-srv')).toHaveLength(2);
      expect(map.get('mcp:shared-srv')!.map((e) => e.pluginId)).toEqual(['a@mp1', 'b@mp2']);
    });

    it('空 plugin 列表 → 空 map', () => {
      expect(buildResourceMap([]).size).toBe(0);
    });
  });

  describe('findConflicts', () => {
    it('兩個 plugin 提供相同 MCP server → 衝突', () => {
      const plugins = [
        makePlugin('a@mp', { mcpServers: ['web-search'] }),
        makePlugin('b@mp', { mcpServers: ['web-search'] }),
      ];

      const conflicts = findConflicts(plugins);

      expect(conflicts).toEqual([
        { type: 'mcp', name: 'web-search', pluginIds: ['a@mp', 'b@mp'] },
      ]);
    });

    it('相同 command name 跨 plugin → 衝突', () => {
      const plugins = [
        makePlugin('a@mp', { commands: [{ name: 'deploy', description: 'A' }] }),
        makePlugin('b@mp', { commands: [{ name: 'deploy', description: 'B' }] }),
      ];

      const conflicts = findConflicts(plugins);

      expect(conflicts).toEqual([
        { type: 'command', name: 'deploy', pluginIds: ['a@mp', 'b@mp'] },
      ]);
    });

    it('無衝突 → 空陣列', () => {
      const plugins = [
        makePlugin('a@mp', { mcpServers: ['srv-a'] }),
        makePlugin('b@mp', { mcpServers: ['srv-b'] }),
      ];

      expect(findConflicts(plugins)).toEqual([]);
    });

    it('多種 resource type 同時衝突', () => {
      const plugins = [
        makePlugin('a@mp', {
          mcpServers: ['shared'],
          skills: [{ name: 'shared-skill', description: '' }],
        }),
        makePlugin('b@mp', {
          mcpServers: ['shared'],
          skills: [{ name: 'shared-skill', description: '' }],
        }),
      ];

      const conflicts = findConflicts(plugins);

      expect(conflicts).toHaveLength(2);
      expect(conflicts.map((c) => c.name)).toContain('shared');
      expect(conflicts.map((c) => c.name)).toContain('shared-skill');
    });

    it('三個 plugin 衝突同一 resource', () => {
      const plugins = [
        makePlugin('a@mp', { mcpServers: ['srv'] }),
        makePlugin('b@mp', { mcpServers: ['srv'] }),
        makePlugin('c@mp', { mcpServers: ['srv'] }),
      ];

      const conflicts = findConflicts(plugins);

      expect(conflicts).toEqual([
        { type: 'mcp', name: 'srv', pluginIds: ['a@mp', 'b@mp', 'c@mp'] },
      ]);
    });
  });

    it('hooks: true 不產生衝突（boolean 非命名資源）', () => {
      const plugins = [
        makePlugin('a@mp', { hooks: true }),
        makePlugin('b@mp', { hooks: true }),
      ];

      expect(findConflicts(plugins)).toEqual([]);
    });
});
