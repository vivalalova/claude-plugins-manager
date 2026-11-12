import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workspace } from 'vscode';
import { MarketplaceService } from '../MarketplaceService';
import { CLI_LONG_TIMEOUT_MS } from '../../constants';
import { NoWorkspaceError } from '../../utils/workspace';
import { KNOWN_MARKETPLACES_PATH } from '../../paths';
import type { CliService } from '../CliService';
import type { ConfirmFn } from '../commandConsent';
import { XCODE_SHA, createNotFoundError, createRefusedError } from './commandConsentFixtures';
import type { SettingsFileService } from '../SettingsFileService';
import type { InstalledPluginsFile } from '../../../shared/types';

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockRename = vi.hoisted(() => vi.fn());
const mockMkdtemp = vi.hoisted(() => vi.fn());
const mockRm = vi.hoisted(() => vi.fn());
const mockAccess = vi.hoisted(() => vi.fn());
const mockRealpath = vi.hoisted(() => vi.fn());
const mockExecFile = vi.hoisted(() => vi.fn());
const mockFixScriptPermissions = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  rename: mockRename,
  mkdtemp: mockMkdtemp,
  rm: mockRm,
  access: mockAccess,
  realpath: mockRealpath,
}));

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}));

vi.mock('../../utils/fixScriptPermissions', () => ({
  fixScriptPermissions: mockFixScriptPermissions,
}));

function createMockCli(): { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService {
  return {
    exec: vi.fn().mockResolvedValue(''),
    execJson: vi.fn().mockResolvedValue({}),
  } as unknown as { exec: ReturnType<typeof vi.fn>; execJson: ReturnType<typeof vi.fn> } & CliService;
}

function createMockSettings(): SettingsFileService & Record<string, ReturnType<typeof vi.fn>> {
  return {
    readInstalledPlugins: vi.fn().mockResolvedValue({ version: 2, plugins: {} } satisfies InstalledPluginsFile),
    readAllEnabledPlugins: vi.fn().mockResolvedValue({ user: {}, project: {}, local: {} }),
    replaceEnabledPlugins: vi.fn().mockResolvedValue(undefined),
  } as unknown as SettingsFileService & Record<string, ReturnType<typeof vi.fn>>;
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
  let settings: ReturnType<typeof createMockSettings>;
  let svc: MarketplaceService;
  let confirm: ReturnType<typeof vi.fn<ConfirmFn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    workspace.workspaceFolders = undefined;
    cli = createMockCli();
    settings = createMockSettings();
    confirm = vi.fn<ConfirmFn>().mockResolvedValue(true);
    svc = new MarketplaceService(cli, settings, confirm);
    mockReadFile.mockResolvedValue(JSON.stringify(MOCK_CONFIG));
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    mockRealpath.mockImplementation(async (filePath: string) => filePath);
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

    it('CLI 失敗 → error 往上拋，不寫 config file', async () => {
      cli.exec.mockRejectedValue(new Error('CLI add failed'));
      await expect(svc.add('https://github.com/owner/repo')).rejects.toThrow('CLI add failed');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('add 進行中時，toggleAutoUpdate 會等待前一個 mutation 完成', async () => {
      let markAddStarted!: () => void;
      const addStarted = new Promise<void>((resolve) => {
        markAddStarted = resolve;
      });
      let releaseAdd!: (value: string) => void;
      cli.exec.mockImplementation(() => new Promise<string>((resolve) => {
        markAddStarted();
        releaseAdd = resolve;
      }));

      const addPromise = svc.add('https://github.com/owner/repo');
      await addStarted;
      expect(cli.exec).toHaveBeenCalledTimes(1);

      const togglePromise = svc.toggleAutoUpdate('my-marketplace');
      await Promise.resolve();

      expect(mockWriteFile).not.toHaveBeenCalled();

      mockReadFile.mockResolvedValue(JSON.stringify({
        ...MOCK_CONFIG,
        fresh: {
          source: { source: 'github', repo: 'owner/fresh' },
          installLocation: '/path/to/fresh',
          lastUpdated: '2026-03-02T00:01:00.000Z',
          autoUpdate: false,
        },
      }));
      releaseAdd('');

      await Promise.all([addPromise, togglePromise]);

      expect(mockWriteFile).toHaveBeenCalledTimes(2);
      expect(mockRename).toHaveBeenCalledTimes(2);
    });
  });

  describe('remove()', () => {
    it('呼叫正確 CLI args', async () => {
      await svc.remove('my-marketplace');
      expect(cli.exec).toHaveBeenCalledWith(['plugin', 'marketplace', 'remove', 'my-marketplace']);
    });

    it('CLI 失敗 → error 往上拋', async () => {
      cli.exec.mockRejectedValue(new Error('CLI remove failed'));
      await expect(svc.remove('my-marketplace')).rejects.toThrow('CLI remove failed');
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

    it('CLI 失敗 → error 往上拋，不呼叫 fixScriptPermissions', async () => {
      cli.exec.mockRejectedValue(new Error('CLI update failed'));
      await expect(svc.update('my-marketplace')).rejects.toThrow('CLI update failed');
      expect(mockFixScriptPermissions).not.toHaveBeenCalled();
    });

    it('update 成功 → 呼叫 fixScriptPermissions 修正 installLocation 下的 .sh 權限', async () => {
      await svc.update('my-marketplace');
      expect(mockFixScriptPermissions).toHaveBeenCalledWith('/path/to/marketplace');
    });

    it('update 全部（無 name）→ fixScriptPermissions 對每個 installLocation 各呼叫一次', async () => {
      await svc.update();
      expect(mockFixScriptPermissions).toHaveBeenCalledWith('/path/to/marketplace');
      expect(mockFixScriptPermissions).toHaveBeenCalledWith('/local/path');
      expect(mockFixScriptPermissions).toHaveBeenCalledTimes(2);
    });
  });

  describe('toggleAutoUpdate()', () => {
    it('翻轉 autoUpdate flag 並寫回 config', async () => {
      await svc.toggleAutoUpdate('my-marketplace');

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockWriteFile.mock.calls[0][0]).toBe(KNOWN_MARKETPLACES_PATH + '.tmp');
      const written = JSON.parse(mockWriteFile.mock.calls[0][1]);
      expect(written['my-marketplace'].autoUpdate).toBe(false);
      expect(mockRename).toHaveBeenCalledWith(KNOWN_MARKETPLACES_PATH + '.tmp', KNOWN_MARKETPLACES_PATH);
    });

    it('不存在的 name 拋錯', async () => {
      await expect(svc.toggleAutoUpdate('nonexistent'))
        .rejects.toThrow('Marketplace "nonexistent" not found');
    });

    it('readFile 失敗 → error 往上拋，不寫 config file', async () => {
      mockReadFile.mockRejectedValue(new Error('EACCES: permission denied'));
      await expect(svc.toggleAutoUpdate('my-marketplace')).rejects.toThrow('EACCES');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe('reinstallAll()', () => {
    it('保留各 scope 的 enabledPlugins 設定', async () => {
      settings.readAllEnabledPlugins.mockResolvedValue({
        user: { 'looping@plugins-local': true },
        project: { 'stock@plugins-local': true },
        local: {},
      });

      await svc.reinstallAll();

      expect(settings.replaceEnabledPlugins).toHaveBeenCalledTimes(3);
      expect(settings.replaceEnabledPlugins).toHaveBeenCalledWith('user', { 'looping@plugins-local': true });
      expect(settings.replaceEnabledPlugins).toHaveBeenCalledWith('project', { 'stock@plugins-local': true });
      expect(settings.replaceEnabledPlugins).toHaveBeenCalledWith('local', {});
    });

    it('無 workspace 且 project/local snapshot 為空時不中斷 reinstallAll', async () => {
      settings.readAllEnabledPlugins.mockResolvedValue({
        user: { 'looping@my-marketplace': true },
        project: {},
        local: {},
      });
      settings.replaceEnabledPlugins.mockImplementation(async (scope: string) => {
        if (scope === 'user') return;
        throw new NoWorkspaceError();
      });

      await svc.reinstallAll();

      expect(settings.replaceEnabledPlugins).toHaveBeenCalledWith('user', { 'looping@my-marketplace': true });
      expect(settings.replaceEnabledPlugins).toHaveBeenCalledWith('project', {});
      expect(settings.replaceEnabledPlugins).toHaveBeenCalledWith('local', {});
    });

    it('re-add 失敗的 marketplace 不會還原舊 enabledPlugins', async () => {
      settings.readAllEnabledPlugins.mockResolvedValue({
        user: {
          'looping@my-marketplace': true,
          'stock@local-plugins': true,
        },
        project: {},
        local: {},
      });
      cli.exec.mockImplementation(async (args: string[]) => {
        if (args[0] === 'plugin' && args[1] === 'marketplace' && args[2] === 'add' && args[3] === '/local/path') {
          throw new Error('local add failed');
        }
        return '';
      });

      const result = await svc.reinstallAll();

      expect(result.failed).toEqual(['local-plugins']);
      expect(settings.replaceEnabledPlugins).toHaveBeenCalledWith('user', {
        'looping@my-marketplace': true,
      });
      expect(settings.replaceEnabledPlugins).not.toHaveBeenCalledWith(
        'user',
        expect.objectContaining({ 'stock@local-plugins': true }),
      );
    });

    it('重裝前已安裝的 plugins 會依原 scope 重裝回來', async () => {
      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'looping@my-marketplace': [{
            scope: 'user',
            installPath: '/cache/my-marketplace/looping/hash',
            version: '1.0.0',
            installedAt: '2026-04-08T00:00:00.000Z',
            lastUpdated: '2026-04-08T00:00:00.000Z',
          }],
          'stock@local-plugins': [{
            scope: 'project',
            projectPath: '/Users/test/.claude',
            installPath: '/cache/local-plugins/stock/hash',
            version: '1.0.0',
            installedAt: '2026-04-08T00:00:00.000Z',
            lastUpdated: '2026-04-08T00:00:00.000Z',
          }],
        },
      } satisfies InstalledPluginsFile);

      await svc.reinstallAll();

      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'install', 'looping@my-marketplace', '--scope', 'user', '--json'],
        { timeout: CLI_LONG_TIMEOUT_MS },
      );
      expect(cli.exec).toHaveBeenCalledWith(
        ['plugin', 'install', 'stock@local-plugins', '--scope', 'project', '--json'],
        { timeout: CLI_LONG_TIMEOUT_MS, cwd: '/Users/test/.claude' },
      );
    });
  });

  describe('reinstallAll() command-source 同意流程', () => {
    const entry = (scope: 'user' | 'project' | 'local', projectPath?: string) => ({
      scope,
      installPath: '/cache/x',
      version: '1.0.0',
      installedAt: '2026-04-08T00:00:00.000Z',
      lastUpdated: '2026-04-08T00:00:00.000Z',
      ...(projectPath ? { projectPath } : {}),
    });

    const INSTALLED = {
      version: 2,
      plugins: {
        'plain@my-marketplace': [entry('user')],
        'xcode@my-marketplace': [entry('user')],
        'later@my-marketplace': [entry('user')],
      },
    } satisfies InstalledPluginsFile;

    const ENABLED = {
      user: {
        'plain@my-marketplace': true,
        'xcode@my-marketplace': true,
        'later@my-marketplace': true,
      },
      project: {},
      local: {},
    };

    /** 某 scope 最後一次寫回的 enabledPlugins（最終狀態） */
    function finalWrite(scope: string): Record<string, boolean> | undefined {
      const calls = settings.replaceEnabledPlugins.mock.calls.filter((c) => c[0] === scope);
      return calls[calls.length - 1]?.[1];
    }

    function installCalls(): string[][] {
      return cli.exec.mock.calls
        .map((c) => c[0] as string[])
        .filter((a) => a[0] === 'plugin' && a[1] === 'install');
    }

    /** 對 xcode 的 install 依序回傳指定結果，其餘外掛成功 */
    function xcodeBehaviour(handler: (args: string[]) => Promise<string>): void {
      cli.exec.mockImplementation(async (args: string[]) => {
        if (args[0] === 'plugin' && args[1] === 'install' && args[2] === 'xcode@my-marketplace') {
          return handler(args);
        }
        return '';
      });
    }

    it('同意後以 --accept-command 重裝、結果無失敗無取消，啟用狀態照快照還原', async () => {
      settings.readInstalledPlugins.mockResolvedValue(INSTALLED);
      settings.readAllEnabledPlugins.mockResolvedValue(ENABLED);
      let first = true;
      xcodeBehaviour(async () => {
        if (first) { first = false; throw createRefusedError({ pluginId: 'xcode@my-marketplace' }); }
        return '';
      });

      const result = await svc.reinstallAll();

      expect(result.failed).toEqual([]);
      expect(result.cancelledPlugins).toEqual([]);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0][1]).toBe('install');
      expect(installCalls()).toContainEqual([
        'plugin', 'install', 'xcode@my-marketplace', '--scope', 'user', '--json', '--accept-command', XCODE_SHA,
      ]);
      expect(finalWrite('user')).toEqual(ENABLED.user);
    });

    it('使用者取消 → 不 throw、列入 cancelledPlugins、不算失敗，且寫回的 enabledPlugins 不含該外掛', async () => {
      settings.readInstalledPlugins.mockResolvedValue(INSTALLED);
      settings.readAllEnabledPlugins.mockResolvedValue(ENABLED);
      confirm.mockResolvedValue(false);
      xcodeBehaviour(async () => { throw createRefusedError({ pluginId: 'xcode@my-marketplace' }); });

      const result = await svc.reinstallAll();

      expect(result.cancelledPlugins).toEqual(['xcode@my-marketplace (user)']);
      expect(result.failed).toEqual([]);
      expect(finalWrite('user')).toEqual({
        'plain@my-marketplace': true,
        'later@my-marketplace': true,
      });
    });

    it('取消的外掛不中斷後續外掛：排在後面的外掛仍被重裝', async () => {
      settings.readInstalledPlugins.mockResolvedValue(INSTALLED);
      settings.readAllEnabledPlugins.mockResolvedValue(ENABLED);
      confirm.mockResolvedValue(false);
      xcodeBehaviour(async () => { throw createRefusedError({ pluginId: 'xcode@my-marketplace' }); });

      await svc.reinstallAll();

      const ids = installCalls().map((a) => a[2]);
      expect(ids).toContain('plain@my-marketplace');
      expect(ids).toContain('later@my-marketplace');
    });

    it('一般失敗仍 throw 並列出外掛，且寫回的 enabledPlugins 保留失敗外掛的啟用、只拿掉取消的外掛', async () => {
      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'plain@my-marketplace': [entry('user')],
          'xcode@my-marketplace': [entry('user')],
          'broken@my-marketplace': [entry('user')],
        },
      } satisfies InstalledPluginsFile);
      settings.readAllEnabledPlugins.mockResolvedValue({
        user: {
          'plain@my-marketplace': true,
          'xcode@my-marketplace': true,
          'broken@my-marketplace': true,
        },
        project: {},
        local: {},
      });
      confirm.mockResolvedValue(false);
      cli.exec.mockImplementation(async (args: string[]) => {
        if (args[1] === 'install' && args[2] === 'xcode@my-marketplace') {
          throw createRefusedError({ pluginId: 'xcode@my-marketplace' });
        }
        if (args[1] === 'install' && args[2] === 'broken@my-marketplace') {
          throw createNotFoundError();
        }
        return '';
      });

      await expect(svc.reinstallAll()).rejects.toThrow(/broken@my-marketplace \(user\)/);

      expect(finalWrite('user')).toEqual({
        'plain@my-marketplace': true,
        'broken@my-marketplace': true,
      });
    });

    it('只有重裝失敗（無取消）→ 仍 throw，寫回的 enabledPlugins 照原快照保留失敗外掛', async () => {
      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: { 'broken@my-marketplace': [entry('user')] },
      } satisfies InstalledPluginsFile);
      settings.readAllEnabledPlugins.mockResolvedValue({
        user: { 'broken@my-marketplace': true },
        project: {},
        local: {},
      });
      cli.exec.mockImplementation(async (args: string[]) => {
        if (args[1] === 'install') throw createNotFoundError();
        return '';
      });

      await expect(svc.reinstallAll()).rejects.toThrow(/broken@my-marketplace \(user\)/);

      expect(finalWrite('user')).toEqual({ 'broken@my-marketplace': true });
    });

    it('失敗與取消並存 → throw 的訊息同時含失敗原因與被取消的 "<pluginId> (<scope>)"', async () => {
      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'xcode@my-marketplace': [entry('user')],
          'broken@my-marketplace': [entry('user')],
        },
      } satisfies InstalledPluginsFile);
      confirm.mockResolvedValue(false);
      cli.exec.mockImplementation(async (args: string[]) => {
        if (args[1] === 'install' && args[2] === 'xcode@my-marketplace') {
          throw createRefusedError({ pluginId: 'xcode@my-marketplace' });
        }
        if (args[1] === 'install' && args[2] === 'broken@my-marketplace') {
          throw createNotFoundError();
        }
        return '';
      });

      const error = await svc.reinstallAll().then(
        () => { throw new Error('expected reinstallAll to throw'); },
        (e: unknown) => e as Error,
      );

      expect(error.message).toContain('broken@my-marketplace (user)');
      expect(error.message).toContain('Plugin not found');
      expect(error.message).toContain('xcode@my-marketplace (user)');
    });

    it('同一外掛多筆安裝：第一筆被取消後其餘筆不再詢問也不呼叫 install，全部列入 cancelledPlugins', async () => {
      settings.readInstalledPlugins.mockResolvedValue({
        version: 2,
        plugins: {
          'xcode@my-marketplace': [entry('user'), entry('project', '/proj'), entry('local', '/proj')],
        },
      } satisfies InstalledPluginsFile);
      confirm.mockResolvedValue(false);
      xcodeBehaviour(async () => { throw createRefusedError({ pluginId: 'xcode@my-marketplace' }); });

      const result = await svc.reinstallAll();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(installCalls().filter((a) => a[2] === 'xcode@my-marketplace')).toHaveLength(1);
      expect(result.cancelledPlugins).toEqual([
        'xcode@my-marketplace (user)',
        'xcode@my-marketplace (project)',
        'xcode@my-marketplace (local)',
      ]);
    });

    describe('取消只影響目前工作區的 project／local 啟用設定', () => {
      const ID = 'xcode@my-marketplace';

      function cancelAll(): void {
        confirm.mockResolvedValue(false);
        xcodeBehaviour(async () => { throw createRefusedError({ pluginId: ID }); });
      }

      it.each(['project', 'local'] as const)(
        '%s scope 的安裝紀錄 projectPath 不是目前工作區 → 被取消不拿掉目前工作區已啟用的同名外掛',
        async (scope) => {
          workspace.workspaceFolders = [{ uri: { fsPath: '/ws' } }] as any;
          settings.readInstalledPlugins.mockResolvedValue({
            version: 2,
            plugins: { [ID]: [entry(scope, '/other')] },
          } satisfies InstalledPluginsFile);
          settings.readAllEnabledPlugins.mockResolvedValue({
            user: {},
            project: { [ID]: true },
            local: { [ID]: true },
          });
          cancelAll();

          const result = await svc.reinstallAll();

          expect(result.cancelledPlugins).toEqual([`${ID} (${scope})`]);
          expect(finalWrite('project')).toEqual({ [ID]: true });
          expect(finalWrite('local')).toEqual({ [ID]: true });
        },
      );

      it.each(['project', 'local'] as const)(
        '%s scope 的安裝紀錄 projectPath 等於目前工作區 → 被取消時拿掉該 scope 的同名外掛、另一 scope 不動',
        async (scope) => {
          workspace.workspaceFolders = [{ uri: { fsPath: '/ws' } }] as any;
          settings.readInstalledPlugins.mockResolvedValue({
            version: 2,
            plugins: { [ID]: [entry(scope, '/ws')] },
          } satisfies InstalledPluginsFile);
          settings.readAllEnabledPlugins.mockResolvedValue({
            user: {},
            project: { [ID]: true },
            local: { [ID]: true },
          });
          cancelAll();

          await svc.reinstallAll();

          const other = scope === 'project' ? 'local' : 'project';
          expect(finalWrite(scope)).toEqual({});
          expect(finalWrite(other)).toEqual({ [ID]: true });
        },
      );

      it('user scope 被取消一律拿掉 user 的同名外掛（不受工作區影響）', async () => {
        workspace.workspaceFolders = [{ uri: { fsPath: '/ws' } }] as any;
        settings.readInstalledPlugins.mockResolvedValue({
          version: 2,
          plugins: { [ID]: [entry('user')] },
        } satisfies InstalledPluginsFile);
        settings.readAllEnabledPlugins.mockResolvedValue({
          user: { [ID]: true },
          project: { [ID]: true },
          local: {},
        });
        cancelAll();

        await svc.reinstallAll();

        expect(finalWrite('user')).toEqual({});
        expect(finalWrite('project')).toEqual({ [ID]: true });
      });

      it('同外掛 user 與他專案 project 兩筆被取消 → 只拿掉 user，目前工作區的 project 啟用保留', async () => {
        workspace.workspaceFolders = [{ uri: { fsPath: '/ws' } }] as any;
        settings.readInstalledPlugins.mockResolvedValue({
          version: 2,
          plugins: { [ID]: [entry('user'), entry('project', '/other')] },
        } satisfies InstalledPluginsFile);
        settings.readAllEnabledPlugins.mockResolvedValue({
          user: { [ID]: true },
          project: { [ID]: true },
          local: {},
        });
        cancelAll();

        const result = await svc.reinstallAll();

        expect(result.cancelledPlugins).toEqual([`${ID} (user)`, `${ID} (project)`]);
        expect(finalWrite('user')).toEqual({});
        expect(finalWrite('project')).toEqual({ [ID]: true });
      });

      it('沒有開啟工作區時，project 安裝紀錄被取消不拿掉任何 project 啟用設定', async () => {
        settings.readInstalledPlugins.mockResolvedValue({
          version: 2,
          plugins: { [ID]: [entry('project', '/other')] },
        } satisfies InstalledPluginsFile);
        settings.readAllEnabledPlugins.mockResolvedValue({
          user: {},
          project: { [ID]: true },
          local: {},
        });
        cancelAll();

        await svc.reinstallAll();

        expect(finalWrite('project')).toEqual({ [ID]: true });
      });
    });

    it('一般外掛：confirm 從未被呼叫、cancelledPlugins 為空、所有 install 參數含 --json 且無 -y / --yes', async () => {
      settings.readInstalledPlugins.mockResolvedValue(INSTALLED);
      settings.readAllEnabledPlugins.mockResolvedValue(ENABLED);

      const result = await svc.reinstallAll();

      expect(result.cancelledPlugins).toEqual([]);
      expect(confirm).not.toHaveBeenCalled();
      const installs = installCalls();
      expect(installs).toHaveLength(3);
      for (const args of installs) {
        expect(args).toContain('--json');
        expect(args).not.toContain('-y');
        expect(args).not.toContain('--yes');
      }
    });

    it('被拒 + 同意流程中也不出現 -y / --yes', async () => {
      settings.readInstalledPlugins.mockResolvedValue(INSTALLED);
      settings.readAllEnabledPlugins.mockResolvedValue(ENABLED);
      let first = true;
      xcodeBehaviour(async () => {
        if (first) { first = false; throw createRefusedError({ pluginId: 'xcode@my-marketplace' }); }
        return '';
      });

      await svc.reinstallAll();

      const args = cli.exec.mock.calls.flatMap((c) => c[0] as string[]);
      expect(args).not.toContain('-y');
      expect(args).not.toContain('--yes');
    });
  });

  describe('preview()', () => {
    const MANIFEST = JSON.stringify({
      name: 'test-marketplace',
      description: 'A test marketplace',
      plugins: [
        { name: 'plugin-a', description: 'Plugin A', version: '1.0.0', source: './plugins/a' },
        { name: 'plugin-b', description: 'Plugin B', source: './plugins/b' },
      ],
    });

    const PLUGIN_JSON_A = JSON.stringify({ description: 'Plugin A from json', version: '2.0.0' });

    it('local path → 直接讀取 manifest 和 plugin.json', async () => {
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) return MANIFEST;
        if (typeof filePath === 'string' && filePath.includes('plugins/a') && filePath.includes('plugin.json')) return PLUGIN_JSON_A;
        if (typeof filePath === 'string' && filePath.includes('plugin.json')) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        return JSON.stringify(MOCK_CONFIG);
      });
      mockAccess.mockResolvedValue(undefined);

      const result = await svc.preview('/local/marketplace');

      expect(result).toEqual([
        { name: 'plugin-a', description: 'Plugin A from json', version: '2.0.0' },
        { name: 'plugin-b', description: 'Plugin B', version: undefined },
      ]);
    });

    it('~/ local path → 展開後直接讀取，不走 git clone', async () => {
      const os = await import('os');
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) return MANIFEST;
        if (typeof filePath === 'string' && filePath.includes('plugins/a') && filePath.includes('plugin.json')) return PLUGIN_JSON_A;
        if (typeof filePath === 'string' && filePath.includes('plugin.json')) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        return JSON.stringify(MOCK_CONFIG);
      });
      mockAccess.mockResolvedValue(undefined);

      await svc.preview('~/marketplaces/local');

      expect(mockAccess).toHaveBeenCalledWith(`${os.homedir()}/marketplaces/local`);
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('git URL → shallow clone + 讀取 manifest + cleanup', async () => {
      const tempDir = '/tmp/mp-preview-123';
      mockMkdtemp.mockResolvedValue(tempDir);
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: (err: null, stdout: string) => void) => {
          cb(null, '');
        },
      );
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) return MANIFEST;
        if (typeof filePath === 'string' && filePath.includes('plugin.json')) return PLUGIN_JSON_A;
        return JSON.stringify(MOCK_CONFIG);
      });
      mockRm.mockResolvedValue(undefined);

      const result = await svc.preview('https://github.com/owner/repo.git');

      // shallow clone 呼叫（含 -- 防 flag injection）
      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', '--', 'https://github.com/owner/repo.git', tempDir],
        expect.objectContaining({ timeout: expect.any(Number) }),
        expect.any(Function),
      );

      // 結果正確
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('plugin-a');

      // temp dir 被清理
      expect(mockRm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true });
    });

    it('github owner/repo → 轉為 git URL 後 clone', async () => {
      const tempDir = '/tmp/mp-preview-456';
      mockMkdtemp.mockResolvedValue(tempDir);
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: (err: null, stdout: string) => void) => {
          cb(null, '');
        },
      );
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) return MANIFEST;
        if (typeof filePath === 'string' && filePath.includes('plugin.json')) return PLUGIN_JSON_A;
        return JSON.stringify(MOCK_CONFIG);
      });
      mockRm.mockResolvedValue(undefined);

      await svc.preview('owner/repo');

      expect(mockExecFile).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', '--', 'https://github.com/owner/repo.git', tempDir],
        expect.objectContaining({ timeout: expect.any(Number) }),
        expect.any(Function),
      );
    });

    it('manifest 不存在 → 拋 ENOENT', async () => {
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        }
        return JSON.stringify(MOCK_CONFIG);
      });
      mockAccess.mockResolvedValue(undefined);

      await expect(svc.preview('/nonexistent/path'))
        .rejects.toThrow('ENOENT');
    });

    it('path traversal source → plugin.json 不被讀取，fallback manifest', async () => {
      const TRAVERSAL_MANIFEST = JSON.stringify({
        name: 'evil-marketplace',
        plugins: [
          { name: 'evil-plugin', description: 'Evil', source: '../../../etc' },
          { name: 'good-plugin', description: 'Good', source: './plugins/good' },
        ],
      });
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) return TRAVERSAL_MANIFEST;
        if (typeof filePath === 'string' && filePath.includes('plugins/good') && filePath.includes('plugin.json')) {
          return JSON.stringify({ description: 'Good from json', version: '1.0.0' });
        }
        if (typeof filePath === 'string' && filePath.includes('plugin.json')) {
          // 不該被呼叫（traversal 路徑應被擋掉）
          return JSON.stringify({ description: 'SHOULD NOT APPEAR', version: '9.9.9' });
        }
        return JSON.stringify(MOCK_CONFIG);
      });
      mockAccess.mockResolvedValue(undefined);

      const result = await svc.preview('/safe/marketplace');

      // evil-plugin 使用 manifest fallback（path traversal 被阻擋）
      expect(result[0]).toEqual({ name: 'evil-plugin', description: 'Evil', version: undefined });
      // good-plugin 正常讀取 plugin.json
      expect(result[1]).toEqual({ name: 'good-plugin', description: 'Good from json', version: '1.0.0' });
    });

    it('plugin.json symlink 逃出 preview root → 不讀取外部 metadata，fallback manifest', async () => {
      const SYMLINK_MANIFEST = JSON.stringify({
        name: 'symlink-marketplace',
        plugins: [
          { name: 'linked-plugin', description: 'Manifest description', version: '1.0.0', source: './plugins/link' },
        ],
      });
      const pluginJsonPath = '/safe/marketplace/plugins/link/.claude-plugin/plugin.json';
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (typeof filePath === 'string' && filePath.includes('marketplace.json')) return SYMLINK_MANIFEST;
        if (filePath === pluginJsonPath) {
          return JSON.stringify({ description: 'SHOULD NOT APPEAR', version: '9.9.9' });
        }
        return JSON.stringify(MOCK_CONFIG);
      });
      mockRealpath.mockImplementation(async (filePath: string) => {
        if (filePath === pluginJsonPath) return '/outside/plugin.json';
        return filePath;
      });
      mockAccess.mockResolvedValue(undefined);

      const result = await svc.preview('/safe/marketplace');

      expect(result).toEqual([
        { name: 'linked-plugin', description: 'Manifest description', version: '1.0.0' },
      ]);
      expect(mockReadFile).not.toHaveBeenCalledWith(pluginJsonPath, 'utf-8');
    });

    it('git clone 失敗 → 拋錯 + cleanup', async () => {
      const tempDir = '/tmp/mp-preview-789';
      mockMkdtemp.mockResolvedValue(tempDir);
      mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error) => void) => {
          cb(new Error('fatal: repository not found'));
        },
      );
      mockRm.mockResolvedValue(undefined);

      await expect(svc.preview('https://invalid.com/repo.git'))
        .rejects.toThrow('fatal: repository not found');

      // temp dir 仍然被清理
      expect(mockRm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true });
    });
  });

});
