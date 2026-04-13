import { describe, expect, it } from 'vitest';
import {
  resolvePluginInstall,
  extractPluginServerConfigs,
  extractPluginDetailConfig,
  type InstalledPluginEntry,
  type EnabledPluginsByScope,
} from '../mcpPluginSupport';

describe('mcpPluginSupport', () => {
  describe('resolvePluginInstall', () => {
    const createEntry = (scope: string, projectPath?: string): InstalledPluginEntry => ({
      scope,
      installPath: `/path/${scope}`,
      projectPath,
    });

    const createEnabledByScope = (
      user = {} as Record<string, boolean>,
      project = {} as Record<string, boolean>,
      local = {} as Record<string, boolean>,
    ): EnabledPluginsByScope => ({ user, project, local });

    it('user scope entry 不需要 workspace 過濾', () => {
      const entries = [createEntry('user')];
      const enabled = createEnabledByScope({ 'plugin-a': true });

      const result = resolvePluginInstall(entries, 'plugin-a', enabled);

      expect(result.preferredEntry.scope).toBe('user');
      expect(result.enabled).toBe(true);
    });

    it('project/local scope 需要匹配 workspacePath', () => {
      const entries = [
        createEntry('project', '/workspace/a'),
        createEntry('project', '/workspace/b'),
      ];
      const enabled = createEnabledByScope({}, { 'plugin-a': true });

      const result = resolvePluginInstall(entries, 'plugin-a', enabled, '/workspace/a');

      expect(result.preferredEntry.projectPath).toBe('/workspace/a');
    });

    it('無 workspacePath 時過濾 project/local scope', () => {
      const entries = [
        createEntry('user'),
        createEntry('project', '/workspace/a'),
      ];
      const enabled = createEnabledByScope({ 'plugin-a': true });

      const result = resolvePluginInstall(entries, 'plugin-a', enabled);

      expect(result.preferredEntry.scope).toBe('user');
    });

    it('無可用 entry 時拋錯', () => {
      const entries = [createEntry('project', '/workspace/a')];
      const enabled = createEnabledByScope();

      expect(() => resolvePluginInstall(entries, 'plugin-a', enabled)).toThrow(
        'Plugin "plugin-a" not available in current workspace',
      );
    });

    it('優先級: local > project > user', () => {
      const entries = [
        createEntry('user'),
        createEntry('project', '/ws'),
        createEntry('local', '/ws'),
      ];
      const enabled = createEnabledByScope(
        { 'plugin-a': true },
        { 'plugin-a': true },
        { 'plugin-a': true },
      );

      const result = resolvePluginInstall(entries, 'plugin-a', enabled, '/ws');

      expect(result.preferredEntry.scope).toBe('local');
    });

    it('enabled=false 時從所有 entry 選最高優先級', () => {
      const entries = [
        createEntry('user'),
        createEntry('project', '/ws'),
        createEntry('local', '/ws'),
      ];
      const enabled = createEnabledByScope(); // 全部 disabled

      const result = resolvePluginInstall(entries, 'plugin-a', enabled, '/ws');

      expect(result.enabled).toBe(false);
      expect(result.preferredEntry.scope).toBe('local');
    });

    it('enabled=true 時只從 enabled entries 選', () => {
      const entries = [
        createEntry('user'),
        createEntry('project', '/ws'),
        createEntry('local', '/ws'),
      ];
      // 只有 user 和 project enabled，local disabled
      const enabled = createEnabledByScope(
        { 'plugin-a': true },
        { 'plugin-a': true },
        {},
      );

      const result = resolvePluginInstall(entries, 'plugin-a', enabled, '/ws');

      expect(result.enabled).toBe(true);
      // local disabled 所以選 project
      expect(result.preferredEntry.scope).toBe('project');
    });
  });

  describe('extractPluginServerConfigs', () => {
    it('有 mcpServers wrapper 時解開', () => {
      const config = {
        mcpServers: {
          'server-a': { command: 'node', args: ['server.js'] },
        },
      };

      const result = extractPluginServerConfigs(config);

      expect(result).toEqual({ 'server-a': { command: 'node', args: ['server.js'] } });
    });

    it('無 mcpServers 時直接回傳', () => {
      const config = {
        'server-a': { command: 'node', args: ['server.js'] },
      };

      const result = extractPluginServerConfigs(config);

      expect(result).toEqual(config);
    });
  });

  describe('extractPluginDetailConfig', () => {
    it('指定 key 存在時回傳該 key', () => {
      const config = {
        'server-a': { url: 'http://localhost' },
        'server-b': { url: 'http://other' },
      };

      const result = extractPluginDetailConfig(config, 'server-a');

      expect(result).toEqual({ url: 'http://localhost' });
    });

    it('指定 key 不存在時 fallback 回傳整個 config', () => {
      const config = {
        'server-a': { url: 'http://localhost' },
      };

      const result = extractPluginDetailConfig(config, 'server-b');

      expect(result).toEqual(config);
    });
  });
});
