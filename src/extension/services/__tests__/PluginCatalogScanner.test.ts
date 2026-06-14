import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PluginCatalogScanner } from '../PluginCatalogScanner';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  lstat: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  realpath: vi.fn(),
  stat: vi.fn(),
}));

// Mock jsonFile util
vi.mock('../../utils/jsonFile', () => ({
  readJsonFile: vi.fn(),
}));

import { lstat, readFile, readdir, realpath, stat } from 'fs/promises';
import { readJsonFile } from '../../utils/jsonFile';

describe('PluginCatalogScanner', () => {
  const defaultOptions = {
    knownMarketplacesPath: '/home/user/.claude/plugins/known_marketplaces.json',
    marketplacesDir: '/home/user/.claude/plugins/marketplaces',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lstat).mockResolvedValue({ isSymbolicLink: () => false } as never);
    vi.mocked(realpath).mockImplementation(async (filePath) => String(filePath) as never);
  });

  describe('scanCatalog', () => {
    it('known_marketplaces.json 不存在時回傳空結果', async () => {
      vi.mocked(readJsonFile).mockRejectedValueOnce(new Error('ENOENT'));

      const scanner = new PluginCatalogScanner(defaultOptions);
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins).toEqual([]);
      expect(result.scannableMarketplaceNames.size).toBe(0);
    });

    it('掃描單一 marketplace 的 plugins', async () => {
      // Mock known_marketplaces.json 和 marketplace.json
      vi.mocked(readJsonFile)
        .mockImplementation(async (path: string) => {
          if (path.includes('known_marketplaces')) {
            return { 'official': { installLocation: '/mp/official' } };
          }
          if (path.includes('marketplace.json')) {
            return {
              plugins: [
                { name: 'plugin-a', description: 'Plugin A', source: './plugins/a' },
              ],
            };
          }
          if (path.includes('plugin.json')) {
            return { description: 'Detailed A', version: '1.0.0' };
          }
          if (path.includes('.mcp.json')) {
            return {};
          }
          return {};
        });

      // Mock stat
      vi.mocked(stat).mockImplementation(async (path) => {
        const p = String(path);
        if (p.includes('hooks.json') || p.endsWith('/skills/SKILL.md')) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return { mtimeMs: Date.now() } as never;
      });

      // Mock readdir
      vi.mocked(readdir).mockImplementation(async (path) => {
        const p = String(path);
        if (p.includes('commands') || p.includes('agents')) {
          return [] as never;
        }
        if (p.includes('skills')) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return ['file.txt'] as never;
      });

      const scanner = new PluginCatalogScanner(defaultOptions);
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins).toHaveLength(1);
      expect(result.availablePlugins[0]).toMatchObject({
        pluginId: 'plugin-a@official',
        name: 'plugin-a',
        description: 'Detailed A',
        version: '1.0.0',
        marketplaceName: 'official',
        sourceDir: './plugins/a',
      });
      expect(result.scannableMarketplaceNames.has('official')).toBe(true);
    });

    it('marketplace manifest 不存在時標記為不可掃描', async () => {
      vi.mocked(readJsonFile)
        .mockResolvedValueOnce({ 'broken': {} })
        .mockRejectedValueOnce({ code: 'ENOENT' });

      const scanner = new PluginCatalogScanner(defaultOptions);
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins).toEqual([]);
      expect(result.scannableMarketplaceNames.has('broken')).toBe(false);
    });

    it('plugin 目錄不存在時 sourceDir 為 undefined', async () => {
      vi.mocked(readJsonFile)
        .mockResolvedValueOnce({ 'mp': {} })
        .mockResolvedValueOnce({
          plugins: [{ name: 'missing', source: './plugins/missing' }],
        });

      // Plugin dir stat fails
      vi.mocked(stat).mockRejectedValueOnce({ code: 'ENOENT' });

      const scanner = new PluginCatalogScanner(defaultOptions);
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins[0].sourceDir).toBeUndefined();
      expect(result.availablePlugins[0].contents).toBeUndefined();
    });

    it('拒絕掃描逃出 marketplace 目錄的 plugin source', async () => {
      vi.mocked(readJsonFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('known_marketplaces')) {
          return { 'mp': { installLocation: '/safe/marketplace' } };
        }
        if (filePath.includes('marketplace.json')) {
          return {
            plugins: [{ name: 'escape', description: 'Manifest desc', source: '../../outside' }],
          };
        }
        if (filePath.includes('/outside/.claude-plugin/plugin.json')) {
          return { description: 'Outside desc', version: '9.9.9' };
        }
        return {};
      });
      vi.mocked(stat).mockResolvedValue({ mtimeMs: Date.now() } as never);

      const scanner = new PluginCatalogScanner(defaultOptions);
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins[0]).toMatchObject({
        name: 'escape',
        description: 'Manifest desc',
        version: undefined,
        sourceDir: undefined,
        contents: undefined,
      });
      expect(readJsonFile).not.toHaveBeenCalledWith(
        '/outside/.claude-plugin/plugin.json',
        expect.anything(),
      );
    });

    it('拒絕掃描 symlink 逃出 marketplace 目錄的 plugin source', async () => {
      vi.mocked(readJsonFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('known_marketplaces')) {
          return { 'mp': { installLocation: '/safe/marketplace' } };
        }
        if (filePath.includes('marketplace.json')) {
          return {
            plugins: [{ name: 'escape-link', description: 'Manifest desc', source: './plugins/link' }],
          };
        }
        if (filePath.includes('plugin.json')) {
          return { description: 'Outside desc', version: '9.9.9' };
        }
        if (filePath.includes('.mcp.json')) {
          return {};
        }
        return {};
      });
      vi.mocked(realpath).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p === '/safe/marketplace') return '/safe/marketplace' as never;
        if (p === '/safe/marketplace/plugins/link') return '/outside/plugin' as never;
        return p as never;
      });
      vi.mocked(stat).mockResolvedValue({ mtimeMs: Date.now() } as never);
      vi.mocked(readdir).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.includes('/plugins/link/commands')) {
          return ['secret.md'] as never;
        }
        if (p.includes('/plugins/link/skills') || p.includes('/plugins/link/agents')) {
          return [] as never;
        }
        return [] as never;
      });
      vi.mocked(readFile).mockResolvedValue('---\nname: Secret Command\ndescription: outside\n---\n');

      const scanner = new PluginCatalogScanner(defaultOptions);
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins[0]).toMatchObject({
        name: 'escape-link',
        description: 'Manifest desc',
        version: undefined,
        sourceDir: undefined,
        contents: undefined,
      });
      expect(readFile).not.toHaveBeenCalledWith(
        '/safe/marketplace/plugins/link/commands/secret.md',
        'utf-8',
      );
    });

    it('允許掃描 symlink 指向 marketplace 內部的 plugin source', async () => {
      vi.mocked(readJsonFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('known_marketplaces')) {
          return { 'mp': { installLocation: '/safe/marketplace' } };
        }
        if (filePath.includes('marketplace.json')) {
          return {
            plugins: [{ name: 'inside-link', description: 'Manifest desc', source: './plugins/link' }],
          };
        }
        if (filePath.includes('plugin.json')) {
          return { description: 'Inside desc', version: '1.2.3' };
        }
        if (filePath.includes('.mcp.json')) {
          return {};
        }
        return {};
      });
      vi.mocked(lstat).mockImplementation(async (filePath) => ({
        isSymbolicLink: () => String(filePath) === '/safe/marketplace/plugins/link',
      }) as never);
      vi.mocked(realpath).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p === '/safe/marketplace/plugins/link') return '/safe/marketplace/plugins/actual' as never;
        if (p.startsWith('/safe/marketplace/plugins/link/')) {
          return p.replace('/safe/marketplace/plugins/link/', '/safe/marketplace/plugins/actual/') as never;
        }
        return p as never;
      });
      vi.mocked(stat).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.includes('hooks.json') || p.endsWith('/skills/SKILL.md')) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return { mtimeMs: Date.now() } as never;
      });
      vi.mocked(readdir).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.includes('/plugins/link/commands')) return ['cmd.md'] as never;
        if (p.includes('/plugins/link/skills') || p.includes('/plugins/link/agents')) return [] as never;
        return [] as never;
      });
      vi.mocked(readFile).mockResolvedValue('---\nname: Linked Command\ndescription: inside\n---\n');

      const scanner = new PluginCatalogScanner(defaultOptions);
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins[0]).toMatchObject({
        name: 'inside-link',
        description: 'Inside desc',
        version: '1.2.3',
        sourceDir: './plugins/link',
      });
      expect(result.availablePlugins[0].contents?.commands).toEqual([
        expect.objectContaining({ name: 'Linked Command', description: 'inside' }),
      ]);
    });

    it('拒絕掃描 plugin 內 symlink 逃出的 commands 目錄', async () => {
      vi.mocked(readJsonFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('known_marketplaces')) {
          return { 'mp': { installLocation: '/safe/marketplace' } };
        }
        if (filePath.includes('marketplace.json')) {
          return {
            plugins: [{ name: 'plugin-a', description: 'Plugin A', source: './plugins/a' }],
          };
        }
        if (filePath.includes('plugin.json')) {
          return { description: 'Plugin A json', version: '1.0.0' };
        }
        if (filePath.includes('.mcp.json')) {
          return {};
        }
        return {};
      });
      vi.mocked(realpath).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p === '/safe/marketplace/plugins/a/commands') return '/outside/commands' as never;
        return p as never;
      });
      vi.mocked(stat).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.includes('hooks.json') || p.includes('/plugins/a/skills/SKILL.md')) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return { mtimeMs: Date.now() } as never;
      });
      vi.mocked(readdir).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.includes('/plugins/a/commands')) return ['secret.md'] as never;
        if (p.includes('/plugins/a/skills') || p.includes('/plugins/a/agents')) return [] as never;
        return [] as never;
      });
      vi.mocked(readFile).mockResolvedValue('---\nname: Secret Command\ndescription: outside\n---\n');

      const scanner = new PluginCatalogScanner(defaultOptions);
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins[0].contents?.commands).toEqual([]);
      expect(readFile).not.toHaveBeenCalledWith(
        '/safe/marketplace/plugins/a/commands/secret.md',
        'utf-8',
      );
    });

    it('拒絕掃描 plugin 內 symlink 逃出的 SKILL.md 檔案', async () => {
      vi.mocked(readJsonFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('known_marketplaces')) {
          return { 'mp': { installLocation: '/safe/marketplace' } };
        }
        if (filePath.includes('marketplace.json')) {
          return {
            plugins: [{
              name: 'plugin-a',
              description: 'Plugin A',
              source: './plugins/a',
              skills: ['skills'],
            }],
          };
        }
        if (filePath.includes('plugin.json')) {
          return { description: 'Plugin A json', version: '1.0.0' };
        }
        if (filePath.includes('.mcp.json')) {
          return {};
        }
        return {};
      });
      vi.mocked(realpath).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p === '/safe/marketplace/plugins/a/skills/SKILL.md') return '/outside/SKILL.md' as never;
        return p as never;
      });
      vi.mocked(stat).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.includes('hooks.json')) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return { mtimeMs: Date.now() } as never;
      });
      vi.mocked(readdir).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.includes('/plugins/a/commands') || p.includes('/plugins/a/agents')) return [] as never;
        if (p.includes('/plugins/a/skills')) return [] as never;
        return [] as never;
      });
      vi.mocked(readFile).mockResolvedValue('---\nname: Outside Skill\ndescription: outside\n---\n');

      const scanner = new PluginCatalogScanner(defaultOptions);
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins[0].contents?.skills).toEqual([]);
      expect(readFile).not.toHaveBeenCalledWith(
        '/safe/marketplace/plugins/a/skills/SKILL.md',
        'utf-8',
      );
    });

    it('拒絕掃描逃出 plugin 目錄的 declared skills path', async () => {
      vi.mocked(readJsonFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('known_marketplaces')) {
          return { 'mp': { installLocation: '/safe/marketplace' } };
        }
        if (filePath.includes('marketplace.json')) {
          return {
            plugins: [{
              name: 'plugin-a',
              description: 'Plugin A',
              source: './plugins/a',
              skills: ['../../outside-skills'],
            }],
          };
        }
        if (filePath.includes('plugin.json')) {
          return { description: 'Plugin A json', version: '1.0.0' };
        }
        if (filePath.includes('.mcp.json')) {
          return {};
        }
        return {};
      });
      vi.mocked(stat).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.includes('hooks.json') || p.includes('/plugins/a/skills/SKILL.md')) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return { mtimeMs: Date.now() } as never;
      });
      vi.mocked(readdir).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.includes('/outside-skills')) {
          return ['secret'] as never;
        }
        if (p.includes('commands') || p.includes('agents') || p.includes('/plugins/a/skills')) {
          return [] as never;
        }
        return ['file.txt'] as never;
      });
      vi.mocked(readFile).mockResolvedValue('---\nname: Outside Skill\ndescription: outside\n---\n');

      const scanner = new PluginCatalogScanner(defaultOptions);
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins[0].contents?.skills).toEqual([]);
      expect(readdir).not.toHaveBeenCalledWith('/safe/marketplace/outside-skills', { withFileTypes: true });
    });
  });

  describe('scanPluginContents', () => {
    it('掃描 commands, skills, agents, mcpServers, hooks', async () => {
      vi.mocked(readdir).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.endsWith('/commands')) return ['cmd.md'] as never;
        if (p.endsWith('/agents')) return ['agent.md'] as never;
        return [] as never;
      });
      vi.mocked(stat).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.endsWith('/skills/SKILL.md') || p.endsWith('/hooks/hooks.json')) {
          return {} as never;
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });
      vi.mocked(readFile).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.endsWith('/commands/cmd.md')) {
          return '---\nname: My Command\ndescription: Does stuff\n---\n';
        }
        if (p.endsWith('/skills/SKILL.md')) {
          return '---\nname: My Skill\n---\n';
        }
        if (p.endsWith('/agents/agent.md')) {
          return '---\nname: My Agent\n---\n';
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });

      // .mcp.json
      vi.mocked(readJsonFile).mockResolvedValueOnce({
        mcpServers: { 'server-1': { command: 'node' } },
      });

      const scanner = new PluginCatalogScanner(defaultOptions);
      const contents = await scanner.scanPluginContents('/plugin/dir');

      expect(contents.commands).toHaveLength(1);
      expect(contents.commands[0].name).toBe('My Command');
      expect(contents.skills).toHaveLength(1);
      expect(contents.skills[0].name).toBe('My Skill');
      expect(contents.agents).toHaveLength(1);
      expect(contents.agents[0].name).toBe('My Agent');
      expect(contents.mcpServers).toEqual(['server-1']);
      expect(contents.hooks).toBe(true);
    });

    it('目錄不存在時回傳空陣列', async () => {
      vi.mocked(readdir).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(stat).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(readJsonFile).mockRejectedValueOnce({ code: 'ENOENT' });

      const scanner = new PluginCatalogScanner(defaultOptions);
      const contents = await scanner.scanPluginContents('/nonexistent');

      expect(contents.commands).toEqual([]);
      expect(contents.skills).toEqual([]);
      expect(contents.agents).toEqual([]);
      expect(contents.mcpServers).toEqual([]);
      expect(contents.hooks).toBe(false);
    });

    it('.mcp.json invalid JSON → 不吞成空 MCP servers', async () => {
      vi.mocked(readdir).mockResolvedValue([] as never);
      vi.mocked(stat).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(readJsonFile).mockRejectedValueOnce(new Error('Invalid JSON in /plugin/dir/.mcp.json'));

      const scanner = new PluginCatalogScanner(defaultOptions);

      await expect(scanner.scanPluginContents('/plugin/dir'))
        .rejects.toThrow('Invalid JSON in /plugin/dir/.mcp.json');
    });

    it('.mcp.json mcpServers shape 不合法 → 不吞成空 MCP servers', async () => {
      vi.mocked(readdir).mockResolvedValue([] as never);
      vi.mocked(stat).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(readJsonFile).mockResolvedValueOnce({ mcpServers: [] });

      const scanner = new PluginCatalogScanner(defaultOptions);

      await expect(scanner.scanPluginContents('/plugin/dir'))
        .rejects.toThrow('mcpServers must be an object');
    });

    it('拒絕掃描入口 pluginDir 本身 symlink 逃出的內容', async () => {
      vi.mocked(lstat).mockImplementation(async (filePath) => ({
        isSymbolicLink: () => String(filePath) === '/safe/cache/plugin-link',
      }) as never);
      vi.mocked(realpath).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p === '/safe/cache/plugin-link') return '/outside/plugin' as never;
        if (p === '/safe/cache/plugin-link/commands') return '/outside/plugin/commands' as never;
        if (p === '/safe/cache/plugin-link/commands/secret.md') return '/outside/plugin/commands/secret.md' as never;
        return p as never;
      });
      vi.mocked(readdir).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.endsWith('/commands')) return ['secret.md'] as never;
        if (p.endsWith('/skills') || p.endsWith('/agents')) return [] as never;
        return [] as never;
      });
      vi.mocked(readJsonFile).mockImplementation(async (filePath: string) => {
        if (filePath.endsWith('.mcp.json')) {
          return { mcpServers: { outside: { command: 'node' } } };
        }
        return {};
      });
      vi.mocked(stat).mockImplementation(async (filePath) => {
        const p = String(filePath);
        if (p.endsWith('/hooks/hooks.json') || p.endsWith('/skills/SKILL.md')) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return { mtimeMs: Date.now() } as never;
      });
      vi.mocked(readFile).mockResolvedValue('---\nname: Outside Command\n---\n');

      const scanner = new PluginCatalogScanner(defaultOptions);
      const contents = await scanner.scanPluginContents('/safe/cache/plugin-link');

      expect(contents).toEqual({
        commands: [],
        skills: [],
        agents: [],
        mcpServers: [],
        hooks: false,
      });
      expect(readFile).not.toHaveBeenCalledWith(
        '/safe/cache/plugin-link/commands/secret.md',
        'utf-8',
      );
    });
  });

  describe('readMarketplaceSources', () => {
    it('從 known_marketplaces 提取 source URLs', async () => {
      vi.mocked(readJsonFile).mockResolvedValueOnce({
        'mp1': { source: { url: 'https://github.com/example/mp1' } },
        'mp2': { source: { repo: 'example/mp2' } },
        'mp3': { source: { path: '/local/path' } },
        'mp4': {}, // no source
      });

      const scanner = new PluginCatalogScanner(defaultOptions);
      const sources = await scanner.readMarketplaceSources();

      expect(sources).toEqual({
        'mp1': 'https://github.com/example/mp1',
        'mp2': 'example/mp2',
        'mp3': '/local/path',
      });
    });
  });
});

// Test helper functions exported via module (if they were exported)
// Since they're private, we test them indirectly through scanCatalog
describe('PluginCatalogScanner helper functions (via integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSourceFormat inference', () => {
    it.each([
      ['local-internal', './plugins/foo'],
      ['local-external', './external_plugins/foo'],
    ])('source=%s 推論為 %s', async (expected, source) => {
      vi.mocked(readJsonFile)
        .mockResolvedValueOnce({ 'mp': {} })
        .mockResolvedValueOnce({ plugins: [{ name: 'p', source }] });
      vi.mocked(stat).mockRejectedValueOnce({ code: 'ENOENT' });

      const scanner = new PluginCatalogScanner({
        knownMarketplacesPath: '/kmp.json',
        marketplacesDir: '/mp',
      });
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins[0].sourceFormat).toBe(expected);
    });
  });

  describe('extractSourceUrl', () => {
    it.each([
      [{ source: 'npm', package: 'my-pkg' }, 'https://www.npmjs.com/package/my-pkg'],
      [{ source: 'pip', package: 'my-pkg' }, 'https://pypi.org/project/my-pkg'],
      [{ source: 'github', repo: 'user/repo' }, 'https://github.com/user/repo'],
      [{ source: 'git-subdir', url: 'https://github.com/user/repo', path: 'sub' }, 'https://github.com/user/repo/tree/main/sub'],
    ])('source=%j → %s', async (source, expectedUrl) => {
      vi.mocked(readJsonFile)
        .mockResolvedValueOnce({ 'mp': {} })
        .mockResolvedValueOnce({ plugins: [{ name: 'p', source }] });
      vi.mocked(stat).mockRejectedValueOnce({ code: 'ENOENT' });

      const scanner = new PluginCatalogScanner({
        knownMarketplacesPath: '/kmp.json',
        marketplacesDir: '/mp',
      });
      const result = await scanner.scanCatalog();

      expect(result.availablePlugins[0].sourceUrl).toBe(expectedUrl);
    });
  });
});
