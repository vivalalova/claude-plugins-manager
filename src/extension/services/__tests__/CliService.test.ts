import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliService } from '../CliService';
import { CliError } from '../CliService';

const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

vi.mock('fs', () => ({
  existsSync: () => false,
}));

interface MockChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  killed?: boolean;
}

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = vi.fn(() => {
    child.killed = true;
    child.emit('close', 143, 'SIGTERM');
    return true;
  });
  return child;
}

function mockSuccess(stdout: string): void {
  mockSpawn.mockImplementation(() => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.stdout.emit('data', Buffer.from(stdout));
      child.emit('close', 0, null);
    });
    return child;
  });
}

function mockSpawnError(error: Record<string, unknown>): void {
  mockSpawn.mockImplementation(() => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.emit('error', error);
    });
    return child;
  });
}

function mockExitFailure(exitCode: number, stderr: string): void {
  mockSpawn.mockImplementation(() => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', exitCode, null);
    });
    return child;
  });
}

function mockExitFailureWithStdout(exitCode: number, stdout: string, stderr: string): void {
  mockSpawn.mockImplementation(() => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.stdout.emit('data', Buffer.from(stdout));
      child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', exitCode, null);
    });
    return child;
  });
}

describe('CliService', () => {
  let cli: CliService;
  let sleepSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    cli = new CliService();
    sleepSpy = vi.spyOn(cli as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockResolvedValue(undefined);
  });

  describe('exec()', () => {
    it('成功回傳 trimmed stdout', async () => {
      mockSuccess('  hello world  \n');
      const result = await cli.exec(['mcp', 'list']);
      expect(result).toBe('hello world');
    });

    it('ENOENT → 不重試，單次 exec 只呼叫 1 次 spawn', async () => {
      mockSpawnError({ code: 'ENOENT', message: 'spawn ENOENT' });
      const error = await cli.exec(['mcp', 'list']).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('Claude CLI not found');
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('非零 exit code → 不重試，單次 exec 只呼叫 1 次 spawn', async () => {
      mockExitFailure(1, 'something went wrong');
      const error = await cli.exec(['plugin', 'list']).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('something went wrong');
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('非零 exit code → CliError.stdout 為 CLI 的 stdout（trim 後），message / stderr / exitCode 不變', async () => {
      const stdout = 'human line\n{"failureCode":"command_source_refused"}\n';
      mockExitFailureWithStdout(1, stdout, 'refused reason');

      const error = await cli.exec(['plugin', 'install', 'x@mp', '--json']).catch((e: unknown) => e) as CliError;

      expect(error).toBeInstanceOf(CliError);
      expect(error.stdout).toBe('human line\n{"failureCode":"command_source_refused"}');
      expect(error.message).toBe('refused reason');
      expect(error.stderr).toBe('refused reason');
      expect(error.exitCode).toBe(1);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('非零 exit code 且 stdout 為空 → CliError.stdout 為空字串', async () => {
      mockExitFailure(1, 'boom');

      const error = await cli.exec(['plugin', 'list']).catch((e: unknown) => e) as CliError;

      expect(error.stdout).toBe('');
    });

    it('ENOENT → CliError.stdout 為空字串', async () => {
      mockSpawnError({ code: 'ENOENT', message: 'spawn claude ENOENT', stderr: '' });

      const error = await cli.exec(['mcp', 'list']).catch((e: unknown) => e) as CliError;

      expect(error.stdout).toBe('');
    });

    it('傳遞 cwd / stdio / env options', async () => {
      process.env.CLAUDECODE = 'nested-session';
      mockSuccess('ok');

      await cli.exec(['mcp', 'list'], { cwd: '/my/project', timeout: 5000 });

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['mcp', 'list'],
        expect.objectContaining({
          cwd: '/my/project',
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      );
      const options = mockSpawn.mock.calls[0][2] as { env: NodeJS.ProcessEnv };
      expect(options.env.CLAUDECODE).toBeUndefined();
      delete process.env.CLAUDECODE;
    });

    it('子行程環境變數不含 CLAUDE_CODE_CHILD_SESSION，其餘照常保留且不改動 process.env', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, CLAUDE_CODE_CHILD_SESSION: '1', CLI_SERVICE_TEST_PLAIN_VAR: 'keep-me' };
      try {
        mockSuccess('ok');

        await cli.exec(['plugin', 'install', 'x@mp']);

        const options = mockSpawn.mock.calls[0][2] as { env: NodeJS.ProcessEnv };
        expect(options.env.CLAUDE_CODE_CHILD_SESSION).toBeUndefined();
        expect(options.env.CLI_SERVICE_TEST_PLAIN_VAR).toBe('keep-me');
        expect(process.env.CLAUDE_CODE_CHILD_SESSION).toBe('1');
      } finally {
        process.env = originalEnv;
      }
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
      mockSpawnError({ killed: true, code: 'ETIMEDOUT', message: 'timeout' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow(CliError);
      expect(mockSpawn).toHaveBeenCalledTimes(4);
    });

    it('ECONNRESET → 重試 3 次後拋出 CliError', async () => {
      mockSpawnError({ code: 'ECONNRESET', message: 'connection reset' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow(CliError);
      expect(mockSpawn).toHaveBeenCalledTimes(4);
    });

    it('EAI_AGAIN → 重試 3 次後拋出 CliError', async () => {
      mockSpawnError({ code: 'EAI_AGAIN', message: 'DNS lookup failed' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow(CliError);
      expect(mockSpawn).toHaveBeenCalledTimes(4);
    });

    it('指數退避：sleep 間隔為 1s → 2s → 4s', async () => {
      mockSpawnError({ killed: true, code: 'ETIMEDOUT', message: 'timeout' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow(CliError);
      expect(sleepSpy).toHaveBeenCalledTimes(3);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
      expect(sleepSpy).toHaveBeenNthCalledWith(3, 4000);
    });

    it('第一次 ETIMEDOUT，第二次成功 → 回傳結果（1 次重試）', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        const child = createMockChild();
        queueMicrotask(() => {
          callCount++;
          if (callCount === 1) {
            child.emit('error', { killed: true, code: 'ETIMEDOUT', message: 'timeout' });
          } else {
            child.stdout.emit('data', Buffer.from('recovered'));
            child.emit('close', 0, null);
          }
        });
        return child;
      });

      const result = await cli.exec(['mcp', 'list']);
      expect(result).toBe('recovered');
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      expect(sleepSpy).toHaveBeenCalledWith(1000);
    });

    it('ENOENT 不重試（非暫時性錯誤）', async () => {
      mockSpawnError({ code: 'ENOENT', message: 'spawn ENOENT' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow('Claude CLI not found');
      expect(mockSpawn).toHaveBeenCalledTimes(1);
      expect(sleepSpy).not.toHaveBeenCalled();
    });

    it('exit code 1 不重試（CLI 正常執行但回報錯誤）', async () => {
      mockExitFailure(1, 'plugin not found');
      await expect(cli.exec(['plugin', 'enable', 'foo'])).rejects.toThrow('plugin not found');
      expect(mockSpawn).toHaveBeenCalledTimes(1);
      expect(sleepSpy).not.toHaveBeenCalled();
    });

    it('總 timeout 不足以退避時停止重試', async () => {
      mockSpawnError({ killed: true, code: 'ETIMEDOUT', message: 'timeout' });
      await expect(cli.exec(['mcp', 'list'], { timeout: 500 })).rejects.toThrow(CliError);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
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
