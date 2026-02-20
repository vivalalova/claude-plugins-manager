import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliService } from '../CliService';
import { CliError } from '../../types';

/** 用 vi.hoisted 確保 mock 在 vi.mock hoist 時可用 */
const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}));

vi.mock('fs', () => ({
  existsSync: () => false,
}));

type Callback = (...args: unknown[]) => void;

/** helper：讓 mock execFile 呼叫 callback 成功 */
function mockSuccess(stdout: string): void {
  mockExecFile.mockImplementation((...args: unknown[]) => {
    const cb = args[args.length - 1] as Callback;
    cb(null, { stdout });
  });
}

/** helper：讓 mock execFile 呼叫 callback 失敗 */
function mockError(error: Record<string, unknown>): void {
  mockExecFile.mockImplementation((...args: unknown[]) => {
    const cb = args[args.length - 1] as Callback;
    cb(error);
  });
}

describe('CliService', () => {
  let cli: CliService;
  let sleepSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    cli = new CliService();
    // mock sleep 讓重試不實際等待
    sleepSpy = vi.spyOn(cli as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockResolvedValue(undefined);
  });

  describe('exec()', () => {
    it('成功回傳 trimmed stdout', async () => {
      mockSuccess('  hello world  \n');
      const result = await cli.exec(['mcp', 'list']);
      expect(result).toBe('hello world');
    });

    it('ENOENT → 不重試，單次 exec 只呼叫 1 次 execFile', async () => {
      mockError({ code: 'ENOENT', message: 'spawn ENOENT' });
      const error = await cli.exec(['mcp', 'list']).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('Claude CLI not found');
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('非零 exit code → 不重試，單次 exec 只呼叫 1 次 execFile', async () => {
      mockError({ exitCode: 1, stderr: 'something went wrong', message: 'failed' });
      const error = await cli.exec(['plugin', 'list']).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('something went wrong');
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('傳遞 cwd options', async () => {
      mockSuccess('ok');
      await cli.exec(['mcp', 'list'], { cwd: '/my/project', timeout: 5000 });
      expect(mockExecFile).toHaveBeenCalledWith(
        'claude',
        ['mcp', 'list'],
        expect.objectContaining({ cwd: '/my/project' }),
        expect.any(Function),
      );
    });
  });

  describe('execJson()', () => {
    it('正常解析 JSON', async () => {
      mockSuccess('{"name":"test"}');
      const result = await cli.execJson<{ name: string }>(['plugin', 'list', '--json']);
      expect(result).toEqual({ name: 'test' });
    });

    it('非 JSON stdout → throw CliError', async () => {
      mockSuccess('not json at all');
      await expect(cli.execJson(['plugin', 'list', '--json'])).rejects.toThrow(CliError);
      await expect(cli.execJson(['plugin', 'list', '--json'])).rejects.toThrow('Failed to parse JSON');
    });
  });

  describe('withRetry — 自動重試 + 指數退避', () => {
    it('ETIMEDOUT → 重試 3 次後拋出 CliError（共 4 次呼叫）', async () => {
      mockError({ killed: true, code: 'ETIMEDOUT', message: 'timeout' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow(CliError);
      // 1 initial + 3 retries = 4 calls
      expect(mockExecFile).toHaveBeenCalledTimes(4);
    });

    it('ECONNRESET → 重試 3 次後拋出 CliError', async () => {
      mockError({ code: 'ECONNRESET', message: 'connection reset' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow(CliError);
      expect(mockExecFile).toHaveBeenCalledTimes(4);
    });

    it('EAI_AGAIN → 重試 3 次後拋出 CliError', async () => {
      mockError({ code: 'EAI_AGAIN', message: 'DNS lookup failed' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow(CliError);
      expect(mockExecFile).toHaveBeenCalledTimes(4);
    });

    it('指數退避：sleep 間隔為 1s → 2s → 4s', async () => {
      mockError({ killed: true, code: 'ETIMEDOUT', message: 'timeout' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow(CliError);
      expect(sleepSpy).toHaveBeenCalledTimes(3);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
      expect(sleepSpy).toHaveBeenNthCalledWith(3, 4000);
    });

    it('第一次 ETIMEDOUT，第二次成功 → 回傳結果（1 次重試）', async () => {
      let callCount = 0;
      mockExecFile.mockImplementation((...args: unknown[]) => {
        const cb = args[args.length - 1] as Callback;
        callCount++;
        if (callCount === 1) {
          cb({ killed: true, code: 'ETIMEDOUT', message: 'timeout' });
        } else {
          cb(null, { stdout: 'recovered' });
        }
      });

      const result = await cli.exec(['mcp', 'list']);
      expect(result).toBe('recovered');
      expect(mockExecFile).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      expect(sleepSpy).toHaveBeenCalledWith(1000);
    });

    it('ENOENT 不重試（非暫時性錯誤）', async () => {
      mockError({ code: 'ENOENT', message: 'spawn ENOENT' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow('Claude CLI not found');
      expect(mockExecFile).toHaveBeenCalledTimes(1);
      expect(sleepSpy).not.toHaveBeenCalled();
    });

    it('exit code 1 不重試（CLI 正常執行但回報錯誤）', async () => {
      mockError({ exitCode: 1, stderr: 'plugin not found' });
      await expect(cli.exec(['plugin', 'enable', 'foo'])).rejects.toThrow('plugin not found');
      expect(mockExecFile).toHaveBeenCalledTimes(1);
      expect(sleepSpy).not.toHaveBeenCalled();
    });

    it('總 timeout 不足以退避時停止重試', async () => {
      mockError({ killed: true, code: 'ETIMEDOUT', message: 'timeout' });
      // timeout=500ms，backoff=1000ms > remaining ~500ms → 不會重試
      await expect(cli.exec(['mcp', 'list'], { timeout: 500 })).rejects.toThrow(CliError);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('isRetryable()', () => {
    it('ETIMEDOUT → true', () => {
      expect(CliService.isRetryable({ killed: true, code: 'ETIMEDOUT' })).toBe(true);
    });

    it('ECONNRESET → true', () => {
      expect(CliService.isRetryable({ code: 'ECONNRESET' })).toBe(true);
    });

    it('EAI_AGAIN → true', () => {
      expect(CliService.isRetryable({ code: 'EAI_AGAIN' })).toBe(true);
    });

    it('killed: true（無 code）→ true', () => {
      expect(CliService.isRetryable({ killed: true })).toBe(true);
    });

    it('killed: true + exitCode → killed 優先，true', () => {
      expect(CliService.isRetryable({ killed: true, exitCode: 143 })).toBe(true);
    });

    it('ENOENT → false', () => {
      expect(CliService.isRetryable({ code: 'ENOENT' })).toBe(false);
    });

    it('exitCode: 1 → false', () => {
      expect(CliService.isRetryable({ exitCode: 1 })).toBe(false);
    });

    it('exitCode: 0 → false（CLI 成功不重試）', () => {
      expect(CliService.isRetryable({ exitCode: 0 })).toBe(false);
    });

    it('未知錯誤（無 code/killed/exitCode）→ false', () => {
      expect(CliService.isRetryable({ message: 'unknown' })).toBe(false);
    });
  });
});
