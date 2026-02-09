import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workspace } from 'vscode';
import { McpService } from '../McpService';
import type { CliService } from '../CliService';

function createMockCli(): { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService {
  return {
    exec: vi.fn().mockResolvedValue(''),
    execJson: vi.fn().mockResolvedValue({}),
  } as unknown as { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService;
}

describe('McpService', () => {
  let cli: ReturnType<typeof createMockCli>;
  let svc: McpService;

  beforeEach(() => {
    vi.useFakeTimers();
    cli = createMockCli();
    svc = new McpService(cli);
    workspace.workspaceFolders = undefined;
  });

  afterEach(() => {
    svc.stopPolling();
    vi.useRealTimers();
  });

  describe('list() — parseMcpList', () => {
    it('解析多種狀態的 MCP server', async () => {
      cli.exec.mockResolvedValue([
        'Checking MCP server health...',
        '',
        'plugin:context7:context7: npx -y @upstash/context7-mcp - ✓ Connected',
        'my-server: node server.js - ✗ Failed',
        'auth-server: npx auth-mcp - ⚠ Needs Auth',
        'pending-server: npx pending-mcp - ⏳ Pending',
        'weird-server: npx weird-mcp - 🔮 SomeUnknownStatus',
      ].join('\n'));

      const result = await svc.list();

      expect(result).toEqual([
        { name: 'context7', fullName: 'plugin:context7:context7', command: 'npx -y @upstash/context7-mcp', status: 'connected' },
        { name: 'my-server', fullName: 'my-server', command: 'node server.js', status: 'failed' },
        { name: 'auth-server', fullName: 'auth-server', command: 'npx auth-mcp', status: 'needs-auth' },
        { name: 'pending-server', fullName: 'pending-server', command: 'npx pending-mcp', status: 'pending' },
        { name: 'weird-server', fullName: 'weird-server', command: 'npx weird-mcp', status: 'unknown' },
      ]);
    });

    it('跳過空行和 "Checking" header', async () => {
      cli.exec.mockResolvedValue('Checking MCP server health...\n\n');
      const result = await svc.list();
      expect(result).toEqual([]);
    });

    it('處理 ANSI escape codes', async () => {
      cli.exec.mockResolvedValue(
        '\x1b[32mmy-server: node server.js - ✓ Connected\x1b[0m',
      );
      const result = await svc.list();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('connected');
    });
  });

  describe('add()', () => {
    it('project scope 無 workspace → throw', async () => {
      await expect(
        svc.add({ name: 'test', commandOrUrl: 'npx test', scope: 'project' }),
      ).rejects.toThrow('No workspace folder open');
    });

    it('project scope 有 workspace → 帶 cwd', async () => {
      workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }];
      await svc.add({ name: 'test', commandOrUrl: 'npx test', scope: 'project' });
      expect(cli.exec).toHaveBeenCalledWith(
        expect.arrayContaining(['mcp', 'add', '--scope', 'project', 'test', 'npx test']),
        expect.objectContaining({ cwd: '/my/project' }),
      );
    });

    it('帶 env/headers/transport 產生正確 args', async () => {
      await svc.add({
        name: 'my-mcp',
        commandOrUrl: 'https://example.com',
        transport: 'http',
        scope: 'user',
        env: { API_KEY: 'secret' },
        headers: ['Authorization: Bearer token'],
      });

      expect(cli.exec).toHaveBeenCalledWith(
        [
          'mcp', 'add',
          '--transport', 'http',
          '--scope', 'user',
          '-e', 'API_KEY=secret',
          '-H', 'Authorization: Bearer token',
          'my-mcp', 'https://example.com',
        ],
        expect.objectContaining({ cwd: undefined }),
      );
    });

    it('帶 args 參數產生 -- 分隔', async () => {
      await svc.add({
        name: 'my-mcp',
        commandOrUrl: 'npx my-mcp',
        args: ['--port', '3000'],
      });

      expect(cli.exec).toHaveBeenCalledWith(
        ['mcp', 'add', 'my-mcp', 'npx my-mcp', '--', '--port', '3000'],
        expect.anything(),
      );
    });
  });

  describe('remove()', () => {
    it('不帶 scope', async () => {
      await svc.remove('my-server');
      expect(cli.exec).toHaveBeenCalledWith(['mcp', 'remove', 'my-server']);
    });

    it('帶 scope', async () => {
      await svc.remove('my-server', 'user');
      expect(cli.exec).toHaveBeenCalledWith(['mcp', 'remove', 'my-server', '--scope', 'user']);
    });
  });

  describe('resetProjectChoices()', () => {
    it('無 workspace → throw', async () => {
      await expect(svc.resetProjectChoices()).rejects.toThrow('No workspace folder open');
    });

    it('有 workspace → 帶 cwd', async () => {
      workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }];
      await svc.resetProjectChoices();
      expect(cli.exec).toHaveBeenCalledWith(
        ['mcp', 'reset-project-choices'],
        { cwd: '/my/project' },
      );
    });
  });

  describe('polling', () => {
    it('startPolling() 重複呼叫不會重複啟動', () => {
      cli.exec.mockResolvedValue('');
      svc.startPolling();
      svc.startPolling();
      // 只應該呼叫一次 pollOnce（首次立即執行）
      expect(cli.exec).toHaveBeenCalledTimes(1);
    });

    it('stopPolling() 清除 timer', () => {
      cli.exec.mockResolvedValue('');
      svc.startPolling();
      svc.stopPolling();

      // advance time，不應再觸發 poll
      vi.advanceTimersByTime(60_000);
      // 只有 startPolling 觸發的那一次
      expect(cli.exec).toHaveBeenCalledTimes(1);
    });

    it('狀態變更時觸發 onStatusChange', async () => {
      const listener = vi.fn();
      svc.onStatusChange.event(listener);

      cli.exec.mockResolvedValue('my-server: node server.js - ✓ Connected');
      svc.startPolling();

      // 等待首次 pollOnce 的 microtask 完成
      await vi.advanceTimersByTimeAsync(0);

      expect(listener).toHaveBeenCalledWith([
        { name: 'my-server', fullName: 'my-server', command: 'node server.js', status: 'connected' },
      ]);
    });
  });
});
