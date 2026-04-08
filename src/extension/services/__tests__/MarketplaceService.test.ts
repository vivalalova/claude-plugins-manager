import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceService } from '../MarketplaceService';
import { CLI_LONG_TIMEOUT_MS } from '../../constants';
import type { CliService } from '../CliService';
import type { SettingsFileService } from '../SettingsFileService';
import type { InstalledPluginsFile } from '../../../shared/types';

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockMkdtemp = vi.hoisted(() => vi.fn());
const mockRm = vi.hoisted(() => vi.fn());
const mockAccess = vi.hoisted(() => vi.fn());
const mockExecFile = vi.hoisted(() => vi.fn());
const mockFixScriptPermissions = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdtemp: mockMkdtemp,
  rm: mockRm,
  access: mockAccess,
}));

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}));

vi.mock('../../utils/fixScriptPermissions', () => ({
  fixScriptPermissions: mockFixScriptPermissions,
}));

function createMockCli(): { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService {
  return {
    exec: vi.fn().mockResolvedValue(''),
    execJson: vi.fn().mockResolvedValue({}),
  } as unknown as { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService;
}

function createMockSettings(): SettingsFileService & Record<string, ReturnType<typeof vi.fn>> {
  return {
    readInstalledPlugins: vi.fn().mockResolvedValue({ version: 2, plugins: {} } satisfies InstalledPluginsFile),
    readAllEnabledPlugins: vi.fn().mockResolvedValue({ user: {}, project: {}, local: {} }),
    replaceEnabledPlugins: vi.fn().mockResolvedValue(undefined),
  } as unknown as SettingsFileService & Record<string, ReturnType<typeof vi.fn>>;
}

const MOCK_CONFIG = {
  'my-marketplace': {
    source: { source: 'github', repo: 'owner/repo' },
    installLocation: '/path/to/marketplace',
    lastUpdated: '2026-02-09T06:00:00.000Z',
    autoUpdate: true,
  },
  'local-plugins': {
    source: { source: 'directory', path: '/local/path' },
    installLocation: '/local/path',
    lastUpdated: '2026-02-08T12:00:00.000Z',
    autoUpdate: false,
  },
};

describe('MarketplaceService', () => {
  let cli: ReturnType<typeof createMockCli>;
  let settings: ReturnType<typeof createMockSettings>;
  let svc: MarketplaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    cli = createMockCli();
    settings = createMockSettings();
    svc = new MarketplaceService(cli, settings);
    mockReadFile.mockResolvedValue(JSON.stringify(MOCK_CONFIG));
    mockWriteFile.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
  });

  describe('list()', () => {
    it('讀取 config file 並 flatten 為 Marketplace[]', async () => {
      const result = await svc.list();

      expect(result).toEqual([
        {
          name: 'my-marketplace',
          source: 'github',
          repo: 'owner/repo',
          url: undefined,
          path: undefined,
          installLocation: '/path/to/marketplace',
          lastUpdated: '2026-02-09T06:00:00.000Z',
          autoUpdate: true,
        },
        {
          name: 'local-plugins',
          source: 'directory',
          path: '/local/path',
          url: undefined,
          repo: undefined,
          installLocation: '/local/path',
          lastUpdated: '2026-02-08T12:00:00.000Z',
          autoUpdate: false,
        },
      ]);
    });
  });

  describe('add()', () => {
    it('呼叫正確 CLI args + long timeout', async () => {
      await svc.add('https://github.com/owner/repo');
      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'marketplace', 'add', 'https://github.com/owner/repo'],
        { timeout: CLI_LONG_TIMEOUT_MS },
      );
    });

    it('CLI 失敗 → error 往上拋，不寫 config file', async () => {
      cli.exec.mockRejectedValue(new Error('CLI add failed'));
      await expect(svc.add('https://github.com/owner/repo')).rejects.toThrow('CLI add failed');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('add 進行中時，toggleAutoUpdate 會等待前一個 mutation 完成', async () => {
      let markAddStarted!: () => void;
      const addStarted = new Promise<void>((resolve) => {
        markAddStarted = resolve;
      });
      let releaseAdd!: (value: string) => void;
      cli.exec.mockImplementation(() => new Promise<string>((resolve) => {
        markAddStarted();
        releaseAdd = resolve;
      }));

      const addPromise = svc.add('https://github.com/owner/repo');
      await addStarted;
      expect(cli.exec).toHaveBeenCalledTimes(1);

      const togglePromise = svc.toggleAutoUpdate('my-marketplace');
      await Promise.resolve();

      expect(mockWriteFile).not.toHaveBeenCalled();

      mockReadFile.mockResolvedValue(JSON.stringify({
        ...MOCK_CONFIG,
        fresh: {
          source: { source: 'github', repo: 'owner/fresh' },
          installLocation: '/path/to/fresh',
          lastUpdated: '2026-03-02T00:01:00.000Z',
          autoUpdate: false,
        },
      }));
      releaseAdd('');

      await Promise.all([addPromise, togglePromise]);

      expect(mockWriteFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('remove()', () => {
    it('呼叫正確 CLI args', async () => {
      await svc.remove('my-marketplace');
      expect(cli.exec).toHaveBeenCalledWith(['plugin', 'marketplace', 'remove', 'my-marketplace']);
    });

    it('CLI 失敗 → error 往上拋', async () => {
      cli.exec.mockRejectedValue(new Error('CLI remove failed'));
      await expect(svc.remove('my-marketplace')).rejects.toThrow('CLI remove failed');
    });
  });

  describe('update()', () => {
    it('無 name → 不帶 name arg', async () => {
      await svc.update();
      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'marketplace', 'update'],
        { timeout: CLI_LONG_TIMEOUT_MS },
      );
    });

    it('有 name → 加 name arg', async () => {
      await svc.update('my-marketplace');
      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'marketplace', 'update', 'my-marketplace'],
        { timeout: CLI_LONG_TIMEOUT_MS },
      );
    });

    it('CLI 失敗 → error 往上拋，不呼叫 fixScriptPermissions', async () => {
      cli.exec.mockRejectedValue(new Error('CLI update failed'));
      await expect(svc.update('my-marketplace')).rejects.toThrow('CLI update failed');
      expect(mockFixScriptPermissions).not.toHaveBeenCalled();
    });

    it('update 成功 → 呼叫 fixScriptPermissions 修正 installLocation 下的 .sh 權限', async () => {
      await svc.update('my-marketplace');
      expect(mockFixScriptPermissions).toHaveBeenCalledWith('/path/to/marketplace');
    });

    it('update 全部（無 name）→ fixScriptPermissions 對每個 installLocation 各呼叫一次', async () => {
      await svc.update();
      expect(mockFixScriptPermissions).toHaveBeenCalledWith('/path/to/marketplace');
      expect(mockFixScriptPermissions).toHaveBeenCalledWith('/local/path');
      expect(mockFixScriptPermissions).toHaveBeenCalledTimes(2);
    });
  });

  describe('toggleAutoUpdate()', () => {
    it('翻轉 autoUpdate flag 並寫回 config', async () => {
      await svc.toggleAutoUpdate('my-marketplace');

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
      expect(written['my-marketplace'].autoUpdate).toBe(false);
    });

    it('不存在的 name 拋錯', async () => {
      await expect(svc.toggleAutoUpdate('nonexistent'))
        .rejects.toThrow('Marketplace "nonexistent" not found');
    });

    it('readFile 失敗 → error 往上拋，不寫 config file', async () => {
      mockReadFile.mockRejectedValue(new Error('EACCES: permission denied'));
      await expect(svc.toggleAutoUpdate('my-marketplace')).rejects.toThrow('EACCES');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe('reinstallAll()', () => {
    it('保留各 scope 的 enabledPlugins 設定', async () => {
      settings.readAllEnabledPlugins.mockResolvedValue({
        user: { 'looping@plugins-local': true },
        project: { 'stock@plugins-local': true },
        local: {},
      });

      await svc.reinstallAll();

      expect(settings.replaceEnabledPlugins).toHaveBeenCalledTimes(3);
      expect(settings.replaceEnabledPlugins).toHaveBeenCalledWith('user', { 'looping@plugins-local': true });
      expect(settings.replaceEnabledPlugins).toHaveBeenCalledWith('project', { 'stock@plugins-local': true });
      expect(settings.replaceEnabledPlugins).toHaveBeenCalledWith('local', {});
    });

    it('重裝前已安裝的 plugins 會依原 scope 重裝回來', async () => {
      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'looping@my-marketplace': [{
            scope: 'user',
            installPath: '/cache/my-marketplace/looping/hash',
            version: '1.0.0',
            installedAt: '2026-04-08T00:00:00.000Z',
            lastUpdated: '2026-04-08T00:00:00.000Z',
          }],
          'stock@local-plugins': [{
            scope: 'project',
            projectPath: '/Users/test/.claude',
            installPath: '/cache/local-plugins/stock/hash',
            version: '1.0.0',
            installedAt: '2026-04-08T00:00:00.000Z',
            lastUpdated: '2026-04-08T00:00:00.000Z',
          }],
        },
      } satisfies InstalledPluginsFile);

      await svc.reinstallAll();

      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'install', 'looping@my-marketplace', '--scope', 'user'],
        { timeout: CLI_LONG_TIMEOUT_MS },
      );
      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'install', 'stock@local-plugins', '--scope', 'project'],
        { timeout: CLI_LONG_TIMEOUT_MS, cwd: '/Users/test/.claude' },
      );
    });
  });

  describe('preview()', () => {
    const MANIFEST = JSON.stringify({
      name: 'test-marketplace',
      description: 'A test marketplace',
      plugins: [
        { name: 'plugin-a', description: 'Plugin A', version: '1.0.0', source: './plugins/a' },
        { name: 'plugin-b', description: 'Plugin B', source: './plugins/b' },
      ],
    });

    const PLUGIN_JSON_A = JSON.stringify({ description: 'Plugin A from json', version: '2.0.0' });

    it('local path → 直接讀取 manifest 和 plugin.json', async () => {
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) return MANIFEST;
        if (typeof filePath === 'string' && filePath.includes('plugins/a') && filePath.includes('plugin.json')) return PLUGIN_JSON_A;
        if (typeof filePath === 'string' && filePath.includes('plugin.json')) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        return JSON.stringify(MOCK_CONFIG);
      });
      mockAccess.mockResolvedValue(undefined);

      const result = await svc.preview('/local/marketplace');

      expect(result).toEqual([
        { name: 'plugin-a', description: 'Plugin A from json', version: '2.0.0' },
        { name: 'plugin-b', description: 'Plugin B', version: undefined },
      ]);
    });

    it('git URL → shallow clone + 讀取 manifest + cleanup', async () => {
      const tempDir = '/tmp/mp-preview-123';
      mockMkdtemp.mockResolvedValue(tempDir);
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: (err: null, stdout: string) => void) => {
          cb(null, '');
        },
      );
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) return MANIFEST;
        if (typeof filePath === 'string' && filePath.includes('plugin.json')) return PLUGIN_JSON_A;
        return JSON.stringify(MOCK_CONFIG);
      });
      mockRm.mockResolvedValue(undefined);

      const result = await svc.preview('https://github.com/owner/repo.git');

      // shallow clone 呼叫（含 -- 防 flag injection）
      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', '--', 'https://github.com/owner/repo.git', tempDir],
        expect.objectContaining({ timeout: expect.any(Number) }),
        expect.any(Function),
      );

      // 結果正確
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('plugin-a');

      // temp dir 被清理
      expect(mockRm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true });
    });

    it('github owner/repo → 轉為 git URL 後 clone', async () => {
      const tempDir = '/tmp/mp-preview-456';
      mockMkdtemp.mockResolvedValue(tempDir);
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: (err: null, stdout: string) => void) => {
          cb(null, '');
        },
      );
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) return MANIFEST;
        if (typeof filePath === 'string' && filePath.includes('plugin.json')) return PLUGIN_JSON_A;
        return JSON.stringify(MOCK_CONFIG);
      });
      mockRm.mockResolvedValue(undefined);

      await svc.preview('owner/repo');

      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', '--', 'https://github.com/owner/repo.git', tempDir],
        expect.objectContaining({ timeout: expect.any(Number) }),
        expect.any(Function),
      );
    });

    it('manifest 不存在 → 拋 ENOENT', async () => {
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return JSON.stringify(MOCK_CONFIG);
      });
      mockAccess.mockResolvedValue(undefined);

      await expect(svc.preview('/nonexistent/path'))
        .rejects.toThrow('ENOENT');
    });

    it('path traversal source → plugin.json 不被讀取，fallback manifest', async () => {
      const TRAVERSAL_MANIFEST = JSON.stringify({
        name: 'evil-marketplace',
        plugins: [
          { name: 'evil-plugin', description: 'Evil', source: '../../../etc' },
          { name: 'good-plugin', description: 'Good', source: './plugins/good' },
        ],
      });
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) return TRAVERSAL_MANIFEST;
        if (typeof filePath === 'string' && filePath.includes('plugins/good') && filePath.includes('plugin.json')) {
          return JSON.stringify({ description: 'Good from json', version: '1.0.0' });
        }
        if (typeof filePath === 'string' && filePath.includes('plugin.json')) {
          // 不該被呼叫（traversal 路徑應被擋掉）
          return JSON.stringify({ description: 'SHOULD NOT APPEAR', version: '9.9.9' });
        }
        return JSON.stringify(MOCK_CONFIG);
      });
      mockAccess.mockResolvedValue(undefined);

      const result = await svc.preview('/safe/marketplace');

      // evil-plugin 使用 manifest fallback（path traversal 被阻擋）
      expect(result[0]).toEqual({ name: 'evil-plugin', description: 'Evil', version: undefined });
      // good-plugin 正常讀取 plugin.json
      expect(result[1]).toEqual({ name: 'good-plugin', description: 'Good from json', version: '1.0.0' });
    });

    it('git clone 失敗 → 拋錯 + cleanup', async () => {
      const tempDir = '/tmp/mp-preview-789';
      mockMkdtemp.mockResolvedValue(tempDir);
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error) => void) => {
          cb(new Error('fatal: repository not found'));
        },
      );
      mockRm.mockResolvedValue(undefined);

      await expect(svc.preview('https://invalid.com/repo.git'))
        .rejects.toThrow('fatal: repository not found');

      // temp dir 仍然被清理
      expect(mockRm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true });
    });
  });

});
