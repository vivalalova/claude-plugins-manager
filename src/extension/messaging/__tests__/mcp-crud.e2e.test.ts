/**
 * MCP add → list → remove E2E 測試。
 * MessageRouter → McpService.listFromFiles() → 真實 filesystem。
 *
 * 策略：
 * - mcp.list 走真實路徑（MessageRouter → McpService.listFromFiles() → SettingsFileService / 直讀 .claude.json）
 * - mcp.add / mcp.remove 的 CLI 呼叫由 mock cli.exec 模擬，並手動把設定寫入 tmpdir
 * - 用真實 McpService + 真實 filesystem 驗證讀取路徑的正確性
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { workspace } from 'vscode';

/* ── tmpdir + mock os.homedir ── */
const { SUITE_TMP, SUITE_HOME } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-mcp-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { MessageRouter } from '../MessageRouter';
import { McpService } from '../../services/McpService';
import { SettingsFileService } from '../../services/SettingsFileService';
import type { CliService } from '../../services/CliService';
import type { MarketplaceService } from '../../services/MarketplaceService';
import type { PluginService } from '../../services/PluginService';
import type { TranslationService } from '../../services/TranslationService';
import type { HookExplanationService } from '../../services/HookExplanationService';
import type { ExtensionInfoService } from '../../services/ExtensionInfoService';
import type { SkillService } from '../../services/SkillService';
import type { McpServer } from '../../../shared/types';
import type { RequestMessage, ResponseMessage } from '../protocol';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

/** 發送 message 到 MessageRouter，收集 response */
async function send(
  router: MessageRouter,
  message: Omit<RequestMessage, 'requestId'>,
): Promise<ResponseMessage> {
  const requestId = String(Date.now() + Math.random());
  let captured: ResponseMessage | undefined;
  await router.handle(
    { ...message, requestId } as RequestMessage,
    (msg) => { captured = msg; },
  );
  return captured!;
}

/** 取得 response data，型別轉換輔助 */
function getData<T>(res: ResponseMessage): T {
  expect(res.type).toBe('response');
  return (res as { type: 'response'; requestId: string; data: T }).data;
}

/** 空殼 stub services（MCP CRUD 測試不需要這些） */
function createStubServices() {
  return {
    marketplace: { list: vi.fn() } as unknown as MarketplaceService,
    plugin: { listInstalled: vi.fn() } as unknown as PluginService,
    translation: { translate: vi.fn() } as unknown as TranslationService,
    hookExplanation: { explain: vi.fn() } as unknown as HookExplanationService,
    extensionInfo: { getInfo: vi.fn() } as unknown as ExtensionInfoService,
    skill: { list: vi.fn() } as unknown as SkillService,
  };
}

/** 讀取 ~/.claude.json，不存在時回傳空物件 */
async function readClaudeJson(homeDir: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(join(homeDir, '.claude.json'), 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 寫入 ~/.claude.json */
async function writeClaudeJson(homeDir: string, content: Record<string, unknown>): Promise<void> {
  await writeFile(join(homeDir, '.claude.json'), JSON.stringify(content, null, 2) + '\n');
}

/** 在 ~/.claude.json 的 mcpServers 加入 server（模擬 CLI user scope add） */
async function addUserMcpServer(
  homeDir: string,
  name: string,
  config: { command?: string; url?: string; args?: string[]; env?: Record<string, string>; transport?: string },
): Promise<void> {
  const data = await readClaudeJson(homeDir);
  const mcpServers = (data.mcpServers as Record<string, unknown> | undefined) ?? {};
  mcpServers[name] = config;
  data.mcpServers = mcpServers;
  await writeClaudeJson(homeDir, data);
}

/** 從 ~/.claude.json 的 mcpServers 移除 server（模擬 CLI user scope remove） */
async function removeUserMcpServer(homeDir: string, name: string): Promise<void> {
  const data = await readClaudeJson(homeDir);
  const mcpServers = (data.mcpServers as Record<string, unknown> | undefined) ?? {};
  delete mcpServers[name];
  data.mcpServers = mcpServers;
  await writeClaudeJson(homeDir, data);
}

/** 在 .mcp.json 加入 server（模擬 CLI project scope add） */
async function addProjectMcpServer(
  workspaceDir: string,
  name: string,
  config: { command?: string; url?: string; args?: string[]; env?: Record<string, string> },
): Promise<void> {
  const mcpPath = join(workspaceDir, '.mcp.json');
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(await readFile(mcpPath, 'utf-8')) as Record<string, unknown>;
  } catch { /* 不存在則從空開始 */ }
  const mcpServers = (data.mcpServers as Record<string, unknown> | undefined) ?? {};
  mcpServers[name] = config;
  data.mcpServers = mcpServers;
  await writeFile(mcpPath, JSON.stringify(data, null, 2) + '\n');
}

/** 從 .mcp.json 移除 server（模擬 CLI project scope remove） */
async function removeProjectMcpServer(workspaceDir: string, name: string): Promise<void> {
  const mcpPath = join(workspaceDir, '.mcp.json');
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(await readFile(mcpPath, 'utf-8')) as Record<string, unknown>;
  } catch { return; }
  const mcpServers = (data.mcpServers as Record<string, unknown> | undefined) ?? {};
  delete mcpServers[name];
  data.mcpServers = mcpServers;
  await writeFile(mcpPath, JSON.stringify(data, null, 2) + '\n');
}

describe('MCP CRUD（E2E：MessageRouter → McpService → Filesystem）', () => {
  let router: MessageRouter;
  let mcpSvc: McpService;
  let mockCli: CliService;
  let workspaceDir: string;
  let testIdx = 0;

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-mcp-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    // 每次測試從乾淨狀態開始（移除 .claude.json 殘留）
    try { rmSync(join(SUITE_HOME, '.claude.json'), { force: true }); } catch { /* 不存在則忽略 */ }

    // 確保 installed_plugins.json 存在（McpService.buildServerMetadata 會讀它）
    await writeFile(
      join(SUITE_HOME, '.claude', 'plugins', 'installed_plugins.json'),
      JSON.stringify({ version: 2, plugins: {} }),
    );

    mockCli = {
      exec: vi.fn().mockResolvedValue(''),
      execJson: vi.fn().mockResolvedValue([]),
    } as unknown as CliService;

    const settingsSvc = new SettingsFileService();
    mcpSvc = new McpService(mockCli, settingsSvc);

    const stubs = createStubServices();
    const cacheDir = join(SUITE_TMP, `cache-mcp-${testIdx}`);
    mkdirSync(cacheDir, { recursive: true });

    router = new MessageRouter(
      stubs.marketplace,
      stubs.plugin,
      mcpSvc,
      stubs.translation,
      settingsSvc,
      stubs.hookExplanation,
      stubs.extensionInfo,
      cacheDir,
      stubs.skill,
    );
  });

  /* ══════════════════════════════════════════════════════
     初始狀態
     ══════════════════════════════════════════════════════ */

  describe('初始狀態', () => {
    it('mcp.list 回傳空陣列（無任何 server）', async () => {
      const res = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(res);
      expect(servers).toEqual([]);
    });

    it('mcp.list 無 .claude.json 不拋錯（優雅降級）', async () => {
      // .claude.json 不存在時應回傳空陣列，非 error
      const res = await send(router, { type: 'mcp.list' });
      expect(res.type).toBe('response');
      expect(getData<McpServer[]>(res)).toHaveLength(0);
    });
  });

  /* ══════════════════════════════════════════════════════
     user scope：stdio server
     ══════════════════════════════════════════════════════ */

  describe('user scope stdio server', () => {
    it('add stdio server → mcp.list 回傳該 server', async () => {
      // 模擬 CLI add 行為：直接寫入設定檔
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await addUserMcpServer(SUITE_HOME, 'my-stdio', {
          command: 'npx',
          args: ['-y', 'my-stdio-server'],
          transport: 'stdio',
        });
        return '';
      });

      const addRes = await send(router, {
        type: 'mcp.add',
        params: {
          name: 'my-stdio',
          commandOrUrl: 'npx',
          args: ['-y', 'my-stdio-server'],
          transport: 'stdio',
          scope: 'user',
        },
      });
      expect(addRes.type).toBe('response');

      const listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('my-stdio');
      expect(servers[0].scope).toBe('user');
      expect(servers[0].config?.command).toBe('npx');
      expect(servers[0].config?.args).toEqual(['-y', 'my-stdio-server']);
    });

    it('add 後 remove → mcp.list 回傳空陣列', async () => {
      // 先寫入 server
      await addUserMcpServer(SUITE_HOME, 'removable-server', {
        command: 'node',
        args: ['server.js'],
      });
      // 確認 server 存在
      mcpSvc.invalidateMetadataCache();
      let listRes = await send(router, { type: 'mcp.list' });
      expect(getData<McpServer[]>(listRes)).toHaveLength(1);

      // 模擬 CLI remove
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await removeUserMcpServer(SUITE_HOME, 'removable-server');
        return '';
      });

      const removeRes = await send(router, {
        type: 'mcp.remove',
        name: 'removable-server',
        scope: 'user',
      });
      expect(removeRes.type).toBe('response');

      listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(0);
    });
  });

  /* ══════════════════════════════════════════════════════
     user scope：http/sse server
     ══════════════════════════════════════════════════════ */

  describe('user scope http server', () => {
    it('add http server → mcp.list 回傳 url 正確的 server', async () => {
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await addUserMcpServer(SUITE_HOME, 'my-http', {
          url: 'https://mcp.example.com/sse',
          transport: 'sse',
        });
        return '';
      });

      await send(router, {
        type: 'mcp.add',
        params: {
          name: 'my-http',
          commandOrUrl: 'https://mcp.example.com/sse',
          transport: 'sse',
          scope: 'user',
        },
      });

      const listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('my-http');
      expect(servers[0].config?.url).toBe('https://mcp.example.com/sse');
      expect(servers[0].config?.transport).toBe('sse');
    });
  });

  /* ══════════════════════════════════════════════════════
     env 環境變數
     ══════════════════════════════════════════════════════ */

  describe('env 環境變數', () => {
    it('add 含 env → mcp.list 回傳 env 正確', async () => {
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await addUserMcpServer(SUITE_HOME, 'env-server', {
          command: 'npx',
          args: ['-y', 'my-server'],
          env: { API_KEY: 'secret-123', REGION: 'us-east-1' },
        });
        return '';
      });

      await send(router, {
        type: 'mcp.add',
        params: {
          name: 'env-server',
          commandOrUrl: 'npx',
          args: ['-y', 'my-server'],
          scope: 'user',
          env: { API_KEY: 'secret-123', REGION: 'us-east-1' },
        },
      });

      const listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      const srv = servers.find((s) => s.name === 'env-server');
      expect(srv).toBeDefined();
      expect(srv!.config?.env).toEqual({ API_KEY: 'secret-123', REGION: 'us-east-1' });
    });

    it('env 值為空字串 → 正確儲存', async () => {
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await addUserMcpServer(SUITE_HOME, 'empty-env-server', {
          command: 'node',
          args: ['server.js'],
          env: { EMPTY_KEY: '' },
        });
        return '';
      });

      await send(router, {
        type: 'mcp.add',
        params: {
          name: 'empty-env-server',
          commandOrUrl: 'node',
          args: ['server.js'],
          scope: 'user',
          env: { EMPTY_KEY: '' },
        },
      });

      const listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      const srv = servers.find((s) => s.name === 'empty-env-server');
      expect(srv!.config?.env?.EMPTY_KEY).toBe('');
    });
  });

  /* ══════════════════════════════════════════════════════
     project scope：.mcp.json
     ══════════════════════════════════════════════════════ */

  describe('project scope', () => {
    it('add project scope server → 寫入 .mcp.json，mcp.list 回傳 project scope', async () => {
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await addProjectMcpServer(workspaceDir, 'proj-server', {
          command: 'npx',
          args: ['-y', 'project-mcp'],
        });
        return '';
      });

      await send(router, {
        type: 'mcp.add',
        params: {
          name: 'proj-server',
          commandOrUrl: 'npx',
          args: ['-y', 'project-mcp'],
          scope: 'project',
        },
      });

      const listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('proj-server');
      expect(servers[0].scope).toBe('project');

      // 驗證 .mcp.json 確實被寫入
      const mcpJson = JSON.parse(await readFile(join(workspaceDir, '.mcp.json'), 'utf-8')) as {
        mcpServers: Record<string, unknown>;
      };
      expect(mcpJson.mcpServers['proj-server']).toBeDefined();
    });

    it('add project scope → remove → mcp.list 回傳空', async () => {
      // 先直接寫入 .mcp.json
      await addProjectMcpServer(workspaceDir, 'temp-proj', {
        command: 'node',
        args: ['temp.js'],
      });
      mcpSvc.invalidateMetadataCache();

      let listRes = await send(router, { type: 'mcp.list' });
      expect(getData<McpServer[]>(listRes)).toHaveLength(1);

      // 模擬 CLI remove
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await removeProjectMcpServer(workspaceDir, 'temp-proj');
        return '';
      });

      await send(router, {
        type: 'mcp.remove',
        name: 'temp-proj',
        scope: 'project',
      });

      listRes = await send(router, { type: 'mcp.list' });
      expect(getData<McpServer[]>(listRes)).toHaveLength(0);
    });
  });

  /* ══════════════════════════════════════════════════════
     scope 隔離：user 與 project 各自獨立
     ══════════════════════════════════════════════════════ */

  describe('scope 隔離', () => {
    it('user + project 各一個 server → mcp.list 回傳兩個，scope 各自正確', async () => {
      await addUserMcpServer(SUITE_HOME, 'user-server', {
        command: 'npx',
        args: ['-y', 'user-mcp'],
      });
      await addProjectMcpServer(workspaceDir, 'project-server', {
        command: 'npx',
        args: ['-y', 'project-mcp'],
      });
      mcpSvc.invalidateMetadataCache();

      const listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(2);

      const userSrv = servers.find((s) => s.name === 'user-server');
      const projSrv = servers.find((s) => s.name === 'project-server');
      expect(userSrv?.scope).toBe('user');
      expect(projSrv?.scope).toBe('project');
    });

    it('remove user server → project server 不受影響', async () => {
      await addUserMcpServer(SUITE_HOME, 'u-server', { command: 'npx', args: ['-y', 'u'] });
      await addProjectMcpServer(workspaceDir, 'p-server', { command: 'npx', args: ['-y', 'p'] });
      mcpSvc.invalidateMetadataCache();

      mockCli.exec = vi.fn().mockImplementation(async () => {
        await removeUserMcpServer(SUITE_HOME, 'u-server');
        return '';
      });

      await send(router, { type: 'mcp.remove', name: 'u-server', scope: 'user' });

      const listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('p-server');
      expect(servers[0].scope).toBe('project');
    });
  });

  /* ══════════════════════════════════════════════════════
     多 server 管理
     ══════════════════════════════════════════════════════ */

  describe('多 server 管理', () => {
    it('依序 add 三個 server → mcp.list 全部回傳', async () => {
      // 直接寫入設定檔（跳過 CLI mock，測試讀取路徑）
      await addUserMcpServer(SUITE_HOME, 'server-a', { command: 'node', args: ['a.js'] });
      await addUserMcpServer(SUITE_HOME, 'server-b', { command: 'node', args: ['b.js'] });
      await addUserMcpServer(SUITE_HOME, 'server-c', { command: 'node', args: ['c.js'] });
      mcpSvc.invalidateMetadataCache();

      const listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(3);
      const names = servers.map((s) => s.name).sort();
      expect(names).toEqual(['server-a', 'server-b', 'server-c']);
    });

    it('移除中間 server → 其他兩個仍存在', async () => {
      await addUserMcpServer(SUITE_HOME, 'alpha', { command: 'node', args: ['alpha.js'] });
      await addUserMcpServer(SUITE_HOME, 'beta', { command: 'node', args: ['beta.js'] });
      await addUserMcpServer(SUITE_HOME, 'gamma', { command: 'node', args: ['gamma.js'] });
      mcpSvc.invalidateMetadataCache();

      mockCli.exec = vi.fn().mockImplementation(async () => {
        await removeUserMcpServer(SUITE_HOME, 'beta');
        return '';
      });
      await send(router, { type: 'mcp.remove', name: 'beta', scope: 'user' });

      const listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(2);
      const names = servers.map((s) => s.name).sort();
      expect(names).toEqual(['alpha', 'gamma']);
    });
  });

  /* ══════════════════════════════════════════════════════
     完整 add → list → remove 流程
     ══════════════════════════════════════════════════════ */

  describe('完整 add → list → remove 流程', () => {
    it('stdio server 完整流程：初始空 → add → list 有值 → remove → list 為空', async () => {
      // 1. 初始狀態確認
      let listRes = await send(router, { type: 'mcp.list' });
      expect(getData<McpServer[]>(listRes)).toHaveLength(0);

      // 2. add
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await addUserMcpServer(SUITE_HOME, 'full-flow-server', {
          command: 'npx',
          args: ['-y', '@scope/mcp-server'],
          env: { TOKEN: 'abc' },
        });
        return '';
      });
      const addRes = await send(router, {
        type: 'mcp.add',
        params: {
          name: 'full-flow-server',
          commandOrUrl: 'npx',
          args: ['-y', '@scope/mcp-server'],
          scope: 'user',
          env: { TOKEN: 'abc' },
        },
      });
      expect(addRes.type).toBe('response');

      // 3. list 確認存在
      listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('full-flow-server');
      expect(servers[0].config?.env?.TOKEN).toBe('abc');
      expect(servers[0].status).toBe('pending');

      // 4. remove
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await removeUserMcpServer(SUITE_HOME, 'full-flow-server');
        return '';
      });
      const removeRes = await send(router, {
        type: 'mcp.remove',
        name: 'full-flow-server',
        scope: 'user',
      });
      expect(removeRes.type).toBe('response');

      // 5. list 確認已移除
      listRes = await send(router, { type: 'mcp.list' });
      expect(getData<McpServer[]>(listRes)).toHaveLength(0);
    });

    it('project scope 完整流程：add → list → remove', async () => {
      // add
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await addProjectMcpServer(workspaceDir, 'proj-flow', {
          url: 'http://localhost:3000/mcp',
        });
        return '';
      });
      await send(router, {
        type: 'mcp.add',
        params: {
          name: 'proj-flow',
          commandOrUrl: 'http://localhost:3000/mcp',
          transport: 'http',
          scope: 'project',
        },
      });

      // list
      let listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('proj-flow');
      expect(servers[0].scope).toBe('project');

      // remove
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await removeProjectMcpServer(workspaceDir, 'proj-flow');
        return '';
      });
      await send(router, { type: 'mcp.remove', name: 'proj-flow', scope: 'project' });

      listRes = await send(router, { type: 'mcp.list' });
      expect(getData<McpServer[]>(listRes)).toHaveLength(0);
    });
  });

  /* ══════════════════════════════════════════════════════
     metadata cache 失效驗證
     ══════════════════════════════════════════════════════ */

  describe('metadata cache 管理', () => {
    it('add 後 cache 自動失效 → 再次 mcp.list 讀取最新設定', async () => {
      // 預先寫入一個 server
      await addUserMcpServer(SUITE_HOME, 'cached-server', { command: 'node', args: ['c.js'] });
      mcpSvc.invalidateMetadataCache();

      // 第一次 list 填充 cache
      let listRes = await send(router, { type: 'mcp.list' });
      expect(getData<McpServer[]>(listRes)).toHaveLength(1);

      // add 第二個（CLI exec 寫入 + McpService.add 呼叫 invalidateMetadataCache）
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await addUserMcpServer(SUITE_HOME, 'new-server', { command: 'node', args: ['n.js'] });
        return '';
      });
      await send(router, {
        type: 'mcp.add',
        params: { name: 'new-server', commandOrUrl: 'node', scope: 'user' },
      });

      // 第二次 list 應看到兩個 server（cache 已被 add 清除）
      listRes = await send(router, { type: 'mcp.list' });
      const servers = getData<McpServer[]>(listRes);
      expect(servers).toHaveLength(2);
    });

    it('remove 後 cache 自動失效 → 再次 mcp.list 不再包含被移除的 server', async () => {
      await addUserMcpServer(SUITE_HOME, 'will-remove', { command: 'node', args: ['wr.js'] });
      mcpSvc.invalidateMetadataCache();

      // 先 list 以填充 cache
      let listRes = await send(router, { type: 'mcp.list' });
      expect(getData<McpServer[]>(listRes)).toHaveLength(1);

      // remove（CLI exec 移除 + McpService.remove 呼叫 invalidateMetadataCache）
      mockCli.exec = vi.fn().mockImplementation(async () => {
        await removeUserMcpServer(SUITE_HOME, 'will-remove');
        return '';
      });
      await send(router, { type: 'mcp.remove', name: 'will-remove' });

      // list 應回傳空（cache 已清除，重新從 disk 讀取）
      listRes = await send(router, { type: 'mcp.list' });
      expect(getData<McpServer[]>(listRes)).toHaveLength(0);
    });
  });
});
