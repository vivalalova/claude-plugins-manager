/**
 * Plugin scope toggle E2E 測試。
 * MessageRouter → PluginService → SettingsFileService → 真實 filesystem。
 * 模擬 webview 發送 plugin.install / plugin.enable / plugin.disable，
 * 驗證 settings.json 實際寫入磁碟。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-toggle-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { MessageRouter } from '../MessageRouter';
import { PluginService } from '../../services/PluginService';
import { SettingsFileService } from '../../services/SettingsFileService';
import type { CliService } from '../../services/CliService';
import type { MarketplaceService } from '../../services/MarketplaceService';
import type { McpService } from '../../services/McpService';
import type { TranslationService } from '../../services/TranslationService';
import type { RequestMessage, ResponseMessage } from '../protocol';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

/** Mock CLI（不呼叫真實 claude CLI） */
function createMockCli(): CliService {
  return {
    exec: vi.fn().mockResolvedValue(''),
    execJson: vi.fn().mockResolvedValue([]),
  } as unknown as CliService;
}

/** 空殼 Marketplace/MCP/Translation service */
function createStubServices() {
  return {
    marketplace: { list: vi.fn() } as unknown as MarketplaceService,
    mcp: { listFromFiles: vi.fn() } as unknown as McpService,
    translation: { translate: vi.fn() } as unknown as TranslationService,
  };
}

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

describe('Plugin scope toggle（E2E：MessageRouter → Service → Filesystem）', () => {
  let router: MessageRouter;
  let settingsSvc: SettingsFileService;
  let workspaceDir: string;
  let testIdx = 0;

  const installedPluginsPath = join(SUITE_HOME, '.claude', 'plugins', 'installed_plugins.json');
  const projectSettingsPath = () => join(workspaceDir, '.claude', 'settings.json');
  const localSettingsPath = () => join(workspaceDir, '.claude', 'settings.local.json');

  /** 種子：在 installed_plugins.json 放一筆 user scope entry */
  async function seedUserInstall(pluginId: string): Promise<void> {
    const raw = await readFile(installedPluginsPath, 'utf-8');
    const data = JSON.parse(raw);
    data.plugins[pluginId] = [{
      scope: 'user',
      installPath: join(SUITE_TMP, 'cache', pluginId),
      version: 'abc123',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    }];
    await writeFile(installedPluginsPath, JSON.stringify(data, null, 2) + '\n');
  }

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });
    // 不建立 .claude/ — 驗證 mkdir 行為

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    await writeFile(join(SUITE_HOME, '.claude', 'settings.json'), '{}');
    await writeFile(installedPluginsPath, JSON.stringify({ version: 2, plugins: {} }));

    settingsSvc = new SettingsFileService();
    const cli = createMockCli();
    const pluginSvc = new PluginService(cli, settingsSvc);
    const stubs = createStubServices();
    router = new MessageRouter(stubs.marketplace, pluginSvc, stubs.mcp, stubs.translation);
  });

  /* ═══════ 核心場景：勾 Project scope ═══════ */

  it('新 workspace（無 .claude/）勾 project scope → settings.json 被建立且 enabled', async () => {
    await seedUserInstall('looping@plugins-local');

    // 模擬 webview: plugin.install
    const installRes = await send(router, {
      type: 'plugin.install',
      plugin: 'looping@plugins-local',
      scope: 'project',
    });
    expect(installRes.type).toBe('response');

    // 驗證 filesystem
    const content = await readFile(projectSettingsPath(), 'utf-8');
    const settings = JSON.parse(content);
    expect(settings.enabledPlugins['looping@plugins-local']).toBe(true);
  });

  it('勾 project scope 後再 enable → 冪等，不報錯', async () => {
    await seedUserInstall('my-plugin@mp');

    await send(router, {
      type: 'plugin.install',
      plugin: 'my-plugin@mp',
      scope: 'project',
    });

    // install 已自動 enable，再呼叫 enable → 冪等
    const enableRes = await send(router, {
      type: 'plugin.enable',
      plugin: 'my-plugin@mp',
      scope: 'project',
    });
    expect(enableRes.type).toBe('response');

    const content = await readFile(projectSettingsPath(), 'utf-8');
    expect(JSON.parse(content).enabledPlugins['my-plugin@mp']).toBe(true);
  });

  /* ═══════ 取消勾：disable ═══════ */

  it('取消勾 project scope → settings.json 移除 key', async () => {
    await seedUserInstall('my-plugin@mp');
    await send(router, {
      type: 'plugin.install',
      plugin: 'my-plugin@mp',
      scope: 'project',
    });

    // disable
    const disableRes = await send(router, {
      type: 'plugin.disable',
      plugin: 'my-plugin@mp',
      scope: 'project',
    });
    expect(disableRes.type).toBe('response');

    const content = await readFile(projectSettingsPath(), 'utf-8');
    expect(JSON.parse(content).enabledPlugins['my-plugin@mp']).toBeUndefined();
  });

  /* ═══════ 反覆勾選（user 抱怨的場景） ═══════ */

  it('反覆 enable → disable → enable → 最終 settings 正確', async () => {
    await seedUserInstall('flaky@mp');

    // enable
    await send(router, { type: 'plugin.install', plugin: 'flaky@mp', scope: 'project' });
    // disable
    await send(router, { type: 'plugin.disable', plugin: 'flaky@mp', scope: 'project' });
    // enable again
    await send(router, { type: 'plugin.install', plugin: 'flaky@mp', scope: 'project' });

    const content = await readFile(projectSettingsPath(), 'utf-8');
    expect(JSON.parse(content).enabledPlugins['flaky@mp']).toBe(true);

    // installed_plugins.json 也正確
    const installed = JSON.parse(await readFile(installedPluginsPath, 'utf-8'));
    const projectEntries = installed.plugins['flaky@mp']
      .filter((e: any) => e.scope === 'project');
    expect(projectEntries).toHaveLength(1);
  });

  /* ═══════ local scope ═══════ */

  it('勾 local scope → settings.local.json 被建立', async () => {
    await seedUserInstall('local-plugin@mp');

    await send(router, {
      type: 'plugin.install',
      plugin: 'local-plugin@mp',
      scope: 'local',
    });

    const content = await readFile(localSettingsPath(), 'utf-8');
    expect(JSON.parse(content).enabledPlugins['local-plugin@mp']).toBe(true);
  });

  /* ═══════ listAvailable 回傳正確 enabled 狀態 ═══════ */

  it('install project scope → listAvailable 回傳的 installed entry 有 enabled: true', async () => {
    await seedUserInstall('check@mp');
    await send(router, {
      type: 'plugin.install',
      plugin: 'check@mp',
      scope: 'project',
    });

    const res = await send(router, { type: 'plugin.listAvailable' });
    expect(res.type).toBe('response');
    const data = (res as any).data;
    const projectEntry = data.installed.find(
      (p: any) => p.id === 'check@mp' && p.scope === 'project',
    );
    expect(projectEntry).toBeDefined();
    expect(projectEntry.enabled).toBe(true);
  });

  it('disable 後 → listAvailable 回傳 enabled: false', async () => {
    await seedUserInstall('check@mp');
    await send(router, { type: 'plugin.install', plugin: 'check@mp', scope: 'project' });
    await send(router, { type: 'plugin.disable', plugin: 'check@mp', scope: 'project' });

    const res = await send(router, { type: 'plugin.listAvailable' });
    const data = (res as any).data;
    const projectEntry = data.installed.find(
      (p: any) => p.id === 'check@mp' && p.scope === 'project',
    );
    expect(projectEntry).toBeDefined();
    expect(projectEntry.enabled).toBe(false);
  });

  /* ═══════ 錯誤場景 ═══════ */

  it('無 workspace 時 install project scope → 回傳 error', async () => {
    workspace.workspaceFolders = undefined;
    await seedUserInstall('err@mp');

    const res = await send(router, {
      type: 'plugin.install',
      plugin: 'err@mp',
      scope: 'project',
    });

    expect(res.type).toBe('error');
    expect((res as any).error).toContain('No workspace folder open');
  });
});
