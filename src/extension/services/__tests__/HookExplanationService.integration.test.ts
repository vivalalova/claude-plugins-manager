import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
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

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
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

    cli = makeCli();

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

  it('cache miss（有 filePath）→ 呼叫 CLI → 寫入 filePath:mtime:locale key', async () => {
    const hookFile = join(tmpDir, 'guard.sh');
    await writeFile(hookFile, '#!/bin/bash\necho "guard"', 'utf-8');
    const { mtimeMs } = await stat(hookFile);

    const result = await service.explain('/guard.sh arg', 'PreToolUse', 'en', hookFile);

    expect(cli.exec).toHaveBeenCalledOnce();
    expect(cli.exec).toHaveBeenCalledWith(
      [
        '--model', 'sonnet',
        '--print',
        '--system-prompt', expect.any(String),
        '--no-session-persistence',
        '--setting-sources', '',
        '--settings', expect.stringContaining('disableAllHooks'),
        expect.stringContaining('PreToolUse'),
      ],
      { timeout: 120_000 },
    );
    expect(result.fromCache).toBe(false);
    expect(result.explanation).toBe('This hook runs a security guard script before each tool call.');

    const { readFile } = await import('fs/promises');
    const cache = JSON.parse(await readFile(cachePath, 'utf-8')) as Record<string, { explanation: string }>;
    const expectedKey = `${hookFile}:${mtimeMs}:en`;
    expect(cache[expectedKey]).toBeDefined();
    expect(cache[expectedKey].explanation).toBe(result.explanation);
  });

  it('cache miss（無 filePath）→ 使用 hash:0:locale key', async () => {
    const content = 'echo "inline hook"';
    (cli.exec as ReturnType<typeof vi.fn>).mockResolvedValue('inline explanation');

    const result = await service.explain(content, 'PreToolUse', 'en');

    expect(result.fromCache).toBe(false);

    const { readFile } = await import('fs/promises');
    const cache = JSON.parse(await readFile(cachePath, 'utf-8')) as Record<string, { explanation: string }>;
    const expectedKey = `${hashContent(content)}:0:en`;
    expect(cache[expectedKey]).toBeDefined();
    expect(cache[expectedKey].explanation).toBe('inline explanation');
  });

  it('cache hit（filePath + mtime 相同）→ 不呼叫 CLI → fromCache: true', async () => {
    const hookFile = join(tmpDir, 'guard.sh');
    await writeFile(hookFile, '#!/bin/bash', 'utf-8');
    const { mtimeMs } = await stat(hookFile);

    await writeCache(cachePath, {
      [`${hookFile}:${mtimeMs}:zh-TW`]: {
        explanation: '這個 hook 執行守護腳本。',
        locale: 'zh-TW',
        createdAt: new Date().toISOString(),
      },
    });

    const result = await service.explain('/guard.sh', 'PreToolUse', 'zh-TW', hookFile);

    expect(cli.exec).not.toHaveBeenCalled();
    expect(result.fromCache).toBe(true);
    expect(result.explanation).toBe('這個 hook 執行守護腳本。');
  });

  it('檔案 mtime 改變 → cache miss → 重新呼叫 CLI', async () => {
    const hookFile = join(tmpDir, 'guard.sh');
    await writeFile(hookFile, '#!/bin/bash', 'utf-8');
    const oldMtime = 1710000000000; // hardcoded old mtime, differs from real mtime

    await writeCache(cachePath, {
      [`${hookFile}:${oldMtime}:en`]: {
        explanation: 'old explanation',
        locale: 'en',
        createdAt: new Date().toISOString(),
      },
    });

    (cli.exec as ReturnType<typeof vi.fn>).mockResolvedValue('fresh explanation after mtime change');

    const result = await service.explain('/guard.sh', 'PreToolUse', 'en', hookFile);

    expect(cli.exec).toHaveBeenCalledOnce();
    expect(result.fromCache).toBe(false);
    expect(result.explanation).toBe('fresh explanation after mtime change');
  });

  it('locale 不同 → cache miss → 重新呼叫 CLI', async () => {
    const hookFile = join(tmpDir, 'guard.sh');
    await writeFile(hookFile, '#!/bin/bash', 'utf-8');
    const { mtimeMs } = await stat(hookFile);

    await writeCache(cachePath, {
      [`${hookFile}:${mtimeMs}:en`]: {
        explanation: 'English explanation.',
        locale: 'en',
        createdAt: new Date().toISOString(),
      },
    });
    (cli.exec as ReturnType<typeof vi.fn>).mockResolvedValue('中文解釋。');

    const result = await service.explain('/guard.sh', 'PreToolUse', 'zh-TW', hookFile);

    expect(cli.exec).toHaveBeenCalledOnce();
    expect(result.fromCache).toBe(false);
    expect(result.explanation).toBe('中文解釋。');
  });

  it('filePath 指向不存在的檔案 → fallback hash key', async () => {
    const nonExistentFile = join(tmpDir, 'nonexistent.sh');
    const content = '/nonexistent.sh --arg';
    (cli.exec as ReturnType<typeof vi.fn>).mockResolvedValue('hash fallback explanation');

    const result = await service.explain(content, 'PreToolUse', 'en', nonExistentFile);

    expect(result.fromCache).toBe(false);

    const { readFile } = await import('fs/promises');
    const cache = JSON.parse(await readFile(cachePath, 'utf-8')) as Record<string, { explanation: string }>;
    const expectedKey = `${hashContent(content)}:0:en`;
    expect(cache[expectedKey]).toBeDefined();
  });

  it('cache entry 已過期 → 忽略舊值並重新呼叫 CLI', async () => {
    const hookFile = join(tmpDir, 'guard.sh');
    await writeFile(hookFile, '#!/bin/bash', 'utf-8');
    const { mtimeMs } = await stat(hookFile);

    await writeCache(cachePath, {
      [`${hookFile}:${mtimeMs}:en`]: {
        explanation: 'stale explanation',
        locale: 'en',
        createdAt: new Date(Date.now() - 181 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    (cli.exec as ReturnType<typeof vi.fn>).mockResolvedValue('fresh explanation');

    const result = await service.explain('/guard.sh', 'PreToolUse', 'en', hookFile);

    expect(cli.exec).toHaveBeenCalledOnce();
    expect(result.fromCache).toBe(false);
    expect(result.explanation).toBe('fresh explanation');
  });

  it('無 filePath 連續呼叫 → 第二次 fromCache: true', async () => {
    const content = 'cmd --flag key:value';
    (cli.exec as ReturnType<typeof vi.fn>).mockResolvedValue('colon test');

    const r1 = await service.explain(content, 'PreToolUse', 'en');
    expect(r1.fromCache).toBe(false);

    const r2 = await service.explain(content, 'PreToolUse', 'en');
    expect(r2.fromCache).toBe(true);
    expect(cli.exec).toHaveBeenCalledOnce();
  });

  it('refresh: true → 忽略快取命中，重新呼叫 CLI 並覆蓋舊值', async () => {
    const content = 'echo "refresh me"';
    (cli.exec as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('original explanation')
      .mockResolvedValueOnce('refreshed explanation');

    const r1 = await service.explain(content, 'PreToolUse', 'en');
    expect(r1.fromCache).toBe(false);
    expect(r1.explanation).toBe('original explanation');

    // Without refresh → cache hit
    const r2 = await service.explain(content, 'PreToolUse', 'en');
    expect(r2.fromCache).toBe(true);
    expect(r2.explanation).toBe('original explanation');
    expect(cli.exec).toHaveBeenCalledOnce();

    // With refresh → bypass cache, call CLI again
    const r3 = await service.explain(content, 'PreToolUse', 'en', undefined, true);
    expect(r3.fromCache).toBe(false);
    expect(r3.explanation).toBe('refreshed explanation');
    expect(cli.exec).toHaveBeenCalledTimes(2);

    // Subsequent call without refresh → cache hit with new value
    const r4 = await service.explain(content, 'PreToolUse', 'en');
    expect(r4.fromCache).toBe(true);
    expect(r4.explanation).toBe('refreshed explanation');
  });

  it('不同 hookContent（無 filePath）→ hash 不衝突，各自呼叫 CLI', async () => {
    (cli.exec as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('explanation A')
      .mockResolvedValueOnce('explanation B');

    const r1 = await service.explain('command-a', 'PreToolUse', 'en');
    const r2 = await service.explain('command-b', 'PreToolUse', 'en');

    expect(r1.explanation).toBe('explanation A');
    expect(r2.explanation).toBe('explanation B');
    expect(cli.exec).toHaveBeenCalledTimes(2);
  });

  it('cleanExpired → 超過 180 天的 entry 被清除，未過期的保留', async () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 181 * 24 * 60 * 60 * 1000).toISOString();
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

    const { access } = await import('fs/promises');
    await expect(access(cachePath)).rejects.toThrow();
  });

  it('CLI 回空字串 → 拋錯，不寫入空白 cache', async () => {
    (cli.exec as ReturnType<typeof vi.fn>).mockResolvedValue('   \n  ');

    await expect(service.explain('/blank.sh', 'PreToolUse', 'en')).rejects.toThrow('Hook explanation was empty');

    const { access } = await import('fs/promises');
    await expect(access(cachePath)).rejects.toThrow();
  });

  // ---------------------------------------------------------------------------
  // loadCached
  // ---------------------------------------------------------------------------

  it('loadCached → 回傳快取命中的項目，以 uiKey 為 key', async () => {
    const hookFile = join(tmpDir, 'guard.sh');
    await writeFile(hookFile, '#!/bin/bash', 'utf-8');
    const { mtimeMs } = await stat(hookFile);

    await writeCache(cachePath, {
      [`${hookFile}:${mtimeMs}:en`]: {
        explanation: 'cached explanation',
        locale: 'en',
        createdAt: new Date().toISOString(),
      },
    });

    const result = await service.loadCached([
      { hookContent: '/guard.sh', locale: 'en', filePath: hookFile },
    ]);

    expect(result).toEqual({ [`${hookFile}:en`]: 'cached explanation' });
    expect(cli.exec).not.toHaveBeenCalled();
  });

  it('loadCached → 無 filePath 用 hookContent 作 uiKey', async () => {
    const content = 'echo "inline"';
    await writeCache(cachePath, {
      [`${hashContent(content)}:0:zh-TW`]: {
        explanation: '行內解釋',
        locale: 'zh-TW',
        createdAt: new Date().toISOString(),
      },
    });

    const result = await service.loadCached([
      { hookContent: content, locale: 'zh-TW' },
    ]);

    expect(result).toEqual({ [`${content}:zh-TW`]: '行內解釋' });
  });

  it('loadCached → 過期 entry 不回傳', async () => {
    const hookFile = join(tmpDir, 'old.sh');
    await writeFile(hookFile, '#!/bin/bash', 'utf-8');
    const { mtimeMs } = await stat(hookFile);

    await writeCache(cachePath, {
      [`${hookFile}:${mtimeMs}:en`]: {
        explanation: 'stale',
        locale: 'en',
        createdAt: new Date(Date.now() - 181 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    const result = await service.loadCached([
      { hookContent: '/old.sh', locale: 'en', filePath: hookFile },
    ]);

    expect(result).toEqual({});
  });

  it('loadCached → 空快取回傳空物件', async () => {
    const result = await service.loadCached([
      { hookContent: 'nonexistent', locale: 'en' },
    ]);

    expect(result).toEqual({});
  });
});
