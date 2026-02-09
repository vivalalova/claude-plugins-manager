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

  beforeEach(() => {
    vi.clearAllMocks();
    cli = new CliService();
  });

  describe('exec()', () => {
    it('成功回傳 trimmed stdout', async () => {
      mockSuccess('  hello world  \n');
      const result = await cli.exec(['mcp', 'list']);
      expect(result).toBe('hello world');
    });

    it('ENOENT → throw CliError "Claude CLI not found"', async () => {
      mockError({ code: 'ENOENT', message: 'spawn ENOENT' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow(CliError);
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow('Claude CLI not found');
    });

    it('timeout → throw CliError timeout', async () => {
      mockError({ killed: true, code: 'ETIMEDOUT', message: 'timeout' });
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow(CliError);
      await expect(cli.exec(['mcp', 'list'])).rejects.toThrow('timeout');
    });

    it('非零 exit code → throw CliError with stderr', async () => {
      mockError({ exitCode: 1, stderr: 'something went wrong', message: 'failed' });
      await expect(cli.exec(['plugin', 'list'])).rejects.toThrow(CliError);
      await expect(cli.exec(['plugin', 'list'])).rejects.toThrow('something went wrong');
    });

    it('傳遞 cwd 和 timeout options', async () => {
      mockSuccess('ok');
      await cli.exec(['mcp', 'list'], { cwd: '/my/project', timeout: 5000 });
      expect(mockExecFile).toHaveBeenCalledWith(
        'claude',
        ['mcp', 'list'],
        expect.objectContaining({ cwd: '/my/project', timeout: 5000 }),
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
});
