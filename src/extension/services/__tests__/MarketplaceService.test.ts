import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceService } from '../MarketplaceService';
import { CLI_LONG_TIMEOUT_MS } from '../../constants';
import type { CliService } from '../CliService';

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
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
});
