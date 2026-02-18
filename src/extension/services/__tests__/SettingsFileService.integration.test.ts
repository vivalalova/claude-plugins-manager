/**
 * SettingsFileService 整合測試。
 * 用真實 filesystem（tmpdir），不 mock fs/promises。
 * 驗證 mkdir、readFile、writeFile 全流程。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { readFile, writeFile, rm } from 'fs/promises';
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfs-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

// 真正的 SettingsFileService（不 mock fs/promises）
import { SettingsFileService } from '../SettingsFileService';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

describe('SettingsFileService（integration / 真實 filesystem）', () => {
  let svc: SettingsFileService;
  let workspaceDir: string;
  let testIdx = 0;

  /** settings 檔完整路徑 */
  const projectSettingsPath = () => join(workspaceDir, '.claude', 'settings.json');
  const localSettingsPath = () => join(workspaceDir, '.claude', 'settings.local.json');
  const userSettingsPath = () => join(SUITE_HOME, '.claude', 'settings.json');
  const installedPluginsPath = () => join(SUITE_HOME, '.claude', 'plugins', 'installed_plugins.json');

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });
    // 不建立 .claude/ — 讓測試驗證 mkdir 行為

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    // 重置共用檔案
    await writeFile(userSettingsPath(), JSON.stringify({}) + '\n');
    await writeFile(installedPluginsPath(), JSON.stringify({ version: 2, plugins: {} }) + '\n');

    svc = new SettingsFileService();
  });

  /* ═══════ setPluginEnabled — project/local scope ═══════ */

  it('project scope：.claude/ 不存在 → 自動建立目錄並寫入 settings.json', async () => {
    await svc.setPluginEnabled('test@mp', 'project', true);

    const content = await readFile(projectSettingsPath(), 'utf-8');
    const settings = JSON.parse(content);
    expect(settings.enabledPlugins['test@mp']).toBe(true);
  });

  it('local scope：.claude/ 不存在 → 自動建立目錄並寫入 settings.local.json', async () => {
    await svc.setPluginEnabled('test@mp', 'local', true);

    const content = await readFile(localSettingsPath(), 'utf-8');
    const settings = JSON.parse(content);
    expect(settings.enabledPlugins['test@mp']).toBe(true);
  });

  it('enable → readEnabledPlugins → 正確讀回', async () => {
    await svc.setPluginEnabled('a@mp', 'project', true);
    await svc.setPluginEnabled('b@mp', 'project', true);

    const plugins = await svc.readEnabledPlugins('project');
    expect(plugins).toEqual({ 'a@mp': true, 'b@mp': true });
  });

  it('enable → disable → readEnabledPlugins → key 已移除', async () => {
    await svc.setPluginEnabled('a@mp', 'project', true);
    await svc.setPluginEnabled('b@mp', 'project', true);
    await svc.setPluginEnabled('a@mp', 'project', false);

    const plugins = await svc.readEnabledPlugins('project');
    expect(plugins).toEqual({ 'b@mp': true });
  });

  it('保留 settings 中的其他欄位', async () => {
    // 先手動寫入含其他欄位的 settings
    mkdirSync(join(workspaceDir, '.claude'), { recursive: true });
    await writeFile(projectSettingsPath(), JSON.stringify({
      permissions: { allow: ['Bash(ls:*)'] },
      enabledPlugins: { 'existing@mp': true },
    }) + '\n');

    await svc.setPluginEnabled('new@mp', 'project', true);

    const content = await readFile(projectSettingsPath(), 'utf-8');
    const settings = JSON.parse(content);
    expect(settings.permissions).toEqual({ allow: ['Bash(ls:*)'] });
    expect(settings.enabledPlugins).toEqual({
      'existing@mp': true,
      'new@mp': true,
    });
  });

  /* ═══════ setPluginEnabled — user scope ═══════ */

  it('user scope：讀寫 ~/.claude/settings.json', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({
      enabledPlugins: { 'old@mp': true },
    }) + '\n');

    await svc.setPluginEnabled('new@mp', 'user', true);

    const content = await readFile(userSettingsPath(), 'utf-8');
    const settings = JSON.parse(content);
    expect(settings.enabledPlugins).toEqual({ 'old@mp': true, 'new@mp': true });
  });

  /* ═══════ addInstallEntry + readInstalledPlugins ═══════ */

  it('addInstallEntry → readInstalledPlugins → 正確讀回', async () => {
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'user',
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });

    const data = await svc.readInstalledPlugins();
    expect(data.plugins['my-plugin@mp']).toHaveLength(1);
    expect(data.plugins['my-plugin@mp'][0]).toMatchObject({
      scope: 'user',
      installPath: '/cache/my-plugin',
    });
  });

  it('addInstallEntry 兩個 scope → 兩筆 entries', async () => {
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'user',
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'project',
      projectPath: workspaceDir,
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });

    const data = await svc.readInstalledPlugins();
    expect(data.plugins['my-plugin@mp']).toHaveLength(2);
    expect(data.plugins['my-plugin@mp'].map((e) => e.scope)).toEqual(['user', 'project']);
  });

  it('addInstallEntry 重複 → 不新增', async () => {
    const entry = {
      scope: 'user' as const,
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    };
    await svc.addInstallEntry('my-plugin@mp', entry);
    await svc.addInstallEntry('my-plugin@mp', entry);

    const data = await svc.readInstalledPlugins();
    expect(data.plugins['my-plugin@mp']).toHaveLength(1);
  });

  /* ═══════ removeInstallEntry ═══════ */

  it('removeInstallEntry → 移除後 readInstalledPlugins 不含該 entry', async () => {
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'user',
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'project',
      projectPath: workspaceDir,
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });

    await svc.removeInstallEntry('my-plugin@mp', 'user');

    const data = await svc.readInstalledPlugins();
    expect(data.plugins['my-plugin@mp']).toHaveLength(1);
    expect(data.plugins['my-plugin@mp'][0].scope).toBe('project');
  });

  it('removeInstallEntry 最後一筆 → plugin key 消失', async () => {
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'user',
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });

    await svc.removeInstallEntry('my-plugin@mp', 'user');

    const data = await svc.readInstalledPlugins();
    expect(data.plugins['my-plugin@mp']).toBeUndefined();
  });

  /* ═══════ 全流程 round-trip ═══════ */

  it('完整流程：addInstallEntry + setPluginEnabled → readInstalledPlugins + readEnabledPlugins 一致', async () => {
    // 安裝 + enable
    await svc.addInstallEntry('flow@mp', {
      scope: 'project',
      projectPath: workspaceDir,
      installPath: '/cache/flow',
      version: '2.0.0',
      installedAt: '2026-01-15T00:00:00Z',
      lastUpdated: '2026-01-15T00:00:00Z',
    });
    await svc.setPluginEnabled('flow@mp', 'project', true);

    // 驗證
    const data = await svc.readInstalledPlugins();
    expect(data.plugins['flow@mp']).toHaveLength(1);

    const enabled = await svc.readEnabledPlugins('project');
    expect(enabled['flow@mp']).toBe(true);

    // disable
    await svc.setPluginEnabled('flow@mp', 'project', false);
    const after = await svc.readEnabledPlugins('project');
    expect(after['flow@mp']).toBeUndefined();

    // 移除
    await svc.removeInstallEntry('flow@mp', 'project', workspaceDir);
    const final = await svc.readInstalledPlugins();
    expect(final.plugins['flow@mp']).toBeUndefined();
  });
});
