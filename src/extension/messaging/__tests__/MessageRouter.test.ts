import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRouter } from '../MessageRouter';
import type { MarketplaceService } from '../../services/MarketplaceService';
import type { PluginService } from '../../services/PluginService';
import type { McpService } from '../../services/McpService';
import type { TranslationService } from '../../services/TranslationService';
import type { SettingsFileService } from '../../services/SettingsFileService';
import type { HookExplanationService } from '../../services/HookExplanationService';
import type { SkillService } from '../../services/SkillService';
import type { RequestMessage, ResponseMessage } from '../protocol';

function createMockServices() {
  return {
    marketplace: {
      list: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
    plugin: {
      listInstalled: vi.fn().mockResolvedValue([]),
      listAvailable: vi.fn().mockResolvedValue({ installed: [], available: [] }),
      install: vi.fn().mockResolvedValue(undefined),
      uninstall: vi.fn().mockResolvedValue(undefined),
      enable: vi.fn().mockResolvedValue(undefined),
      disable: vi.fn().mockResolvedValue(undefined),
      disableAll: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
    mcp: {
      list: vi.fn().mockResolvedValue([]),
      listFromFiles: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      getDetail: vi.fn().mockResolvedValue('detail'),
      resetProjectChoices: vi.fn().mockResolvedValue(undefined),
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      getCachedStatus: vi.fn().mockReturnValue([]),
      onStatusChange: vi.fn(),
    },
    translation: {
      translate: vi.fn().mockResolvedValue([]),
      invalidateCache: vi.fn(),
    },
    settings: {
      readPreferences: vi.fn().mockResolvedValue({}),
      writePreference: vi.fn().mockResolvedValue(undefined),
    },
    hookExplanation: {
      explain: vi.fn().mockResolvedValue({ explanation: 'test explanation', fromCache: false }),
      cleanExpired: vi.fn().mockResolvedValue(undefined),
      invalidateCache: vi.fn(),
    },
    extensionInfo: {
      getInfo: vi.fn().mockResolvedValue({ extensionVersion: '0.1.2', cliPath: '/usr/local/bin/claude', cliVersion: '1.0.0' }),
    },
    skill: {
      list: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      find: vi.fn().mockResolvedValue([]),
      check: vi.fn().mockResolvedValue('No skills tracked'),
      update: vi.fn().mockResolvedValue(undefined),
      getDetail: vi.fn().mockResolvedValue({ frontmatter: {}, body: '' }),
      fetchRegistry: vi.fn().mockResolvedValue([]),
    },
  };
}

describe('MessageRouter', () => {
  let services: ReturnType<typeof createMockServices>;
  let router: MessageRouter;
  let posted: ResponseMessage[];

  beforeEach(() => {
    services = createMockServices();
    router = new MessageRouter(
      services.marketplace as unknown as MarketplaceService,
      services.plugin as unknown as PluginService,
      services.mcp as unknown as McpService,
      services.translation as unknown as TranslationService,
      services.settings as unknown as SettingsFileService,
      services.hookExplanation as unknown as HookExplanationService,
      services.extensionInfo as never,
      '/tmp/test-cache',
      services.skill as unknown as SkillService,
    );
    posted = [];
  });

  const post = (msg: ResponseMessage): void => { posted.push(msg); };

  describe('marketplace 路由', () => {
    it('marketplace.list → 呼叫 service 並回傳 response', async () => {
      const mockData = [{ name: 'test' }];
      services.marketplace.list.mockResolvedValue(mockData);

      await router.handle(
        { type: 'marketplace.list', requestId: 'r1' } as RequestMessage,
        post,
      );

      expect(services.marketplace.list).toHaveBeenCalled();
      expect(posted).toEqual([{ type: 'response', requestId: 'r1', data: mockData }]);
    });

    it('marketplace.add → 帶 source 參數', async () => {
      await router.handle(
        { type: 'marketplace.add', requestId: 'r2', source: 'owner/repo' } as RequestMessage,
        post,
      );
      expect(services.marketplace.add).toHaveBeenCalledWith('owner/repo');
    });
  });

  describe('plugin 路由', () => {
    it('plugin.install → 帶正確參數', async () => {
      await router.handle(
        { type: 'plugin.install', requestId: 'r3', plugin: 'my-plugin', scope: 'user' } as RequestMessage,
        post,
      );
      expect(services.plugin.install).toHaveBeenCalledWith('my-plugin', 'user');
      expect(posted[0]).toMatchObject({ type: 'response', requestId: 'r3' });
    });

    it('plugin.disableAll → 呼叫 service', async () => {
      await router.handle(
        { type: 'plugin.disableAll', requestId: 'r4' } as RequestMessage,
        post,
      );
      expect(services.plugin.disableAll).toHaveBeenCalled();
    });
  });

  describe('mcp 路由', () => {
    it('mcp.list → 呼叫 listFromFiles（即時）', async () => {
      const mockServers = [{ name: 'test', status: 'pending' }];
      services.mcp.listFromFiles.mockResolvedValue(mockServers);
      await router.handle(
        { type: 'mcp.list', requestId: 'r-list' } as RequestMessage,
        post,
      );
      expect(services.mcp.listFromFiles).toHaveBeenCalled();
      expect(services.mcp.list).not.toHaveBeenCalled();
      expect(posted[0]).toMatchObject({ type: 'response', data: mockServers });
    });

    it('mcp.add → 帶 params', async () => {
      const params = { name: 'test', commandOrUrl: 'npx test', scope: 'local' as const };
      await router.handle(
        { type: 'mcp.add', requestId: 'r5', params } as RequestMessage,
        post,
      );
      expect(services.mcp.add).toHaveBeenCalledWith(params);
    });

    it('mcp.remove → 帶 name 和 scope', async () => {
      await router.handle(
        { type: 'mcp.remove', requestId: 'r6', name: 'my-server', scope: 'user' } as RequestMessage,
        post,
      );
      expect(services.mcp.remove).toHaveBeenCalledWith('my-server', 'user');
    });
  });

  describe('錯誤處理', () => {
    it('service throw → 回傳 error response', async () => {
      services.marketplace.list.mockRejectedValue(new Error('CLI failed'));

      await router.handle(
        { type: 'marketplace.list', requestId: 'r7' } as RequestMessage,
        post,
      );

      expect(posted).toEqual([
        { type: 'error', requestId: 'r7', error: 'CLI failed' },
      ]);
    });
  });

  describe('utility 路由', () => {
    it('openExternal → 呼叫 vscode.env.openExternal 並回傳 response', async () => {
      const vscode = await import('vscode');
      await router.handle(
        { type: 'openExternal', requestId: 'r-ext', url: 'https://github.com/example/repo' } as RequestMessage,
        post,
      );
      expect(vscode.env.openExternal).toHaveBeenCalled();
      expect(posted[0]).toMatchObject({ type: 'response', requestId: 'r-ext' });
    });
  });

  describe('特殊訊息', () => {
    it('sidebar.openCategory → 不回傳 response', async () => {
      await router.handle(
        { type: 'sidebar.openCategory', category: 'mcp' } as RequestMessage,
        post,
      );
      expect(posted).toEqual([]);
    });
  });

  describe('hooks 路由', () => {
    it('hooks.explain → 呼叫 hookExplanation.explain 並回傳結果', async () => {
      const mockResult = { explanation: '這個 hook 執行安全檢查。', fromCache: false };
      services.hookExplanation.explain.mockResolvedValue(mockResult);

      await router.handle(
        { type: 'hooks.explain', requestId: 'he1', hookContent: '/guard.sh', eventType: 'PreToolUse', locale: 'zh-TW' } as RequestMessage,
        post,
      );

      expect(services.hookExplanation.explain).toHaveBeenCalledWith('/guard.sh', 'PreToolUse', 'zh-TW', undefined, undefined);
      expect(posted).toEqual([{ type: 'response', requestId: 'he1', data: mockResult }]);
    });

    it('hooks.cleanExpiredExplanations → 呼叫 cleanExpired 並回傳 response', async () => {
      await router.handle(
        { type: 'hooks.cleanExpiredExplanations', requestId: 'he2' } as RequestMessage,
        post,
      );

      // fire-and-forget: response 仍回傳，但不等待 cleanExpired 完成
      expect(posted[0]).toMatchObject({ type: 'response', requestId: 'he2' });
    });
  });

  describe('extension 路由', () => {
    it('extension.getInfo → 呼叫 extensionInfo.getInfo 並回傳結果', async () => {
      const mockInfo = { extensionVersion: '0.1.2', cliPath: '/usr/local/bin/claude', cliVersion: '1.0.0' };
      services.extensionInfo.getInfo.mockResolvedValue(mockInfo);

      await router.handle(
        { type: 'extension.getInfo', requestId: 'ei1' } as RequestMessage,
        post,
      );

      expect(services.extensionInfo.getInfo).toHaveBeenCalled();
      expect(posted).toEqual([{ type: 'response', requestId: 'ei1', data: mockInfo }]);
    });

    it('extension.revealPath → 展開 ~/ 後呼叫 revealFileInOS command', async () => {
      const vscode = await import('vscode');
      const os = await import('os');
      const home = os.homedir();

      await router.handle(
        { type: 'extension.revealPath', requestId: 'rp1', path: '~/.claude/plugins' } as RequestMessage,
        post,
      );

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'revealFileInOS',
        expect.objectContaining({ fsPath: home + '/.claude/plugins' }),
      );
      expect(posted[0]).toMatchObject({ type: 'response', requestId: 'rp1' });
    });

    it('extension.revealPath → 路徑不存在時回傳 error', async () => {
      await router.handle(
        { type: 'extension.revealPath', requestId: 'rp2', path: '/nonexistent/path/that/does/not/exist' } as RequestMessage,
        post,
      );

      expect(posted[0]).toMatchObject({ type: 'error', requestId: 'rp2' });
      expect((posted[0] as { error: string }).error).toContain('Path does not exist');
    });

    it('extension.clearCache → 回傳 { cleared: true }', async () => {
      await router.handle(
        { type: 'extension.clearCache', requestId: 'cc1' } as RequestMessage,
        post,
      );

      expect(posted[0]).toMatchObject({ type: 'response', requestId: 'cc1', data: { cleared: true } });
    });
  });

  describe('skill 路由', () => {
    it('skill.list → 帶 scope 參數', async () => {
      await router.handle(
        { type: 'skill.list', requestId: 's1', scope: 'global' } as RequestMessage,
        post,
      );
      expect(services.skill.list).toHaveBeenCalledWith('global');
      expect(posted[0]).toMatchObject({ type: 'response', requestId: 's1' });
    });

    it('skill.add → 帶 source 和 scope', async () => {
      await router.handle(
        { type: 'skill.add', requestId: 's2', source: 'owner/repo', scope: 'global' } as RequestMessage,
        post,
      );
      expect(services.skill.add).toHaveBeenCalledWith('owner/repo', 'global');
    });

    it('skill.remove → 帶 name 和 scope', async () => {
      await router.handle(
        { type: 'skill.remove', requestId: 's3', name: 'my-skill', scope: 'project' } as RequestMessage,
        post,
      );
      expect(services.skill.remove).toHaveBeenCalledWith('my-skill', 'project');
    });

    it('skill.find → 帶 query', async () => {
      await router.handle(
        { type: 'skill.find', requestId: 's4', query: 'browser' } as RequestMessage,
        post,
      );
      expect(services.skill.find).toHaveBeenCalledWith('browser');
    });

    it('skill.check → 呼叫 check()', async () => {
      await router.handle(
        { type: 'skill.check', requestId: 's5' } as RequestMessage,
        post,
      );
      expect(services.skill.check).toHaveBeenCalled();
    });

    it('skill.update → 呼叫 update()', async () => {
      await router.handle(
        { type: 'skill.update', requestId: 's6' } as RequestMessage,
        post,
      );
      expect(services.skill.update).toHaveBeenCalled();
    });

    it('skill.getDetail → 帶 path', async () => {
      await router.handle(
        { type: 'skill.getDetail', requestId: 's7', path: '/path/to/skill' } as RequestMessage,
        post,
      );
      expect(services.skill.getDetail).toHaveBeenCalledWith('/path/to/skill');
    });

    it('skill.registry → 帶 sort 和 query', async () => {
      await router.handle(
        { type: 'skill.registry', requestId: 's8', sort: 'trending', query: 'test' } as RequestMessage,
        post,
      );
      expect(services.skill.fetchRegistry).toHaveBeenCalledWith('trending', 'test');
    });

    it('skill.openFile → 呼叫 vscode.open', async () => {
      const vscode = await import('vscode');
      await router.handle(
        { type: 'skill.openFile', requestId: 's9', path: '/path/to/SKILL.md' } as RequestMessage,
        post,
      );
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.open',
        expect.objectContaining({ fsPath: '/path/to/SKILL.md' }),
      );
    });
  });

  describe('preferences 路由', () => {
    it('preferences.read → 回傳所有偏好設定', async () => {
      const mockPrefs = { 'plugin.sort': 'lastUpdated', 'plugin.filter.enabled': true };
      services.settings.readPreferences.mockResolvedValue(mockPrefs);

      await router.handle(
        { type: 'preferences.read', requestId: 'pr1' } as RequestMessage,
        post,
      );

      expect(services.settings.readPreferences).toHaveBeenCalled();
      expect(posted).toEqual([{ type: 'response', requestId: 'pr1', data: mockPrefs }]);
    });

    it('preferences.read → 無偏好設定時回傳空物件', async () => {
      services.settings.readPreferences.mockResolvedValue({});

      await router.handle(
        { type: 'preferences.read', requestId: 'pr2' } as RequestMessage,
        post,
      );

      expect(posted).toEqual([{ type: 'response', requestId: 'pr2', data: {} }]);
    });

    it('preferences.write → 寫入偏好設定並回傳 response', async () => {
      await router.handle(
        { type: 'preferences.write', requestId: 'pw1', key: 'plugin.sort', value: 'lastUpdated' } as RequestMessage,
        post,
      );

      expect(services.settings.writePreference).toHaveBeenCalledWith('plugin.sort', 'lastUpdated');
      expect(posted).toEqual([{ type: 'response', requestId: 'pw1', data: undefined }]);
    });
  });
});
