import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workspace } from 'vscode';
import { PluginService } from '../PluginService';
import { CLI_LONG_TIMEOUT_MS } from '../../constants';
import type { CliService } from '../CliService';
import type { SettingsFileService } from '../SettingsFileService';
import type { InstalledPluginsFile } from '../../../shared/types';

/* ── fs/promises mock（readMcpServers 內部使用） ── */
const mockReadFile = vi.hoisted(() => vi.fn());
vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
}));

/* ── helpers ── */
function createMockCli(): CliService & { exec: ReturnType<typeof vi.fn> } {
  return {
    exec: vi.fn().mockResolvedValue(''),
    execJson: vi.fn().mockResolvedValue([]),
  } as unknown as CliService & { exec: ReturnType<typeof vi.fn> };
}

function createMockSettings(): SettingsFileService & Record<string, ReturnType<typeof vi.fn>> {
  return {
    getSettingsPath: vi.fn(),
    readEnabledPlugins: vi.fn().mockResolvedValue({}),
    setPluginEnabled: vi.fn().mockResolvedValue(undefined),
    readInstalledPlugins: vi.fn().mockResolvedValue({ version: 2, plugins: {} }),
    writeInstalledPlugins: vi.fn().mockResolvedValue(undefined),
    addInstallEntry: vi.fn().mockResolvedValue(undefined),
    removeInstallEntry: vi.fn().mockResolvedValue(undefined),
    scanAvailablePlugins: vi.fn().mockResolvedValue([]),
    readMarketplaceSources: vi.fn().mockResolvedValue({}),
  } as unknown as SettingsFileService & Record<string, ReturnType<typeof vi.fn>>;
}

const EMPTY_INSTALLED: InstalledPluginsFile = { version: 2, plugins: {} };

/** 建立含 user scope entry 的 installed data（給 reuse 路徑測試用） */
function installedWithUser(pluginId: string): InstalledPluginsFile {
  return {
    version: 2,
    plugins: {
      [pluginId]: [{
        scope: 'user',
        installPath: '/existing/path',
        version: '1.0.0',
        installedAt: '2025-01-01',
        lastUpdated: '2025-01-01',
      }],
    },
  };
}

describe('PluginService', () => {
  let cli: ReturnType<typeof createMockCli>;
  let settings: ReturnType<typeof createMockSettings>;
  let svc: PluginService;

  beforeEach(() => {
    vi.clearAllMocks();
    cli = createMockCli();
    settings = createMockSettings();
    svc = new PluginService(cli, settings);
    workspace.workspaceFolders = undefined;
  });

  /* ═══════ listInstalled ═══════ */
  describe('listInstalled()', () => {
    it('空 installed_plugins → 回傳空陣列', async () => {
      settings.readInstalledPlugins.mockResolvedValue(EMPTY_INSTALLED);
      const result = await svc.listInstalled();
      expect(result).toEqual([]);
    });

    it('合併 installed entry + 各 scope enabled 狀態', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/my/project' }, name: 'my-project', index: 0 },
      ] as any;

      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'my-plugin@mp': [
            {
              scope: 'user',
              installPath: '/cache/my-plugin',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-06-01',
            },
            {
              scope: 'project',
              installPath: '/cache/my-plugin',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-06-01',
              projectPath: '/my/project',
            },
          ],
        },
      } satisfies InstalledPluginsFile);

      settings.readEnabledPlugins
        .mockResolvedValueOnce({ 'my-plugin@mp': true }) // user
        .mockResolvedValueOnce({})                        // project
        .mockResolvedValueOnce({});                       // local

      mockReadFile.mockRejectedValue(new Error('no .mcp.json'));

      const result = await svc.listInstalled();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'my-plugin@mp',
        scope: 'user',
        enabled: true,
      });
      expect(result[1]).toMatchObject({
        id: 'my-plugin@mp',
        scope: 'project',
        enabled: false,
      });
    });

    it('只回傳當前 workspace 的 project/local entries', async () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/current/project' }, name: 'current', index: 0 },
      ] as any;

      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'plugin-a@mp': [
            {
              scope: 'user',
              installPath: '/cache/plugin-a',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-01-01',
            },
            {
              scope: 'project',
              installPath: '/cache/plugin-a',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-01-01',
              projectPath: '/current/project',
            },
            {
              scope: 'project',
              installPath: '/cache/plugin-a',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-01-01',
              projectPath: '/other/project',
            },
            {
              scope: 'local',
              installPath: '/cache/plugin-a',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-01-01',
              projectPath: '/current/project',
            },
          ],
        },
      } satisfies InstalledPluginsFile);

      settings.readEnabledPlugins
        .mockResolvedValueOnce({}) // user
        .mockResolvedValueOnce({}) // project
        .mockResolvedValueOnce({}); // local

      mockReadFile.mockRejectedValue(new Error('no .mcp.json'));

      const result = await svc.listInstalled();

      expect(result).toHaveLength(3);
      expect(result.map(r => r.scope)).toEqual(['user', 'project', 'local']);
      expect(result.every(r => r.projectPath === '/current/project' || r.scope === 'user')).toBe(true);
    });

    it('無 workspace → 只回傳 user scope entries', async () => {
      // workspace.workspaceFolders 已在 beforeEach 設為 undefined
      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'plugin-a@mp': [
            {
              scope: 'user',
              installPath: '/cache/plugin-a',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-01-01',
            },
            {
              scope: 'project',
              installPath: '/cache/plugin-a',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-01-01',
              projectPath: '/some/project',
            },
            {
              scope: 'local',
              installPath: '/cache/plugin-a',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-01-01',
              projectPath: '/some/project',
            },
          ],
        },
      } satisfies InstalledPluginsFile);

      settings.readEnabledPlugins
        .mockResolvedValueOnce({ 'plugin-a@mp': true }) // user
        .mockResolvedValueOnce({})                       // project (caught)
        .mockResolvedValueOnce({});                      // local (caught)

      mockReadFile.mockRejectedValue(new Error('no .mcp.json'));

      const result = await svc.listInstalled();

      expect(result).toHaveLength(1);
      expect(result[0].scope).toBe('user');
    });

    it('讀取 .mcp.json 並附加到結果', async () => {
      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'mcp-plugin@mp': [
            {
              scope: 'user',
              installPath: '/cache/mcp-plugin',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-06-01',
            },
          ],
        },
      });

      settings.readEnabledPlugins.mockResolvedValue({});
      mockReadFile.mockResolvedValue(
        JSON.stringify({ myServer: { command: 'node', args: ['server.js'] } }),
      );

      const result = await svc.listInstalled();
      expect(result[0].mcpServers).toEqual({
        myServer: { command: 'node', args: ['server.js'] },
      });
    });

    it('.mcp.json 不存在 → mcpServers 為 undefined', async () => {
      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'no-mcp@mp': [{
            scope: 'user',
            installPath: '/cache/no-mcp',
            version: '1.0.0',
            installedAt: '2025-01-01',
            lastUpdated: '2025-01-01',
          }],
        },
      });

      settings.readEnabledPlugins.mockResolvedValue({});
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await svc.listInstalled();
      expect(result[0].mcpServers).toBeUndefined();
    });
  });

  /* ═══════ listAvailable ═══════ */
  describe('listAvailable()', () => {
    it('合併 installed + available', async () => {
      settings.readInstalledPlugins.mockResolvedValue(EMPTY_INSTALLED);
      settings.readEnabledPlugins.mockResolvedValue({});

      const available = [
        {
          pluginId: 'new-plugin@mp',
          name: 'new-plugin',
          description: 'A new plugin',
          marketplaceName: 'mp',
          version: '2.0.0',
        },
      ];
      settings.scanAvailablePlugins.mockResolvedValue(available);

      settings.readMarketplaceSources.mockResolvedValue({ mp: 'https://github.com/example/mp' });

      const result = await svc.listAvailable();
      expect(result.installed).toEqual([]);
      expect(result.available).toEqual(available);
      expect(result.marketplaceSources).toEqual({ mp: 'https://github.com/example/mp' });
    });
  });

  /* ═══════ install ═══════ */
  describe('install()', () => {
    it('全新安裝 user scope → CLI 安裝，不帶 cwd', async () => {
      settings.readInstalledPlugins.mockResolvedValue(EMPTY_INSTALLED);

      await svc.install('my-plugin@mp', 'user');

      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'install', 'my-plugin@mp', '--scope', 'user'],
        { timeout: CLI_LONG_TIMEOUT_MS },
      );
      expect(settings.addInstallEntry).not.toHaveBeenCalled();
      expect(settings.setPluginEnabled).not.toHaveBeenCalled();
    });

    it('全新安裝 project scope → CLI 安裝帶 cwd', async () => {
      workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }] as any;
      settings.readInstalledPlugins.mockResolvedValue(EMPTY_INSTALLED);

      await svc.install('my-plugin@mp', 'project');

      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'install', 'my-plugin@mp', '--scope', 'project'],
        { timeout: CLI_LONG_TIMEOUT_MS, cwd: '/my/project' },
      );
    });

    it('全新安裝 project scope 無 workspace → throw', async () => {
      settings.readInstalledPlugins.mockResolvedValue(EMPTY_INSTALLED);

      await expect(svc.install('my-plugin@mp', 'project'))
        .rejects.toThrow('No workspace folder open');
      expect(cli.exec).not.toHaveBeenCalled();
    });

    it('已有其他 scope 安裝 → 複用 installPath，不呼叫 CLI', async () => {
      workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }] as any;
      settings.readInstalledPlugins.mockResolvedValue(installedWithUser('my-plugin@mp'));

      await svc.install('my-plugin@mp', 'project');

      expect(cli.exec).not.toHaveBeenCalled();
      expect(settings.addInstallEntry).toHaveBeenCalledWith(
        'my-plugin@mp',
        expect.objectContaining({
          scope: 'project',
          installPath: '/existing/path',
          version: '1.0.0',
          projectPath: '/my/project',
        }),
      );
      expect(settings.setPluginEnabled).toHaveBeenCalledWith(
        'my-plugin@mp',
        'project',
        true,
      );
    });

    it('reuse 路徑 project scope 無 workspace → throw（不到 addInstallEntry）', async () => {
      settings.readInstalledPlugins.mockResolvedValue(installedWithUser('my-plugin@mp'));

      await expect(svc.install('my-plugin@mp', 'project'))
        .rejects.toThrow('No workspace folder open');
      expect(settings.addInstallEntry).not.toHaveBeenCalled();
      expect(settings.setPluginEnabled).not.toHaveBeenCalled();
    });

    it('reuse 路徑 addInstallEntry 失敗 → setPluginEnabled 不呼叫，error 往上拋', async () => {
      workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }] as any;
      settings.readInstalledPlugins.mockResolvedValue(installedWithUser('my-plugin@mp'));
      settings.addInstallEntry.mockRejectedValue(new Error('write failed'));

      await expect(svc.install('my-plugin@mp', 'project'))
        .rejects.toThrow('write failed');
      expect(settings.setPluginEnabled).not.toHaveBeenCalled();
    });

    it('reuse 路徑 setPluginEnabled 失敗 → error 往上拋（entry 已寫入）', async () => {
      workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }] as any;
      settings.readInstalledPlugins.mockResolvedValue(installedWithUser('my-plugin@mp'));
      settings.setPluginEnabled.mockRejectedValue(new Error('EACCES'));

      await expect(svc.install('my-plugin@mp', 'project'))
        .rejects.toThrow('EACCES');
      // addInstallEntry 已被呼叫（entry 已寫入）
      expect(settings.addInstallEntry).toHaveBeenCalledTimes(1);
    });

    it('CLI 安裝失敗 → 拋出錯誤', async () => {
      settings.readInstalledPlugins.mockResolvedValue(EMPTY_INSTALLED);
      cli.exec.mockRejectedValue(new Error('CLI install failed'));

      await expect(svc.install('my-plugin@mp', 'user')).rejects.toThrow(
        'CLI install failed',
      );
    });
  });

  /* ═══════ uninstall ═══════ */
  describe('uninstall()', () => {
    it('user scope → removeInstallEntry + disable', async () => {
      await svc.uninstall('my-plugin@mp', 'user');

      expect(settings.removeInstallEntry).toHaveBeenCalledWith(
        'my-plugin@mp',
        'user',
        undefined,
      );
      expect(settings.setPluginEnabled).toHaveBeenCalledWith(
        'my-plugin@mp',
        'user',
        false,
      );
    });

    it('project scope → 帶 projectPath', async () => {
      workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }] as any;
      await svc.uninstall('my-plugin@mp', 'project');

      expect(settings.removeInstallEntry).toHaveBeenCalledWith(
        'my-plugin@mp',
        'project',
        '/my/project',
      );
      expect(settings.setPluginEnabled).toHaveBeenCalledWith(
        'my-plugin@mp',
        'project',
        false,
      );
    });

    it('project scope 無 workspace → throw', async () => {
      await expect(svc.uninstall('my-plugin@mp', 'project')).rejects.toThrow(
        'No workspace folder open',
      );
    });

    it('removeInstallEntry 失敗 → setPluginEnabled 不呼叫', async () => {
      settings.removeInstallEntry.mockRejectedValue(new Error('write failed'));

      await expect(svc.uninstall('my-plugin@mp', 'user'))
        .rejects.toThrow('write failed');
      expect(settings.setPluginEnabled).not.toHaveBeenCalled();
    });
  });

  /* ═══════ enable / disable（per-scope） ═══════ */
  describe('enable()', () => {
    it('寫入指定 scope', async () => {
      await svc.enable('my-plugin@mp', 'project');
      expect(settings.setPluginEnabled).toHaveBeenCalledWith(
        'my-plugin@mp',
        'project',
        true,
      );
    });

    it('不帶 scope → 預設 user', async () => {
      await svc.enable('my-plugin@mp');
      expect(settings.setPluginEnabled).toHaveBeenCalledWith(
        'my-plugin@mp',
        'user',
        true,
      );
    });

    it('setPluginEnabled 失敗 → error 往上拋', async () => {
      settings.setPluginEnabled.mockRejectedValue(new Error('EACCES'));

      await expect(svc.enable('my-plugin@mp', 'user'))
        .rejects.toThrow('EACCES');
    });
  });

  describe('disable()', () => {
    it('只 disable 指定 scope（不影響其他 scope）', async () => {
      await svc.disable('my-plugin@mp', 'user');
      expect(settings.setPluginEnabled).toHaveBeenCalledWith(
        'my-plugin@mp',
        'user',
        false,
      );
      expect(settings.setPluginEnabled).toHaveBeenCalledTimes(1);
    });

    it('不帶 scope → 預設 user', async () => {
      await svc.disable('my-plugin@mp');
      expect(settings.setPluginEnabled).toHaveBeenCalledWith(
        'my-plugin@mp',
        'user',
        false,
      );
    });
  });

  /* ═══════ disableAll ═══════ */
  describe('disableAll()', () => {
    it('清除三個 scope 所有 enabledPlugins', async () => {
      settings.readEnabledPlugins
        .mockResolvedValueOnce({ 'a@mp': true, 'b@mp': true }) // user
        .mockResolvedValueOnce({ 'a@mp': true })               // project
        .mockResolvedValueOnce({});                             // local

      await svc.disableAll();

      expect(settings.setPluginEnabled).toHaveBeenCalledWith('a@mp', 'user', false);
      expect(settings.setPluginEnabled).toHaveBeenCalledWith('b@mp', 'user', false);
      expect(settings.setPluginEnabled).toHaveBeenCalledWith('a@mp', 'project', false);
      expect(settings.setPluginEnabled).toHaveBeenCalledTimes(3);
    });

    it('project/local scope 無 workspace → 靜默跳過', async () => {
      settings.readEnabledPlugins
        .mockResolvedValueOnce({})                                  // user
        .mockRejectedValueOnce(new Error('No workspace'))           // project
        .mockRejectedValueOnce(new Error('No workspace'));          // local

      await expect(svc.disableAll()).resolves.toBeUndefined();
    });

    it('非 workspace 錯誤 → 往上拋（不靜默吞掉）', async () => {
      settings.readEnabledPlugins
        .mockResolvedValueOnce({})                                      // user
        .mockRejectedValueOnce(new Error('EACCES: permission denied')); // project

      await expect(svc.disableAll()).rejects.toThrow('EACCES');
    });

    it('所有 scope 都空 → 不呼叫 setPluginEnabled', async () => {
      settings.readEnabledPlugins.mockResolvedValue({});

      await svc.disableAll();

      expect(settings.setPluginEnabled).not.toHaveBeenCalled();
    });
  });

  /* ═══════ update（保留 CLI） ═══════ */
  describe('update()', () => {
    it('帶 scope', async () => {
      await svc.update('my-plugin', 'user');
      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'update', 'my-plugin', '--scope', 'user'],
        { timeout: CLI_LONG_TIMEOUT_MS },
      );
    });

    it('不帶 scope', async () => {
      await svc.update('my-plugin');
      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'update', 'my-plugin'],
        { timeout: CLI_LONG_TIMEOUT_MS },
      );
    });
  });
});
