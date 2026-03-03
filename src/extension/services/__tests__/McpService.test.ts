import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workspace } from 'vscode';
import { McpService } from '../McpService';
import type { CliService } from '../CliService';
import type { SettingsFileService } from '../SettingsFileService';

/* ── fs/promises mock（buildServerMetadata 內部使用） ── */
const mockReadFile = vi.hoisted(() => vi.fn());
vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
}));

vi.mock('os', () => ({
  homedir: () => '/mock-home',
}));

function createMockCli(): { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService {
  return {
    exec: vi.fn().mockResolvedValue(''),
    execJson: vi.fn().mockResolvedValue({}),
  } as unknown as { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService;
}

function enoent(): NodeJS.ErrnoException {
  const error = new Error('ENOENT') as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  return error;
}

function createMockSettings(): Pick<SettingsFileService, 'readEnabledPlugins'> {
  return {
    readEnabledPlugins: vi.fn().mockResolvedValue({}),
  };
}

describe('McpService', () => {
  let cli: ReturnType<typeof createMockCli>;
  let settings: ReturnType<typeof createMockSettings>;
  let svc: McpService;

  beforeEach(() => {
    vi.useFakeTimers();
    cli = createMockCli();
    settings = createMockSettings();
    svc = new McpService(cli, settings);
    workspace.workspaceFolders = undefined;
    // buildServerMetadata 讀取 ~/.claude.json，預設不存在
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
  });

  afterEach(() => {
    svc.stopPolling();
    vi.useRealTimers();
  });

  describe('listFromFiles() — 即時從設定檔讀取', () => {
    it('從設定檔組裝 server 列表，不呼叫 CLI', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' } },
      ] as any;

      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            mcpServers: { 'global-server': { command: 'npx', args: ['-y', 'global'] } },
            projects: {
              '/my/project': {
                mcpServers: { 'local-server': { command: 'node', args: ['server.js'] } },
              },
            },
          });
        }
        if (path.includes('.mcp.json')) {
          return JSON.stringify({
            mcpServers: { 'project-server': { command: 'npx', args: ['-y', 'project'] } },
          });
        }
        throw new Error('ENOENT');
      });

      const result = await svc.listFromFiles();

      // 不應呼叫 CLI
      expect(cli.exec).not.toHaveBeenCalled();
      // 全部 status 為 pending
      expect(result).toEqual([
        {
          name: 'global-server', fullName: 'global-server',
          command: 'npx -y global', status: 'pending',
          scope: 'user', config: { command: 'npx', args: ['-y', 'global'] },
        },
        {
          name: 'local-server', fullName: 'local-server',
          command: 'node server.js', status: 'pending',
          scope: 'local', config: { command: 'node', args: ['server.js'] },
        },
        {
          name: 'project-server', fullName: 'project-server',
          command: 'npx -y project', status: 'pending',
          scope: 'project', config: { command: 'npx', args: ['-y', 'project'] },
        },
      ]);
    });

    it('包含 plugin-provided MCP servers（如 context7）', async () => {
      settings.readEnabledPlugins = vi.fn().mockImplementation(async (scope: string) => (
        scope === 'user' ? { 'context7@official': true } : {}
      ));
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            mcpServers: { 'user-server': { command: 'npx', args: ['-y', 'user-mcp'] } },
          });
        }
        if (path.includes('installed_plugins.json')) {
          return JSON.stringify({
            version: 2,
            plugins: {
              'context7@official': [{
                scope: 'user',
                installPath: '/mock-home/.claude/plugins/cache/context7',
              }],
            },
          });
        }
        if (path.includes('plugins/cache/context7') && path.endsWith('.mcp.json')) {
          return JSON.stringify({
            context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
          });
        }
        throw new Error('ENOENT');
      });

      const result = await svc.listFromFiles();

      expect(cli.exec).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          name: 'user-server', fullName: 'user-server',
          command: 'npx -y user-mcp', status: 'pending',
          scope: 'user', config: { command: 'npx', args: ['-y', 'user-mcp'] },
        },
        {
          name: 'context7', fullName: 'plugin:context7@official:context7',
          command: 'npx -y @upstash/context7-mcp', status: 'pending',
          scope: 'user', config: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
          plugin: { id: 'context7@official', enabled: true },
        },
      ]);
    });

    it('效能保證：絕不呼叫 CLI，多 plugin 場景亦同', async () => {
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({ mcpServers: {} });
        }
        if (path.includes('installed_plugins.json')) {
          return JSON.stringify({
            version: 2,
            plugins: {
              'pluginA@market': [{ scope: 'user', installPath: '/a' }],
              'pluginB@market': [{ scope: 'user', installPath: '/b' }],
              'pluginC@market': [{ scope: 'user', installPath: '/c' }],
            },
          });
        }
        if (path === '/a/.mcp.json') {
          return JSON.stringify({ 'srv-a': { command: 'npx', args: ['a'] } });
        }
        if (path === '/b/.mcp.json') {
          return JSON.stringify({ 'srv-b': { command: 'npx', args: ['b'] } });
        }
        throw new Error('ENOENT');
      });

      const result = await svc.listFromFiles();

      // 核心斷言：CLI 零呼叫（避免 2.5 秒 health check 延遲）
      expect(cli.exec).not.toHaveBeenCalled();
      // pluginC 無 .mcp.json → 不列出
      expect(result).toHaveLength(2);
      expect(result.map((s) => s.fullName)).toEqual([
        'plugin:pluginA@market:srv-a',
        'plugin:pluginB@market:srv-b',
      ]);
    });

    it('plugin-provided MCP 只採用當前 workspace 的 entry，忽略其他 workspace', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' } },
      ] as any;

      settings.readEnabledPlugins = vi.fn().mockImplementation(async (scope: string) => {
        if (scope === 'project') return { 'context7@official': true };
        if (scope === 'user') return { 'context7@official': false };
        return {};
      });

      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) return JSON.stringify({});
        if (path.includes('installed_plugins.json')) {
          return JSON.stringify({
            version: 2,
            plugins: {
              'context7@official': [
                {
                  scope: 'project',
                  projectPath: '/other/project',
                  installPath: '/cache/other',
                },
                {
                  scope: 'user',
                  installPath: '/cache/user',
                },
                {
                  scope: 'project',
                  projectPath: '/my/project',
                  installPath: '/cache/project',
                },
              ],
            },
          });
        }
        if (path === '/cache/project/.mcp.json') {
          return JSON.stringify({
            context7: { command: 'npx', args: ['project-context7'] },
          });
        }
        if (path === '/cache/user/.mcp.json') {
          return JSON.stringify({
            context7: { command: 'npx', args: ['user-context7'] },
          });
        }
        throw enoent();
      });

      const result = await svc.listFromFiles();

      expect(result).toEqual([
        {
          name: 'context7',
          fullName: 'plugin:context7@official:context7',
          command: 'npx project-context7',
          status: 'pending',
          scope: 'project',
          config: { command: 'npx', args: ['project-context7'] },
          plugin: { id: 'context7@official', enabled: true },
        },
      ]);
    });

    it('enabledPlugins 設定檔無效時直接拋錯，不靜默改成 disabled', async () => {
      settings.readEnabledPlugins = vi.fn().mockImplementation(async (scope: string) => {
        if (scope === 'user') throw new Error('Invalid JSON in settings.json');
        return {};
      });

      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) return JSON.stringify({});
        if (path.includes('installed_plugins.json')) {
          return JSON.stringify({
            version: 2,
            plugins: {
              'context7@official': [{ scope: 'user', installPath: '/cache/user' }],
            },
          });
        }
        if (path === '/cache/user/.mcp.json') {
          return JSON.stringify({
            context7: { command: 'npx', args: ['user-context7'] },
          });
        }
        throw enoent();
      });

      await expect(svc.listFromFiles()).rejects.toThrow('Invalid JSON in settings.json');
    });

    it('URL 型 MCP config 顯示為 URL，保留 transport 與 headers', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' } },
      ] as any;

      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) return JSON.stringify({});
        if (path.includes('.mcp.json')) {
          return JSON.stringify({
            mcpServers: {
              remote: {
                url: 'https://api.example.com/mcp',
                transport: 'sse',
                headers: { Authorization: 'Bearer token' },
                env: { API_KEY: 'secret' },
              },
            },
          });
        }
        throw enoent();
      });

      await expect(svc.listFromFiles()).resolves.toEqual([
        {
          name: 'remote',
          fullName: 'remote',
          command: 'https://api.example.com/mcp',
          status: 'pending',
          scope: 'project',
          config: {
            url: 'https://api.example.com/mcp',
            transport: 'sse',
            headers: { Authorization: 'Bearer token' },
            env: { API_KEY: 'secret' },
          },
        },
      ]);
    });

    it('同 base name 不同 marketplace 的 plugin MCP 會保留獨立 fullName', async () => {
      settings.readEnabledPlugins = vi.fn().mockResolvedValue({});
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) return JSON.stringify({});
        if (path.includes('installed_plugins.json')) {
          return JSON.stringify({
            version: 2,
            plugins: {
              'shared@official': [{ scope: 'user', installPath: '/cache/official' }],
              'shared@community': [{ scope: 'user', installPath: '/cache/community' }],
            },
          });
        }
        if (path === '/cache/official/.mcp.json') {
          return JSON.stringify({ remote: { command: 'npx', args: ['official'] } });
        }
        if (path === '/cache/community/.mcp.json') {
          return JSON.stringify({ remote: { command: 'npx', args: ['community'] } });
        }
        throw enoent();
      });

      const result = await svc.listFromFiles();

      expect(result.map((server) => server.fullName)).toEqual([
        'plugin:shared@official:remote',
        'plugin:shared@community:remote',
      ]);
    });
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

    it('從設定檔偵測 scope 和 config', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' }, name: 'my-project', index: 0 },
      ] as any;

      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            mcpServers: { 'global-server': { command: 'npx', args: ['-y', 'global'] } },
            projects: {
              '/my/project': {
                mcpServers: { 'local-server': { command: 'npx', args: ['-y', 'local'] } },
              },
            },
          });
        }
        if (path.includes('.mcp.json')) {
          return JSON.stringify({
            mcpServers: { 'project-server': { command: 'npx', args: ['-y', 'project'] } },
          });
        }
        throw new Error('ENOENT');
      });

      cli.exec.mockResolvedValue([
        'global-server: npx -y global - ✓ Connected',
        'local-server: npx -y local - ✓ Connected',
        'project-server: npx -y project - ✓ Connected',
      ].join('\n'));

      const result = await svc.list();

      expect(result).toEqual([
        {
          name: 'global-server', fullName: 'global-server',
          command: 'npx -y global', status: 'connected',
          scope: 'user', config: { command: 'npx', args: ['-y', 'global'] },
        },
        {
          name: 'local-server', fullName: 'local-server',
          command: 'npx -y local', status: 'connected',
          scope: 'local', config: { command: 'npx', args: ['-y', 'local'] },
        },
        {
          name: 'project-server', fullName: 'project-server',
          command: 'npx -y project', status: 'connected',
          scope: 'project', config: { command: 'npx', args: ['-y', 'project'] },
        },
      ]);
    });

    it('list() 有 workspace 時帶 cwd', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' } },
      ] as any;
      cli.exec.mockResolvedValue('');

      await svc.list();

      expect(cli.exec).toHaveBeenCalledWith(
        ['mcp', 'list'],
        expect.objectContaining({ cwd: '/my/project' }),
      );
    });

    it('list() 無 workspace 時 cwd 為 undefined', async () => {
      cli.exec.mockResolvedValue('');
      await svc.list();

      expect(cli.exec).toHaveBeenCalledWith(
        ['mcp', 'list'],
        expect.objectContaining({ cwd: undefined }),
      );
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
        commandOrUrl: 'npx',
        args: ['-y', 'my-mcp', '--port', '3000'],
      });

      expect(cli.exec).toHaveBeenCalledWith(
        ['mcp', 'add', 'my-mcp', 'npx', '--', '-y', 'my-mcp', '--port', '3000'],
        expect.anything(),
      );
    });

    it('add 後 metadata cache 立即 invalidate（不等 FileWatcher debounce）', async () => {
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            mcpServers: { srv: { command: 'npx', args: ['test'] } },
          });
        }
        throw new Error('ENOENT');
      });

      // 建立 cache
      await svc.listFromFiles();
      mockReadFile.mockClear();

      // add() 後 cache 應被 invalidate
      await svc.add({ name: 'new-srv', commandOrUrl: 'npx new' });

      // 下次 listFromFiles() 應重讀 disk（cache miss）
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            mcpServers: {
              srv: { command: 'npx', args: ['test'] },
              'new-srv': { command: 'npx', args: ['new'] },
            },
          });
        }
        throw new Error('ENOENT');
      });

      const result = await svc.listFromFiles();
      expect(mockReadFile).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('remove()', () => {
    it('不帶 scope，無 workspace', async () => {
      await svc.remove('my-server');
      expect(cli.exec).toHaveBeenCalledWith(
        ['mcp', 'remove', 'my-server'],
        expect.objectContaining({ cwd: undefined }),
      );
    });

    it('帶 scope', async () => {
      await svc.remove('my-server', 'user');
      expect(cli.exec).toHaveBeenCalledWith(
        ['mcp', 'remove', 'my-server', '--scope', 'user'],
        expect.objectContaining({ cwd: undefined }),
      );
    });

    it('有 workspace 時帶 cwd', async () => {
      workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }];
      await svc.remove('my-server', 'project');
      expect(cli.exec).toHaveBeenCalledWith(
        ['mcp', 'remove', 'my-server', '--scope', 'project'],
        expect.objectContaining({ cwd: '/my/project' }),
      );
    });

    it('remove 後 metadata cache 立即 invalidate', async () => {
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            mcpServers: { srv: { command: 'npx', args: ['test'] } },
          });
        }
        throw new Error('ENOENT');
      });

      await svc.listFromFiles();
      mockReadFile.mockClear();

      await svc.remove('srv');

      // cache invalidated → 下次 listFromFiles() 重讀 disk
      await svc.listFromFiles();
      expect(mockReadFile).toHaveBeenCalled();
    });
  });

  describe('getDetail()', () => {
    it('非 plugin server：從設定檔讀取，不呼叫 CLI', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' } },
      ] as any;

      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            projects: {
              '/my/project': {
                mcpServers: {
                  XcodeBuildMCP: { command: 'npx', args: ['-y', 'xcodebuildmcp@latest', 'mcp'] },
                },
              },
            },
          });
        }
        throw new Error('ENOENT');
      });

      // 先 list 填充快取
      cli.exec.mockResolvedValue('XcodeBuildMCP: npx -y xcodebuildmcp@latest mcp - ✓ Connected');
      await svc.list();
      cli.exec.mockClear();

      const detail = await svc.getDetail('XcodeBuildMCP');
      const parsed = JSON.parse(detail);

      // 不應呼叫 CLI
      expect(cli.exec).not.toHaveBeenCalled();
      // 應包含結構化資料
      expect(parsed.name).toBe('XcodeBuildMCP');
      expect(parsed.command).toBe('npx');
      expect(parsed.args).toEqual(['-y', 'xcodebuildmcp@latest', 'mcp']);
      expect(parsed.scope).toBe('local');
      expect(parsed.status).toBe('connected');
    });

    it('無快取也能從設定檔讀取', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' } },
      ] as any;

      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.mcp.json')) {
          return JSON.stringify({
            mcpServers: {
              'my-server': { command: 'node', args: ['server.js'], env: { PORT: '3000' } },
            },
          });
        }
        throw new Error('ENOENT');
      });

      const detail = await svc.getDetail('my-server');
      const parsed = JSON.parse(detail);

      expect(cli.exec).not.toHaveBeenCalled();
      expect(parsed.command).toBe('node');
      expect(parsed.args).toEqual(['server.js']);
      expect(parsed.env).toEqual({ PORT: '3000' });
      expect(parsed.scope).toBe('project');
    });

    it('plugin server detail 依當前 workspace 挑選 install entry', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' } },
      ] as any;

      settings.readEnabledPlugins = vi.fn().mockImplementation(async (scope: string) => {
        if (scope === 'project') return { 'context7@official': true };
        if (scope === 'user') return { 'context7@official': false };
        return {};
      });

      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('installed_plugins.json')) {
          return JSON.stringify({
            version: 2,
            plugins: {
              'context7@official': [
                {
                  scope: 'user',
                  installPath: '/cache/user',
                  installedAt: '2026-01-01T00:00:00Z',
                  lastUpdated: '2026-01-01T00:00:00Z',
                },
                {
                  scope: 'project',
                  projectPath: '/my/project',
                  installPath: '/cache/project',
                  installedAt: '2026-01-02T00:00:00Z',
                  lastUpdated: '2026-01-02T00:00:00Z',
                },
              ],
            },
          });
        }
        if (path === '/cache/project/.mcp.json') {
          return JSON.stringify({
            context7: { command: 'npx', args: ['project-context7'] },
          });
        }
        if (path === '/cache/project/.claude-plugin/plugin.json') {
          return JSON.stringify({ description: 'Project install' });
        }
        if (path === '/cache/user/.mcp.json') {
          return JSON.stringify({
            context7: { command: 'npx', args: ['user-context7'] },
          });
        }
        if (path === '/cache/user/.claude-plugin/plugin.json') {
          return JSON.stringify({ description: 'User install' });
        }
        throw enoent();
      });

      const detail = JSON.parse(await svc.getDetail('plugin:context7@official:context7'));

      expect(detail.scope).toBe('project');
      expect(detail.enabled).toBe(true);
      expect(detail.installPath).toBe('/cache/project');
      expect(detail.config).toEqual({ command: 'npx', args: ['project-context7'] });
    });

    it('URL 型 server detail 會保留 url、transport、headers、env', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' } },
      ] as any;

      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.mcp.json')) {
          return JSON.stringify({
            mcpServers: {
              remote: {
                url: 'https://api.example.com/mcp',
                transport: 'http',
                headers: { Authorization: 'Bearer token' },
                env: { API_KEY: 'secret' },
              },
            },
          });
        }
        throw enoent();
      });

      const detail = JSON.parse(await svc.getDetail('remote'));

      expect(detail.url).toBe('https://api.example.com/mcp');
      expect(detail.transport).toBe('http');
      expect(detail.headers).toEqual({ Authorization: 'Bearer token' });
      expect(detail.env).toEqual({ API_KEY: 'secret' });
    });

    it('同 base name 不同 marketplace 的 plugin detail 依 canonical fullName 命中正確 plugin', async () => {
      settings.readEnabledPlugins = vi.fn().mockImplementation(async (scope: string) => {
        if (scope === 'user') return { 'shared@community': true, 'shared@official': false };
        return {};
      });

      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('installed_plugins.json')) {
          return JSON.stringify({
            version: 2,
            plugins: {
              'shared@official': [
                {
                  scope: 'user',
                  installPath: '/cache/official',
                  installedAt: '2026-01-01T00:00:00Z',
                  lastUpdated: '2026-01-01T00:00:00Z',
                },
              ],
              'shared@community': [
                {
                  scope: 'user',
                  installPath: '/cache/community',
                  installedAt: '2026-01-02T00:00:00Z',
                  lastUpdated: '2026-01-02T00:00:00Z',
                },
              ],
            },
          });
        }
        if (path === '/cache/official/.mcp.json') {
          return JSON.stringify({ remote: { command: 'npx', args: ['official'] } });
        }
        if (path === '/cache/community/.mcp.json') {
          return JSON.stringify({ remote: { command: 'npx', args: ['community'] } });
        }
        if (path.endsWith('.claude-plugin/plugin.json')) {
          return JSON.stringify({});
        }
        throw enoent();
      });

      const detail = JSON.parse(await svc.getDetail('plugin:shared@community:remote'));

      expect(detail.plugin).toBe('shared@community');
      expect(detail.installPath).toBe('/cache/community');
      expect(detail.config).toEqual({ command: 'npx', args: ['community'] });
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

    it('pollOnce() diff 不使用 JSON.stringify 序列化陣列（效能保證）', async () => {
      const spy = vi.spyOn(JSON, 'stringify');

      try {
        cli.exec.mockResolvedValue('srv: node test - ✓ Connected');
        svc.startPolling();
        await vi.advanceTimersByTimeAsync(0);

        // 不應呼叫 JSON.stringify 序列化整個 server 陣列做 diff
        const calledWithArray = spy.mock.calls.some(([arg]) => Array.isArray(arg));
        expect(calledWithArray).toBe(false);
      } finally {
        spy.mockRestore();
      }
    });

    it('server 狀態未變 → 不觸發 onStatusChange', async () => {
      const listener = vi.fn();
      svc.onStatusChange.event(listener);

      cli.exec.mockResolvedValue('srv: node test - ✓ Connected');
      svc.startPolling();
      await vi.advanceTimersByTimeAsync(0);
      // 首次 poll → 觸發（statusCache 從空變為有值）
      expect(listener).toHaveBeenCalledTimes(1);

      // 第二次 poll，相同狀態
      await vi.advanceTimersByTimeAsync(60_000);
      expect(listener).toHaveBeenCalledTimes(1); // 不再觸發
    });

    it('server 被移除 → 觸發 onStatusChange（fullName 比對）', async () => {
      const listener = vi.fn();
      svc.onStatusChange.event(listener);

      // 首次：兩個 server
      cli.exec.mockResolvedValue(
        'srv-a: node a.js - ✓ Connected\nsrv-b: node b.js - ✓ Connected',
      );
      svc.startPolling();
      await vi.advanceTimersByTimeAsync(0);
      expect(listener).toHaveBeenCalledTimes(1);

      // 第二次：srv-b 消失
      cli.exec.mockResolvedValue('srv-a: node a.js - ✓ Connected');
      await vi.advanceTimersByTimeAsync(60_000);
      expect(listener).toHaveBeenCalledTimes(2);
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

    it('連續 3 次失敗 → 停止 polling + 觸發 onPollUnavailable', async () => {
      const unavailableListener = vi.fn();
      svc.onPollUnavailable.event(unavailableListener);

      cli.exec.mockRejectedValue(new Error('CLI crash'));
      svc.startPolling();

      // 首次 pollOnce（立即執行）→ 失敗 #1
      await vi.advanceTimersByTimeAsync(0);
      expect(unavailableListener).not.toHaveBeenCalled();

      // 第 2 次 poll
      await vi.advanceTimersByTimeAsync(60_000);
      expect(unavailableListener).not.toHaveBeenCalled();

      // 第 3 次 poll → 達到上限，觸發 onPollUnavailable + 停止 timer
      await vi.advanceTimersByTimeAsync(60_000);
      expect(unavailableListener).toHaveBeenCalledTimes(1);

      // timer 已停止，不再觸發 poll
      cli.exec.mockClear();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(cli.exec).not.toHaveBeenCalled();
    });

    it('中途成功 → 重置錯誤計數', async () => {
      const unavailableListener = vi.fn();
      svc.onPollUnavailable.event(unavailableListener);

      // 連續 2 次失敗
      cli.exec.mockRejectedValue(new Error('fail'));
      svc.startPolling();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(60_000);

      // 第 3 次成功 → 計數歸零
      cli.exec.mockResolvedValue('my-server: node server.js - ✓ Connected');
      await vi.advanceTimersByTimeAsync(60_000);
      expect(unavailableListener).not.toHaveBeenCalled();

      // 再連續 2 次失敗 → 仍不會觸發
      cli.exec.mockRejectedValue(new Error('fail'));
      await vi.advanceTimersByTimeAsync(60_000);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(unavailableListener).not.toHaveBeenCalled();
    });

    it('同步重複 triggerPoll() 只觸發一次即時刷新', async () => {
      cli.exec.mockResolvedValue('srv: node server.js - ✓ Connected');

      svc.triggerPoll();
      svc.triggerPoll();

      await Promise.resolve();
      await Promise.resolve();

      expect(cli.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe('restartPolling()', () => {
    it('重置錯誤計數並重啟 timer', async () => {
      const unavailableListener = vi.fn();
      svc.onPollUnavailable.event(unavailableListener);

      // 讓 polling 因錯誤停止
      cli.exec.mockRejectedValue(new Error('fail'));
      svc.startPolling();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(60_000);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(unavailableListener).toHaveBeenCalledTimes(1);

      // restartPolling → 重啟
      cli.exec.mockResolvedValue('my-server: node server.js - ✓ Connected');
      svc.restartPolling();
      await vi.advanceTimersByTimeAsync(0);

      // 應成功觸發 onStatusChange
      expect(svc.getCachedStatus()).toHaveLength(1);
    });
  });

  describe('refreshStatus()', () => {
    it('手動刷新觸發 onStatusChange', async () => {
      const listener = vi.fn();
      svc.onStatusChange.event(listener);

      cli.exec.mockResolvedValue('srv: npx test - ✓ Connected');
      const result = await svc.refreshStatus();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('connected');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildServerMetadata cache', () => {
    it('連續兩次 listFromFiles()：第二次不重讀 disk（cache hit）', async () => {
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            mcpServers: { srv: { command: 'npx', args: ['test'] } },
          });
        }
        throw new Error('ENOENT');
      });

      const first = await svc.listFromFiles();
      expect(first).toHaveLength(1);

      // 清除呼叫紀錄
      mockReadFile.mockClear();

      const second = await svc.listFromFiles();
      expect(second).toHaveLength(1);

      // cache hit → readFile 不應被呼叫
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('invalidateMetadataCache() 後重新從 disk 讀取', async () => {
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            mcpServers: { srv: { command: 'npx', args: ['v1'] } },
          });
        }
        throw new Error('ENOENT');
      });

      await svc.listFromFiles();
      mockReadFile.mockClear();

      // invalidate cache
      svc.invalidateMetadataCache();

      // 更新 mock 回傳新資料
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            mcpServers: { srv: { command: 'npx', args: ['v2'] } },
          });
        }
        throw new Error('ENOENT');
      });

      const result = await svc.listFromFiles();

      // 重新讀取 → readFile 被呼叫
      expect(mockReadFile).toHaveBeenCalled();
      // 結果反映新資料
      expect(result[0].command).toBe('npx v2');
    });

    it('polling 週期內 cache 避免重複 disk read', async () => {
      mockReadFile.mockImplementation(async (path: string) => {
        if (path.includes('.claude.json')) {
          return JSON.stringify({
            mcpServers: { srv: { command: 'npx', args: ['test'] } },
          });
        }
        throw new Error('ENOENT');
      });
      cli.exec.mockResolvedValue('srv: npx test - ✓ Connected');

      svc.startPolling();
      // 首次 pollOnce → list() → buildServerMetadata() → 讀 disk
      await vi.advanceTimersByTimeAsync(0);
      const firstReadCount = mockReadFile.mock.calls.length;
      expect(firstReadCount).toBeGreaterThan(0);

      mockReadFile.mockClear();

      // 第二次 poll → cache hit，不讀 disk
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });
});
