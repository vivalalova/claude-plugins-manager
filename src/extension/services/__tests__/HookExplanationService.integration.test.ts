import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { HookExplanationService } from '../HookExplanationService';
import type { CliService } from '../CliService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCli(stdout = 'This hook runs a security guard script before each tool call.'): Partial<CliService> {
  return { exec: vi.fn().mockResolvedValue(stdout) };
}

async function writeCache(cachePath: string, data: Record<string, unknown>): Promise<void> {
  await mkdir(join(cachePath, '..'), { recursive: true });
  await writeFile(cachePath, JSON.stringify(data), 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HookExplanationService — integration', () => {
  let tmpDir: string;
  let cachePath: string;
  let service: HookExplanationService;
  let cli: Partial<CliService>;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'hook-explain-test-'));
    cachePath = join(tmpDir, 'hook-explanations.json');

    // Patch CACHE_PATH via module-level constant override is not possible;
    // instead we test the public behaviour using the real path fallback.
    // For integration tests we create the service with a mocked CliService
    // and spy on fs operations via the real tmpDir.
    cli = makeCli();

    // Override the cache path used by the service by monkey-patching the
    // private readCache / writeCache via the prototype (only in tests).
    service = new HookExplanationService(cli as CliService);
    // Redirect to tmpDir by overriding private methods
    const svc = service as unknown as {
      readCache: () => Promise<Record<string, unknown>>;
      writeCache: (c: Record<string, unknown>) => Promise<void>;
    };
    svc.readCache = async () => {
      try {
        const { readFile } = await import('fs/promises');
        const raw = await readFile(cachePath, 'utf-8');
        return JSON.parse(raw) as Record<string, unknown>;
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
        throw e;
      }
    };
    svc.writeCache = async (cache: Record<string, unknown>) => {
      const { writeFile: wf, mkdir: mk } = await import('fs/promises');
      await mk(join(cachePath, '..'), { recursive: true });
      await wf(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
    };
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('cache miss → 呼叫 CLI → 寫入 cache → fromCache: false', async () => {
    const result = await service.explain('/guard.sh arg', 'PreToolUse', 'en');

    expect(cli.exec).toHaveBeenCalledOnce();
    expect(result.fromCache).toBe(false);
    expect(result.explanation).toBe('This hook runs a security guard script before each tool call.');

    // 驗證 cache 已寫入
    const { readFile } = await import('fs/promises');
    const cache = JSON.parse(await readFile(cachePath, 'utf-8')) as Record<string, { explanation: string }>;
    expect(cache['/guard.sh arg:PreToolUse:en'].explanation).toBe(result.explanation);
  });

  it('cache hit（locale 相同）→ 不呼叫 CLI → fromCache: true', async () => {
    await writeCache(cachePath, {
      '/guard.sh:PreToolUse:zh-TW': {
        explanation: '這個 hook 執行守護腳本。',
        locale: 'zh-TW',
        createdAt: new Date().toISOString(),
      },
    });

    const result = await service.explain('/guard.sh', 'PreToolUse', 'zh-TW');

    expect(cli.exec).not.toHaveBeenCalled();
    expect(result.fromCache).toBe(true);
    expect(result.explanation).toBe('這個 hook 執行守護腳本。');
  });

  it('locale 不同 → cache miss → 重新呼叫 CLI', async () => {
    await writeCache(cachePath, {
      '/guard.sh:PreToolUse:en': {
        explanation: 'English explanation.',
        locale: 'en',
        createdAt: new Date().toISOString(),
      },
    });
    (cli.exec as ReturnType<typeof vi.fn>).mockResolvedValue('中文解釋。');

    const result = await service.explain('/guard.sh', 'PreToolUse', 'zh-TW');

    expect(cli.exec).toHaveBeenCalledOnce();
    expect(result.fromCache).toBe(false);
    expect(result.explanation).toBe('中文解釋。');
  });

  it('cleanExpired → 超過 30 天的 entry 被清除，未過期的保留', async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    await writeCache(cachePath, {
      'old-hook:en': { explanation: 'old', locale: 'en', createdAt: thirtyOneDaysAgo },
      'new-hook:en': { explanation: 'new', locale: 'en', createdAt: yesterday },
    });

    await service.cleanExpired();

    const { readFile } = await import('fs/promises');
    const cache = JSON.parse(await readFile(cachePath, 'utf-8')) as Record<string, unknown>;
    expect('old-hook:en' in cache).toBe(false);
    expect('new-hook:en' in cache).toBe(true);
  });

  it('cache 檔案不存在 → readCache 回傳空物件，不拋錯', async () => {
    const result = await service.explain('/new-hook.sh', 'PreToolUse', 'en');
    expect(result.fromCache).toBe(false);
    expect(cli.exec).toHaveBeenCalledOnce();
  });

  it('CLI 失敗 → 拋錯，不寫入 cache', async () => {
    (cli.exec as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('CLI failed'));

    await expect(service.explain('/bad.sh', 'PreToolUse', 'en')).rejects.toThrow('CLI failed');

    // cache 檔案不應建立
    const { access } = await import('fs/promises');
    await expect(access(cachePath)).rejects.toThrow();
  });

  it('hookContent 含冒號 → key 仍能正確配對', async () => {
    const content = 'cmd --flag key:value';
    (cli.exec as ReturnType<typeof vi.fn>).mockResolvedValue('colon test');

    const r1 = await service.explain(content, 'PreToolUse', 'en');
    expect(r1.fromCache).toBe(false);

    const r2 = await service.explain(content, 'PreToolUse', 'en');
    expect(r2.fromCache).toBe(true);
  });
});
