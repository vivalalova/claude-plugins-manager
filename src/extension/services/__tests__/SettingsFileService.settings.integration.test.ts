/**
 * SettingsFileService — getSettings / setSetting / deleteSetting 整合測試。
 * 用真實 filesystem（tmpdir），不 mock fs/promises。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfs-settings-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { SettingsFileService } from '../SettingsFileService';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

describe('SettingsFileService.getSettings / setSetting / deleteSetting（integration）', () => {
  let svc: SettingsFileService;
  let workspaceDir: string;
  let testIdx = 0;

  const userSettingsPath = () => join(SUITE_HOME, '.claude', 'settings.json');
  const projectSettingsPath = () => join(workspaceDir, '.claude', 'settings.json');
  const localSettingsPath = () => join(workspaceDir, '.claude', 'settings.local.json');

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-settings-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    // 重置 user settings
    await writeFile(userSettingsPath(), JSON.stringify({}) + '\n');

    svc = new SettingsFileService();
  });

  /* ═══════ getSettings ═══════ */

  it('user scope：空檔案 → 回傳 {}', async () => {
    const result = await svc.getSettings('user');
    expect(result).toEqual({});
  });

  it('user scope：有值的 settings → 正確回傳', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({
      model: 'claude-opus-4-6',
      effortLevel: 'high',
    }) + '\n');

    const result = await svc.getSettings('user');
    expect(result.model).toBe('claude-opus-4-6');
    expect(result.effortLevel).toBe('high');
  });

  it('project scope：檔案不存在 → 回傳 {}', async () => {
    const result = await svc.getSettings('project');
    expect(result).toEqual({});
  });

  it('getSettings 不做跨 scope 合併（user / project 各自獨立）', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ model: 'user-model' }) + '\n');
    mkdirSync(join(workspaceDir, '.claude'), { recursive: true });
    await writeFile(projectSettingsPath(), JSON.stringify({ model: 'project-model' }) + '\n');

    const userResult = await svc.getSettings('user');
    const projectResult = await svc.getSettings('project');

    expect(userResult.model).toBe('user-model');
    expect(projectResult.model).toBe('project-model');
  });

  /* ═══════ setSetting ═══════ */

  it('user scope：setSetting 寫入單一 key', async () => {
    await svc.setSetting('user', 'model', 'claude-sonnet-4-6');

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.model).toBe('claude-sonnet-4-6');
  });

  it('setSetting 保留其他欄位（包括 $schema）', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({
      $schema: 'https://json.schemastore.org/claude-code-settings.json',
      effortLevel: 'high',
      enabledPlugins: { 'foo@bar': true },
    }) + '\n');

    await svc.setSetting('user', 'model', 'claude-opus-4-6');

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.$schema).toBe('https://json.schemastore.org/claude-code-settings.json');
    expect(content.effortLevel).toBe('high');
    expect(content.enabledPlugins).toEqual({ 'foo@bar': true });
    expect(content.model).toBe('claude-opus-4-6');
  });

  it('project scope：.claude/ 不存在 → 自動建立目錄並寫入', async () => {
    await svc.setSetting('project', 'model', 'claude-haiku-4-5-20251001');

    const content = JSON.parse(await readFile(projectSettingsPath(), 'utf-8'));
    expect(content.model).toBe('claude-haiku-4-5-20251001');
  });

  it('local scope：.claude/ 不存在 → 自動建立目錄並寫入', async () => {
    await svc.setSetting('local', 'effortLevel', 'medium');

    const content = JSON.parse(await readFile(localSettingsPath(), 'utf-8'));
    expect(content.effortLevel).toBe('medium');
  });

  it('setSetting 可寫入 object 值（permissions）', async () => {
    const perms = { allow: ['Bash(git:*)'], deny: [], defaultMode: 'ask' };
    await svc.setSetting('user', 'permissions', perms);

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.permissions).toEqual(perms);
  });

  it('setSetting 覆蓋既有 key', async () => {
    await svc.setSetting('user', 'model', 'first-model');
    await svc.setSetting('user', 'model', 'second-model');

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.model).toBe('second-model');
  });

  /* ═══════ deleteSetting ═══════ */

  it('user scope：deleteSetting 移除指定 key', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({
      model: 'claude-opus-4-6',
      effortLevel: 'high',
    }) + '\n');

    await svc.deleteSetting('user', 'model');

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.model).toBeUndefined();
    expect(content.effortLevel).toBe('high');
  });

  it('project scope：檔案不存在 → no-op（不拋錯）', async () => {
    // .claude/settings.json 不存在
    await expect(svc.deleteSetting('project', 'model')).resolves.toBeUndefined();
  });

  it('deleteSetting key 不存在 → no-op', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ effortLevel: 'low' }) + '\n');

    await svc.deleteSetting('user', 'model'); // model 不存在

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content).toEqual({ effortLevel: 'low' });
  });

  /* ═══════ 全流程 round-trip ═══════ */

  it('setSetting → getSettings → deleteSetting → getSettings 完整流程', async () => {
    // 設定
    await svc.setSetting('user', 'model', 'claude-sonnet-4-6');
    await svc.setSetting('user', 'effortLevel', 'high');

    // 讀取
    const after = await svc.getSettings('user');
    expect(after.model).toBe('claude-sonnet-4-6');
    expect(after.effortLevel).toBe('high');

    // 刪除 model
    await svc.deleteSetting('user', 'model');

    // 確認 model 消失，effortLevel 保留
    const final = await svc.getSettings('user');
    expect(final.model).toBeUndefined();
    expect(final.effortLevel).toBe('high');
  });

  it('setSetting 寫入 env object（Record<string,string>）', async () => {
    const env = { DISABLE_TELEMETRY: '1', MY_API: 'https://api.example.com' };
    await svc.setSetting('user', 'env', env);

    const content = await svc.getSettings('user');
    expect(content.env).toEqual(env);
  });
});

describe('SettingsFileService — permissions 讀寫（integration）', () => {
  let svc: SettingsFileService;
  let workspaceDir: string;
  let permTestIdx = 0;

  const userSettingsPath = () => join(SUITE_HOME, '.claude', 'settings.json');
  const projectSettingsPath = () => join(workspaceDir, '.claude', 'settings.json');

  beforeEach(async () => {
    permTestIdx++;
    workspaceDir = join(SUITE_TMP, `ws-perms-${permTestIdx}`);
    mkdirSync(workspaceDir, { recursive: true });

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    await writeFile(userSettingsPath(), JSON.stringify({}) + '\n');

    svc = new SettingsFileService();
  });

  it('setSetting permissions → getSettings 正確回傳', async () => {
    const perms = { allow: ['Bash(git:*)'], deny: ['WebFetch'], ask: [], defaultMode: 'ask' };
    await svc.setSetting('user', 'permissions', perms);

    const content = await svc.getSettings('user');
    expect(content.permissions).toEqual(perms);
  });

  it('刪除規則後 allow 空陣列保留（不刪 permissions key）', async () => {
    await svc.setSetting('user', 'permissions', { allow: ['WebSearch'], deny: [], ask: [] });

    // 模擬 UI 刪除最後一條規則 → 寫入空陣列
    await svc.setSetting('user', 'permissions', { allow: [], deny: [], ask: [] });

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.permissions).toBeDefined();
    expect(content.permissions.allow).toEqual([]);
  });

  it('project scope permissions 讀寫，自動建立 .claude/ 目錄', async () => {
    const perms = { allow: ['Bash(npm run:*)'], deny: [], ask: [] };
    await svc.setSetting('project', 'permissions', perms);

    const content = JSON.parse(await readFile(projectSettingsPath(), 'utf-8'));
    expect(content.permissions).toEqual(perms);
  });

  it('未知 defaultMode 寫入後讀回保持原值', async () => {
    await svc.setSetting('user', 'permissions', { defaultMode: 'strict' });

    const content = await svc.getSettings('user');
    expect((content.permissions as any)?.defaultMode).toBe('strict');
  });

  it('permissions 讀寫不影響同 scope 其他欄位', async () => {
    await svc.setSetting('user', 'model', 'claude-opus-4-6');
    await svc.setSetting('user', 'permissions', { allow: ['WebSearch'], deny: [], ask: [] });

    const content = await svc.getSettings('user');
    expect(content.model).toBe('claude-opus-4-6');
    expect((content.permissions as any)?.allow).toEqual(['WebSearch']);
  });
});
