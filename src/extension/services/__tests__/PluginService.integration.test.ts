/**
 * PluginService 整合測試。
 * 真實 SettingsFileService + 真實 filesystem，只 mock CLI。
 * 驗證 install → listInstalled → disable → uninstall 全流程。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { workspace } from 'vscode';

/* ── 建立 suite 共用的 tmpdir，mock os.homedir 指向它 ── */
const { SUITE_TMP, SUITE_HOME } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { SettingsFileService } from '../SettingsFileService';
import { PluginService } from '../PluginService';
import type { CliService } from '../CliService';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

/** mock CLI（不實際呼叫 claude CLI） */
function createMockCli(): CliService {
  return {
    exec: vi.fn().mockResolvedValue(''),
    execJson: vi.fn().mockResolvedValue([]),
  } as unknown as CliService;
}

describe('PluginService（integration / 真實 SettingsFileService + filesystem）', () => {
  let settings: SettingsFileService;
  let cli: CliService;
  let svc: PluginService;
  let workspaceDir: string;
  let testIdx = 0;

  const installedPluginsPath = join(SUITE_HOME, '.claude', 'plugins', 'installed_plugins.json');
  const userSettingsPath = join(SUITE_HOME, '.claude', 'settings.json');

  /** 種子：在 installed_plugins.json 放一筆 user scope entry（給 install reuse 路徑用） */
  async function seedUserInstall(pluginId: string): Promise<void> {
    const data = JSON.parse(
      await import('fs/promises').then((fs) => fs.readFile(installedPluginsPath, 'utf-8')),
    );
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

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    // 重置共用檔案
    await writeFile(userSettingsPath, JSON.stringify({}) + '\n');
    await writeFile(installedPluginsPath, JSON.stringify({ version: 2, plugins: {} }) + '\n');

    settings = new SettingsFileService();
    cli = createMockCli();
    svc = new PluginService(cli, settings);
  });

  /* ═══════ install (reuse 路徑) → listInstalled ═══════ */

  it('install project scope（reuse 路徑）→ listInstalled 回傳 enabled 的 project entry', async () => {
    await seedUserInstall('my-plugin@mp');

    await svc.install('my-plugin@mp', 'project');

    const list = await svc.listInstalled();
    const projectEntry = list.find((p) => p.scope === 'project');

    expect(projectEntry).toBeDefined();
    expect(projectEntry!.id).toBe('my-plugin@mp');
    expect(projectEntry!.enabled).toBe(true);
    expect(projectEntry!.projectPath).toBe(workspaceDir);
  });

  it('install project scope → .claude/settings.json 實際存在且內容正確', async () => {
    await seedUserInstall('my-plugin@mp');

    await svc.install('my-plugin@mp', 'project');

    const { readFile: read } = await import('fs/promises');
    const content = await read(join(workspaceDir, '.claude', 'settings.json'), 'utf-8');
    const settings = JSON.parse(content);
    expect(settings.enabledPlugins['my-plugin@mp']).toBe(true);
  });

  /* ═══════ install → disable → listInstalled ═══════ */

  it('install → disable → listInstalled 回傳 enabled: false', async () => {
    await seedUserInstall('my-plugin@mp');
    await svc.install('my-plugin@mp', 'project');

    await svc.disable('my-plugin@mp', 'project');

    const list = await svc.listInstalled();
    const projectEntry = list.find((p) => p.scope === 'project');
    expect(projectEntry).toBeDefined();
    expect(projectEntry!.enabled).toBe(false);
  });

  /* ═══════ install → enable → disable → enable（冪等） ═══════ */

  it('反覆 enable/disable → 最終狀態正確', async () => {
    await seedUserInstall('toggle@mp');
    await svc.install('toggle@mp', 'project');

    await svc.disable('toggle@mp', 'project');
    await svc.enable('toggle@mp', 'project');
    await svc.disable('toggle@mp', 'project');
    await svc.enable('toggle@mp', 'project');

    const list = await svc.listInstalled();
    const entry = list.find((p) => p.scope === 'project' && p.id === 'toggle@mp');
    expect(entry!.enabled).toBe(true);
  });

  /* ═══════ install → uninstall ═══════ */

  it('uninstall → listInstalled 不含該 scope entry', async () => {
    await seedUserInstall('my-plugin@mp');
    await svc.install('my-plugin@mp', 'project');

    await svc.uninstall('my-plugin@mp', 'project');

    const list = await svc.listInstalled();
    const projectEntry = list.find((p) => p.scope === 'project');
    expect(projectEntry).toBeUndefined();

    // user scope 的 entry 仍在
    const userEntry = list.find((p) => p.scope === 'user');
    expect(userEntry).toBeDefined();
  });

  /* ═══════ 多 plugin 並存 ═══════ */

  it('多個 plugin install → listInstalled 全部回傳', async () => {
    await seedUserInstall('alpha@mp');
    await seedUserInstall('beta@mp');

    await svc.install('alpha@mp', 'project');
    await svc.install('beta@mp', 'project');

    const list = await svc.listInstalled();
    const projectEntries = list.filter((p) => p.scope === 'project');

    expect(projectEntries).toHaveLength(2);
    expect(projectEntries.map((p) => p.id).sort()).toEqual(['alpha@mp', 'beta@mp']);
    expect(projectEntries.every((p) => p.enabled)).toBe(true);
  });

  /* ═══════ disableAll ═══════ */

  it('disableAll → 所有 scope 的 plugin 都 disabled', async () => {
    // user scope enable
    await settings.setPluginEnabled('x@mp', 'user', true);
    // project scope install + enable
    await seedUserInstall('y@mp');
    await svc.install('y@mp', 'project');

    await svc.disableAll();

    const userPlugins = await settings.readEnabledPlugins('user');
    const projectPlugins = await settings.readEnabledPlugins('project');
    expect(userPlugins).toEqual({});
    expect(projectPlugins).toEqual({});
  });

  /* ═══════ fresh install (CLI 路徑) ═══════ */

  it('全新 plugin install → 走 CLI 路徑，帶 cwd', async () => {
    // installed_plugins.json 沒有這個 plugin → CLI 路徑
    await svc.install('brand-new@mp', 'project');

    expect((cli as any).exec).toHaveBeenCalledWith(
      ['plugin', 'install', 'brand-new@mp', '--scope', 'project'],
      expect.objectContaining({ cwd: workspaceDir }),
    );
  });
});
