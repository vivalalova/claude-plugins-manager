import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceService } from '../MarketplaceService';
import { CLI_LONG_TIMEOUT_MS } from '../../constants';
import type { CliService } from '../CliService';

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockMkdtemp = vi.hoisted(() => vi.fn());
const mockRm = vi.hoisted(() => vi.fn());
const mockAccess = vi.hoisted(() => vi.fn());
const mockExecFile = vi.hoisted(() => vi.fn());

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

function createMockCli(): { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService {
  return {
    exec: vi.fn().mockResolvedValue(''),
    execJson: vi.fn().mockResolvedValue({}),
  } as unknown as { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService;
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
  let svc: MarketplaceService;

  beforeEach(() => {
    cli = createMockCli();
    svc = new MarketplaceService(cli);
    mockReadFile.mockResolvedValue(JSON.stringify(MOCK_CONFIG));
    mockWriteFile.mockResolvedValue(undefined);
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
  });

  describe('remove()', () => {
    it('呼叫正確 CLI args', async () => {
      await svc.remove('my-marketplace');
      expect(cli.exec).toHaveBeenCalledWith(['plugin', 'marketplace', 'remove', 'my-marketplace']);
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
