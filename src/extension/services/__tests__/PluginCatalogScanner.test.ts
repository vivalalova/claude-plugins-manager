import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PluginCatalogScanner } from '../PluginCatalogScanner';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

// Mock jsonFile util
vi.mock('../../utils/jsonFile', () => ({
  readJsonFile: vi.fn(),
}));

import { readFile, readdir, stat } from 'fs/promises';
import { readJsonFile } from '../../utils/jsonFile';

describe('PluginCatalogScanner', () => {
  const defaultOptions = {
    knownMarketplacesPath: '/home/user/.claude/plugins/known_marketplaces.json',
    marketplacesDir: '/home/user/.claude/plugins/marketplaces',
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
        if (p.includes('hooks.json')) {
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
  });

  describe('scanPluginContents', () => {
    it('掃描 commands, skills, agents, mcpServers, hooks', async () => {
      // commands dir
      vi.mocked(readdir).mockResolvedValueOnce(['cmd.md'] as never);
      vi.mocked(readFile).mockResolvedValueOnce('---\nname: My Command\ndescription: Does stuff\n---\n');

      // skills dir - root SKILL.md exists
      vi.mocked(stat).mockResolvedValueOnce({} as never);
      vi.mocked(readFile).mockResolvedValueOnce('---\nname: My Skill\n---\n');

      // agents dir
      vi.mocked(readdir).mockResolvedValueOnce(['agent.md'] as never);
      vi.mocked(readFile).mockResolvedValueOnce('---\nname: My Agent\n---\n');

      // .mcp.json
      vi.mocked(readJsonFile).mockResolvedValueOnce({
        mcpServers: { 'server-1': { command: 'node' } },
      });

      // hooks.json exists
      vi.mocked(stat).mockResolvedValueOnce({} as never);

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
