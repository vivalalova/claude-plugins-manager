/**
 * SettingsFileService — disableAllHooks 欄位讀寫整合測試。
 * 用真實 filesystem（tmpdir），不 mock fs/promises。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { workspace } from 'vscode';

const { SUITE_TMP, SUITE_HOME } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfs-hooks-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { SettingsFileService } from '../SettingsFileService';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

describe('SettingsFileService — disableAllHooks 讀寫（integration）', () => {
  let svc: SettingsFileService;
  let workspaceDir: string;
  let testIdx = 0;

  const userSettingsPath = () => join(SUITE_HOME, '.claude', 'settings.json');
  const projectSettingsPath = () => join(workspaceDir, '.claude', 'settings.json');

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-hooks-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    await writeFile(userSettingsPath(), JSON.stringify({}) + '\n');
    svc = new SettingsFileService();
  });

  it('setSetting disableAllHooks true → JSON 寫入 true', async () => {
    await svc.setSetting('user', 'disableAllHooks', true);

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.disableAllHooks).toBe(true);
  });

  it('disableAllHooks 已為 true → deleteSetting 移除欄位', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ disableAllHooks: true, model: 'claude-sonnet-4-6' }) + '\n');
    svc = new SettingsFileService();

    await svc.deleteSetting('user', 'disableAllHooks');

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.disableAllHooks).toBeUndefined();
    expect(content.model).toBe('claude-sonnet-4-6');
  });

  it('disableAllHooks 不存在時 deleteSetting → no-op 不拋錯', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ model: 'claude-opus-4-6' }) + '\n');
    svc = new SettingsFileService();

    await expect(svc.deleteSetting('user', 'disableAllHooks')).resolves.toBeUndefined();

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.model).toBe('claude-opus-4-6');
  });

  it('project scope：setSetting disableAllHooks true → 自動建立 .claude/ 目錄', async () => {
    await svc.setSetting('project', 'disableAllHooks', true);

    const content = JSON.parse(await readFile(projectSettingsPath(), 'utf-8'));
    expect(content.disableAllHooks).toBe(true);
  });

  it('setSetting disableAllHooks 不影響同 scope 其他欄位', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ model: 'claude-opus-4-6' }) + '\n');
    svc = new SettingsFileService();

    await svc.setSetting('user', 'disableAllHooks', true);

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.model).toBe('claude-opus-4-6');
    expect(content.disableAllHooks).toBe(true);
  });

  it('getSettings 可讀回 disableAllHooks true', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ disableAllHooks: true }) + '\n');
    svc = new SettingsFileService();

    const data = await svc.getSettings('user');
    expect(data.disableAllHooks).toBe(true);
  });

  it('getSettings 讀回無 disableAllHooks 時為 undefined', async () => {
    const data = await svc.getSettings('user');
    expect(data.disableAllHooks).toBeUndefined();
  });

  it('round-trip：setSetting true → getSettings 有值 → deleteSetting → getSettings undefined', async () => {
    await svc.setSetting('user', 'disableAllHooks', true);
    expect((await svc.getSettings('user')).disableAllHooks).toBe(true);

    await svc.deleteSetting('user', 'disableAllHooks');
    expect((await svc.getSettings('user')).disableAllHooks).toBeUndefined();
  });
});
