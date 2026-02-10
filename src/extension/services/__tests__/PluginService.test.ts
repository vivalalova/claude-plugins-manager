import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workspace } from 'vscode';
import { PluginService } from '../PluginService';
import { CLI_LONG_TIMEOUT_MS } from '../../constants';
import type { CliService } from '../CliService';
import type { SettingsFileService } from '../SettingsFileService';
import type { InstalledPluginsFile, AvailablePlugin } from '../../../shared/types';

/* ── fs/promises mock（readMcpServers + findCachePath 內部使用） ── */
const mockReadFile = vi.hoisted(() => vi.fn());
const mockReaddir = vi.hoisted(() => vi.fn());
vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  readdir: mockReaddir,
}));

vi.mock('os', () => ({
  homedir: () => '/mock-home',
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
      // Mock workspace 為 /my/project，讓 project entry 通過過濾
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

      // user scope enabled, project scope disabled
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
      // Mock workspace 為 /current/project
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

      // 應該只回傳 user + 當前專案的 project + 當前專案的 local，過濾掉其他專案的
      expect(result).toHaveLength(3);
      expect(result.map(r => r.scope)).toEqual(['user', 'project', 'local']);
      expect(result.every(r => r.projectPath === '/current/project' || r.scope === 'user')).toBe(true);
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
  });

  /* ═══════ listAvailable ═══════ */
  describe('listAvailable()', () => {
    it('合併 installed + available', async () => {
      settings.readInstalledPlugins.mockResolvedValue(EMPTY_INSTALLED);
      settings.readEnabledPlugins.mockResolvedValue({});

      const available: AvailablePlugin[] = [
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
    const available: AvailablePlugin[] = [
      {
        pluginId: 'my-plugin@mp',
        name: 'my-plugin',
        description: '',
        marketplaceName: 'mp',
        version: '1.0.0',
      },
    ];

    it('plugin 不在 available → throw', async () => {
      settings.scanAvailablePlugins.mockResolvedValue([]);
      await expect(svc.install('nonexistent@mp', 'user')).rejects.toThrow(
        'not found in any marketplace',
      );
    });

    it('已有其他 scope 安裝 → 複用 installPath', async () => {
      workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }];
      settings.scanAvailablePlugins.mockResolvedValue(available);
      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'my-plugin@mp': [
            {
              scope: 'user',
              installPath: '/existing/path',
              version: '1.0.0',
              installedAt: '2025-01-01',
              lastUpdated: '2025-01-01',
            },
          ],
        },
      });

      await svc.install('my-plugin@mp', 'project');

      expect(settings.addInstallEntry).toHaveBeenCalledWith(
        'my-plugin@mp',
        expect.objectContaining({
          scope: 'project',
          installPath: '/existing/path',
        }),
      );
      expect(settings.setPluginEnabled).toHaveBeenCalledWith(
        'my-plugin@mp',
        'project',
        true,
      );
    });

    it('新安裝 → 從 cache 找 installPath', async () => {
      settings.scanAvailablePlugins.mockResolvedValue(available);
      settings.readInstalledPlugins.mockResolvedValue(EMPTY_INSTALLED);
      mockReaddir.mockResolvedValue(['1.0.0']);

      await svc.install('my-plugin@mp', 'user');

      expect(settings.addInstallEntry).toHaveBeenCalledWith(
        'my-plugin@mp',
        expect.objectContaining({
          scope: 'user',
          installPath: '/mock-home/.claude/plugins/cache/mp/my-plugin/1.0.0',
        }),
      );
      expect(settings.setPluginEnabled).toHaveBeenCalledWith(
        'my-plugin@mp',
        'user',
        true,
      );
    });

    it('cache 目錄空 → throw', async () => {
      settings.scanAvailablePlugins.mockResolvedValue(available);
      settings.readInstalledPlugins.mockResolvedValue(EMPTY_INSTALLED);
      mockReaddir.mockResolvedValue([]);

      await expect(svc.install('my-plugin@mp', 'user')).rejects.toThrow(
        'No cached version',
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
      workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }];
      await svc.uninstall('my-plugin@mp', 'project');

      expect(settings.removeInstallEntry).toHaveBeenCalledWith(
        'my-plugin@mp',
        'project',
        '/my/project',
      );
    });

    it('project scope 無 workspace → throw', async () => {
      await expect(svc.uninstall('my-plugin@mp', 'project')).rejects.toThrow(
        'No workspace folder open',
      );
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
  });

  describe('disable()', () => {
    it('只 disable 指定 scope（不影響其他 scope）', async () => {
      await svc.disable('my-plugin@mp', 'user');
      expect(settings.setPluginEnabled).toHaveBeenCalledWith(
        'my-plugin@mp',
        'user',
        false,
      );
      // 確認只呼叫一次，不會動到其他 scope
      expect(settings.setPluginEnabled).toHaveBeenCalledTimes(1);
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
