import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRouter } from '../MessageRouter';
import type { MarketplaceService } from '../../services/MarketplaceService';
import type { PluginService } from '../../services/PluginService';
import type { McpService } from '../../services/McpService';
import type { RequestMessage, ResponseMessage } from '../protocol';

function createMockServices(): {
  marketplace: { [K in keyof MarketplaceService]: ReturnType<typeof vi.fn> };
  plugin: { [K in keyof PluginService]: ReturnType<typeof vi.fn> };
  mcp: { [K in keyof McpService]: ReturnType<typeof vi.fn> };
} {
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
      onStatusChange: { event: vi.fn(), fire: vi.fn(), dispose: vi.fn() },
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

  describe('特殊訊息', () => {
    it('sidebar.openCategory → 不回傳 response', async () => {
      await router.handle(
        { type: 'sidebar.openCategory', category: 'mcp' } as RequestMessage,
        post,
      );
      expect(posted).toEqual([]);
    });
  });
});
