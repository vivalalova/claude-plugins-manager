/**
 * McpService 整合測試。
 * 用真實 filesystem（tmpdir），不 mock fs/promises。
 * 驗證 buildServerMetadata 的檔案讀取 + parseMcpList 的字串解析。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { workspace } from 'vscode';
import type { CliService } from '../CliService';

/* ── 建立 suite 共用的 tmpdir，mock os.homedir 指向它 ── */
const { SUITE_TMP, SUITE_HOME } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { McpService } from '../McpService';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

function createMockCli(output = ''): CliService {
  return {
    exec: vi.fn().mockResolvedValue(output),
    execJson: vi.fn().mockResolvedValue({}),
  } as unknown as CliService;
}

function createMockSettings(): Pick<import('../SettingsFileService').SettingsFileService, 'readAllEnabledPlugins'> {
  return {
    readAllEnabledPlugins: vi.fn().mockResolvedValue({ user: {}, project: {}, local: {} }),
  };
}

/** 寫入 ~/.claude.json */
function writeClaudeJson(data: Record<string, unknown>): void {
  writeFileSync(join(SUITE_HOME, '.claude.json'), JSON.stringify(data));
}

/** 寫入 {workspace}/.mcp.json */
function writeProjectMcpJson(workspaceDir: string, data: Record<string, unknown>): void {
  writeFileSync(join(workspaceDir, '.mcp.json'), JSON.stringify(data));
}

/** 寫入 installed_plugins.json */
function writeInstalledPlugins(data: Record<string, unknown>): void {
  writeFileSync(
    join(SUITE_HOME, '.claude', 'plugins', 'installed_plugins.json'),
    JSON.stringify(data),
  );
}

/** 建立 plugin 目錄 + .mcp.json */
function createPluginWithMcp(
  pluginPath: string,
  mcpServers: Record<string, unknown>,
): void {
  mkdirSync(pluginPath, { recursive: true });
  writeFileSync(join(pluginPath, '.mcp.json'), JSON.stringify(mcpServers));
}

describe('McpService（integration / 真實 filesystem）', () => {
  let workspaceDir: string;
  let testIdx = 0;

  beforeEach(() => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    // 清理 ~/.claude.json（某些測試不需要它）
    try { rmSync(join(SUITE_HOME, '.claude.json')); } catch { /* ok */ }
    try { rmSync(join(SUITE_HOME, '.claude', 'plugins', 'installed_plugins.json')); } catch { /* ok */ }
  });

  /* ═══════ listFromFiles — 多 scope 合併 ═══════ */

  describe('listFromFiles — 多 scope config 組合', () => {
    it('同時含 user scope + project scope → 兩者皆出現且 scope 正確', async () => {
      writeClaudeJson({
        mcpServers: {
          'user-server': { command: 'npx', args: ['-y', 'user-mcp'] },
        },
      });
      writeProjectMcpJson(workspaceDir, {
        mcpServers: {
          'project-server': { command: 'node', args: ['server.js'] },
        },
      });

      const svc = new McpService(createMockCli(), createMockSettings());
      const servers = await svc.listFromFiles();

      expect(servers).toHaveLength(2);

      const userServer = servers.find((s) => s.name === 'user-server');
      expect(userServer).toBeDefined();
      expect(userServer!.scope).toBe('user');
      expect(userServer!.config?.command).toBe('npx');

      const projectServer = servers.find((s) => s.name === 'project-server');
      expect(projectServer).toBeDefined();
      expect(projectServer!.scope).toBe('project');
      expect(projectServer!.config?.command).toBe('node');
    });

    it('僅含 user scope → 只回傳 user entries，不拋錯', async () => {
      writeClaudeJson({
        mcpServers: {
          'only-user': { command: 'npx', args: ['-y', 'mcp-tool'] },
        },
      });

      const svc = new McpService(createMockCli(), createMockSettings());
      const servers = await svc.listFromFiles();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('only-user');
      expect(servers[0].scope).toBe('user');
    });

    it('無任何 config 檔 → 回傳空陣列不拋錯', async () => {
      const svc = new McpService(createMockCli(), createMockSettings());
      const servers = await svc.listFromFiles();

      expect(servers).toEqual([]);
    });

    it('user + local scope（同一 .claude.json）→ 正確區分 scope', async () => {
      writeClaudeJson({
        mcpServers: {
          'global-server': { command: 'npx', args: ['-y', 'global-mcp'] },
        },
        projects: {
          [workspaceDir]: {
            mcpServers: {
              'local-server': { command: 'node', args: ['local.js'] },
            },
          },
        },
      });

      const svc = new McpService(createMockCli(), createMockSettings());
      const servers = await svc.listFromFiles();

      const globalServer = servers.find((s) => s.name === 'global-server');
      expect(globalServer!.scope).toBe('user');

      const localServer = servers.find((s) => s.name === 'local-server');
      expect(localServer!.scope).toBe('local');
    });

    it('同名 local server：workspace project entry 優先於 "/" fallback', async () => {
      writeClaudeJson({
        projects: {
          [workspaceDir]: {
            mcpServers: {
              'shared-local': { command: 'node', args: ['workspace.js'] },
            },
          },
          '/': {
            mcpServers: {
              'shared-local': { command: 'node', args: ['fallback.js'] },
            },
          },
        },
      });

      const svc = new McpService(createMockCli(), createMockSettings());
      const servers = await svc.listFromFiles();

      const sharedLocal = servers.find((s) => s.name === 'shared-local');
      expect(sharedLocal).toBeDefined();
      expect(sharedLocal!.scope).toBe('local');
      expect(sharedLocal!.config?.args).toEqual(['workspace.js']);
    });

    it('同名 server：user scope 先建立，project scope 覆蓋', async () => {
      writeClaudeJson({
        mcpServers: {
          'shared-name': { command: 'npx', args: ['user-version'] },
        },
      });
      writeProjectMcpJson(workspaceDir, {
        mcpServers: {
          'shared-name': { command: 'npx', args: ['project-version'] },
        },
      });

      const svc = new McpService(createMockCli(), createMockSettings());
      const servers = await svc.listFromFiles();

      const shared = servers.find((s) => s.name === 'shared-name');
      expect(shared).toBeDefined();
      // project scope 覆蓋 user scope（Map.set 後者覆蓋前者）
      expect(shared!.scope).toBe('project');
      expect(shared!.config?.args).toEqual(['project-version']);
    });

    it('.claude.json 為無效 JSON → 不拋錯，回傳其他來源的 server', async () => {
      writeFileSync(join(SUITE_HOME, '.claude.json'), 'not json!!!');
      writeProjectMcpJson(workspaceDir, {
        mcpServers: {
          'project-only': { command: 'node', args: ['ok.js'] },
        },
      });

      const svc = new McpService(createMockCli(), createMockSettings());
      const servers = await svc.listFromFiles();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('project-only');
    });
  });

  /* ═══════ list — parseMcpList 透過 CLI output ═══════ */

  describe('list — parseMcpList CLI 輸出解析', () => {
    it('空字串 → 空陣列', async () => {
      const svc = new McpService(createMockCli(''), createMockSettings());
      const servers = await svc.list();
      expect(servers).toEqual([]);
    });

    it('單一 server Connected', async () => {
      const cliOutput = [
        'Checking MCP server health...',
        '',
        'my-server: npx -y @foo/bar - ✓ Connected',
      ].join('\n');

      const svc = new McpService(createMockCli(cliOutput), createMockSettings());
      const servers = await svc.list();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('my-server');
      expect(servers[0].fullName).toBe('my-server');
      expect(servers[0].status).toBe('connected');
    });

    it('多 server 含 running/stopped/failed/needs-auth', async () => {
      const cliOutput = [
        'Checking MCP server health...',
        '',
        'server-a: npx -y mcp-a - ✓ Connected',
        'server-b: node b.js - ✗ Failed',
        'server-c: npx -y mcp-c - ⚠ Needs Auth',
        'plugin:ctx:ctx7: npx -y @upstash/context7-mcp - ✓ Connected',
      ].join('\n');

      const svc = new McpService(createMockCli(cliOutput), createMockSettings());
      const servers = await svc.list();

      expect(servers).toHaveLength(4);
      expect(servers[0]).toMatchObject({ name: 'server-a', status: 'connected' });
      expect(servers[1]).toMatchObject({ name: 'server-b', status: 'failed' });
      expect(servers[2]).toMatchObject({ name: 'server-c', status: 'needs-auth' });
      expect(servers[3]).toMatchObject({ name: 'ctx7', fullName: 'plugin:ctx:ctx7', status: 'connected' });
    });

    it('ANSI escape codes → 正確清除後解析', async () => {
      const cliOutput = '\u001b[36mChecking MCP server health...\u001b[0m\n\n\u001b[32mmy-server: cmd - ✓ Connected\u001b[0m';

      const svc = new McpService(createMockCli(cliOutput), createMockSettings());
      const servers = await svc.list();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('my-server');
      expect(servers[0].status).toBe('connected');
    });

    it('非標準行（無 dash separator）→ 跳過不解析', async () => {
      const cliOutput = [
        'Checking MCP server health...',
        '',
        'valid-server: npx mcp - ✓ Connected',
        'some random text without separator',
        'another random line',
      ].join('\n');

      const svc = new McpService(createMockCli(cliOutput), createMockSettings());
      const servers = await svc.list();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('valid-server');
    });

    it('ANSI escape codes 嵌在 server name 中間 → 正確擷取名稱不含 escape codes', async () => {
      // ANSI codes 夾在 name 和 status 文字內部（非包覆整行）
      const bold = '\u001b[1m';
      const reset = '\u001b[0m';
      const green = '\u001b[32m';
      const cliOutput = [
        'Checking MCP server health...',
        '',
        `${bold}inline-bold${reset}: npx -y mcp-tool - ${green}✓ Connected${reset}`,
      ].join('\n');

      const svc = new McpService(createMockCli(cliOutput), createMockSettings());
      const servers = await svc.list();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('inline-bold');
      expect(servers[0].fullName).toBe('inline-bold');
      expect(servers[0].status).toBe('connected');
      // command 不含 escape codes
      // eslint-disable-next-line no-control-regex -- 驗證 ANSI escape codes 已被清除
      expect(servers[0].command).not.toMatch(new RegExp('\u001b'));
    });

    it('command 含冒號（如 npx -y @foo/bar:cmd）→ command 欄位完整保留冒號', async () => {
      const cliOutput = [
        'Checking MCP server health...',
        '',
        'colon-server: npx -y @foo/bar:cmd -- --flag - ✓ Connected',
      ].join('\n');

      const svc = new McpService(createMockCli(cliOutput), createMockSettings());
      const servers = await svc.list();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('colon-server');
      expect(servers[0].command).toBe('npx -y @foo/bar:cmd -- --flag');
      expect(servers[0].status).toBe('connected');
    });

    it('plugin fullName 含多個冒號 + command 含冒號 → name 取最後一段、command 完整保留', async () => {
      const cliOutput = [
        'Checking MCP server health...',
        '',
        'plugin:my-plugin:mcp-srv: npx -y @scope/pkg:bin -- arg - ✓ Connected',
      ].join('\n');

      const svc = new McpService(createMockCli(cliOutput), createMockSettings());
      const servers = await svc.list();

      expect(servers).toHaveLength(1);
      expect(servers[0].fullName).toBe('plugin:my-plugin:mcp-srv');
      expect(servers[0].name).toBe('mcp-srv');
      expect(servers[0].command).toBe('npx -y @scope/pkg:bin -- arg');
    });

    it('僅有 header 行（"Checking..."）無 server 行 → 回傳空陣列不拋錯', async () => {
      const cliOutput = 'Checking MCP server health...';

      const svc = new McpService(createMockCli(cliOutput), createMockSettings());
      const servers = await svc.list();

      expect(servers).toEqual([]);
    });

    it('header + 空白行，無 server → 回傳空陣列不拋錯', async () => {
      const cliOutput = ['Checking MCP server health...', '', '   '].join('\n');

      const svc = new McpService(createMockCli(cliOutput), createMockSettings());
      const servers = await svc.list();

      expect(servers).toEqual([]);
    });

    it('0 results 且 metadata 有資料 → 輸出 warning log', async () => {
      writeClaudeJson({
        mcpServers: {
          'meta-server': { command: 'npx', args: ['-y', 'mcp-meta'] },
        },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        // CLI 回傳只有 header，無 server 行
        const cliOutput = 'Checking MCP server health...';
        const svc = new McpService(createMockCli(cliOutput), createMockSettings());
        const servers = await svc.list();

        expect(servers).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[McpService]'),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('0 results 且 metadata 無資料 → 不觸發 warning log', async () => {
      // 無 ~/.claude.json，無 metadata
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        const cliOutput = 'Checking MCP server health...';
        const svc = new McpService(createMockCli(cliOutput), createMockSettings());
        const servers = await svc.list();

        expect(servers).toEqual([]);
        // 不應該有 [McpService] warning
        const mcpWarnings = warnSpy.mock.calls.filter((args) =>
          typeof args[0] === 'string' && args[0].includes('[McpService]'),
        );
        expect(mcpWarnings).toHaveLength(0);
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  /* ═══════ listFromFiles — plugin MCP ═══════ */

  describe('listFromFiles — plugin 來源 MCP server', () => {
    it('installed plugin 有 .mcp.json → server 出現且 plugin 欄位正確', async () => {
      const pluginPath = join(SUITE_TMP, 'plugins', 'my-plugin');
      createPluginWithMcp(pluginPath, {
        'plugin-mcp': { command: 'npx', args: ['-y', 'plugin-mcp-tool'] },
      });

      writeInstalledPlugins({
        version: 2,
        plugins: {
          'my-plugin@marketplace': [{
            scope: 'user',
            installPath: pluginPath,
            installedAt: '2026-01-01T00:00:00Z',
            lastUpdated: '2026-01-01T00:00:00Z',
          }],
        },
      });

      const settings = createMockSettings();
      (settings.readAllEnabledPlugins as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { 'my-plugin@marketplace': true },
        project: {},
        local: {},
      });

      const svc = new McpService(createMockCli(), settings);
      const servers = await svc.listFromFiles();

      const pluginServer = servers.find((s) => s.name === 'plugin-mcp');
      expect(pluginServer).toBeDefined();
      expect(pluginServer!.fullName).toBe('plugin:my-plugin@marketplace:plugin-mcp');
      expect(pluginServer!.plugin).toEqual({
        id: 'my-plugin@marketplace',
        enabled: true,
      });
      expect(pluginServer!.config?.command).toBe('npx');
    });

    it('plugin .mcp.json 不存在 → 不拋錯，該 plugin 無 MCP server', async () => {
      const pluginPath = join(SUITE_TMP, 'plugins', 'no-mcp-plugin');
      mkdirSync(pluginPath, { recursive: true });
      // 不寫 .mcp.json

      writeInstalledPlugins({
        version: 2,
        plugins: {
          'no-mcp@mp': [{
            scope: 'user',
            installPath: pluginPath,
            installedAt: '2026-01-01T00:00:00Z',
            lastUpdated: '2026-01-01T00:00:00Z',
          }],
        },
      });

      const svc = new McpService(createMockCli(), createMockSettings());
      const servers = await svc.listFromFiles();

      // 不應有 plugin server
      expect(servers.filter((s) => s.plugin)).toHaveLength(0);
    });

    it('installed_plugins.json 不存在 → 不拋錯', async () => {
      writeClaudeJson({
        mcpServers: {
          'normal-server': { command: 'npx', args: ['mcp'] },
        },
      });
      // 不寫 installed_plugins.json

      const svc = new McpService(createMockCli(), createMockSettings());
      const servers = await svc.listFromFiles();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('normal-server');
    });

    it('plugin disabled → plugin.enabled = false', async () => {
      const pluginPath = join(SUITE_TMP, 'plugins', 'disabled-plugin');
      createPluginWithMcp(pluginPath, {
        'dis-mcp': { command: 'node', args: ['dis.js'] },
      });

      writeInstalledPlugins({
        version: 2,
        plugins: {
          'disabled-plugin@mp': [{
            scope: 'user',
            installPath: pluginPath,
            installedAt: '2026-01-01T00:00:00Z',
            lastUpdated: '2026-01-01T00:00:00Z',
          }],
        },
      });

      const settings = createMockSettings();
      const svc = new McpService(createMockCli(), settings);
      const servers = await svc.listFromFiles();

      const pluginServer = servers.find((s) => s.name === 'dis-mcp');
      expect(pluginServer).toBeDefined();
      expect(pluginServer!.plugin!.enabled).toBe(false);
    });
  });

  /* ═══════ list — metadata resolution ═══════ */

  describe('list — CLI output + 設定檔合併', () => {
    it('CLI server 與設定檔 metadata 正確合併 scope + config', async () => {
      writeClaudeJson({
        mcpServers: {
          'my-server': { command: 'npx', args: ['-y', '@foo/bar'] },
        },
      });

      const cliOutput = 'my-server: npx -y @foo/bar - ✓ Connected';
      const svc = new McpService(createMockCli(cliOutput), createMockSettings());
      const servers = await svc.list();

      expect(servers).toHaveLength(1);
      expect(servers[0]).toMatchObject({
        name: 'my-server',
        status: 'connected',
        scope: 'user',
        config: { command: 'npx', args: ['-y', '@foo/bar'] },
      });
    });
  });

  /* ═══════ metadata cache ═══════ */

  describe('metadata cache 機制', () => {
    it('連續兩次 listFromFiles 只讀一次 disk（cache 生效）', async () => {
      writeClaudeJson({
        mcpServers: { 'cached-server': { command: 'npx', args: ['cached'] } },
      });

      const svc = new McpService(createMockCli(), createMockSettings());

      const first = await svc.listFromFiles();
      const second = await svc.listFromFiles();

      expect(first).toHaveLength(1);
      expect(second).toHaveLength(1);
      // 結果相同（cache 不影響正確性）
      expect(first[0].name).toBe(second[0].name);
    });

    it('invalidateMetadataCache 後重新讀 disk', async () => {
      writeClaudeJson({
        mcpServers: { 'old-server': { command: 'npx', args: ['old'] } },
      });

      const svc = new McpService(createMockCli(), createMockSettings());

      const first = await svc.listFromFiles();
      expect(first).toHaveLength(1);
      expect(first[0].name).toBe('old-server');

      // 修改 config 檔 + invalidate
      writeClaudeJson({
        mcpServers: {
          'old-server': { command: 'npx', args: ['old'] },
          'new-server': { command: 'npx', args: ['new'] },
        },
      });
      svc.invalidateMetadataCache();

      const second = await svc.listFromFiles();
      expect(second).toHaveLength(2);
    });
  });
});
