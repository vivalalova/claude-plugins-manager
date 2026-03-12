/**
 * SettingsFileService — env 欄位讀寫整合測試。
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfs-env-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { SettingsFileService } from '../SettingsFileService';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

describe('SettingsFileService — env 讀寫（integration）', () => {
  let svc: SettingsFileService;
  let workspaceDir: string;
  let testIdx = 0;

  const userSettingsPath = () => join(SUITE_HOME, '.claude', 'settings.json');
  const projectSettingsPath = () => join(workspaceDir, '.claude', 'settings.json');
  const localSettingsPath = () => join(workspaceDir, '.claude', 'settings.local.json');

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-env-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    await writeFile(userSettingsPath(), JSON.stringify({}) + '\n');
    svc = new SettingsFileService();
  });

  it('新增單一 env var → 讀回正確', async () => {
    await svc.setSetting('user', 'env', { MY_VAR: 'hello' });

    const content = await svc.getSettings('user');
    expect((content.env as any)?.MY_VAR).toBe('hello');
  });

  it('新增含特殊字元 value（URL）→ 讀回正確', async () => {
    await svc.setSetting('user', 'env', { MY_API: 'https://api.example.com' });

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.env.MY_API).toBe('https://api.example.com');
  });

  it('修改已存在 key → 舊值被覆蓋', async () => {
    await svc.setSetting('user', 'env', { MY_VAR: 'first' });
    await svc.setSetting('user', 'env', { MY_VAR: 'second' });

    const content = await svc.getSettings('user');
    expect((content.env as any)?.MY_VAR).toBe('second');
  });

  it('刪除某 key（setSetting 傳 updated object）→ 其他 key 保留', async () => {
    await svc.setSetting('user', 'env', { KEEP: 'yes', REMOVE: 'bye' });
    const env = { KEEP: 'yes' };
    await svc.setSetting('user', 'env', env);

    const content = await svc.getSettings('user');
    const envObj = content.env as any;
    expect(envObj?.KEEP).toBe('yes');
    expect(envObj?.REMOVE).toBeUndefined();
  });

  it('刪除最後一個 key → env 保留為 {} 而非 undefined', async () => {
    await svc.setSetting('user', 'env', { ONLY: 'one' });
    await svc.setSetting('user', 'env', {});

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.env).toBeDefined();
    expect(content.env).toEqual({});
  });

  it('env 操作不影響同 scope 其他欄位（model 保留）', async () => {
    await svc.setSetting('user', 'model', 'claude-opus-4-6');
    await svc.setSetting('user', 'env', { MY_VAR: 'hello' });

    const content = await svc.getSettings('user');
    expect(content.model).toBe('claude-opus-4-6');
    expect((content.env as any)?.MY_VAR).toBe('hello');
  });

  it('project scope 自動建立 .claude/ 目錄並寫入', async () => {
    await svc.setSetting('project', 'env', { PROJ_VAR: 'test' });

    const content = JSON.parse(await readFile(projectSettingsPath(), 'utf-8'));
    expect(content.env?.PROJ_VAR).toBe('test');
  });

  it('local scope 寫入 settings.local.json', async () => {
    await svc.setSetting('local', 'env', { LOCAL_VAR: 'local' });

    const content = JSON.parse(await readFile(localSettingsPath(), 'utf-8'));
    expect(content.env?.LOCAL_VAR).toBe('local');
  });
});
