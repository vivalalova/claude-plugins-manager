/**
 * SettingsFileService — global config (~/.claude.json) 整合測試。
 * 7 個 user-facing key（autoConnectIde 等）依官方文件應存在 ~/.claude.json 頂層，
 * 而非 settings.json；目前 extension 全部寫進 settings.json，導致 Claude Code 啟動時
 * 靜默忽略。本檔驗證修復後 getSettings/setSetting/deleteSetting 對這批 key 的行為。
 * 用真實 filesystem（tmpdir），不 mock fs/promises，仿照 SettingsFileService.settings.integration.test.ts。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { workspace } from 'vscode';
import { getGlobalConfigSettingKeys } from '../../../shared/claude-settings-schema';

/* ── 建立 suite 共用的 tmpdir，mock os.homedir 指向它 ── */
const { SUITE_TMP, SUITE_HOME } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfs-globalconfig-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { SettingsFileService } from '../SettingsFileService';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

describe('SettingsFileService — global config (~/.claude.json)（integration）', () => {
  let svc: SettingsFileService;
  let workspaceDir: string;
  let testIdx = 0;

  const globalConfigPath = () => join(SUITE_HOME, '.claude.json');
  const userSettingsPath = () => join(SUITE_HOME, '.claude', 'settings.json');
  const projectSettingsPath = () => join(workspaceDir, '.claude', 'settings.json');

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-globalconfig-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    // 重置 user settings.json；每個 test 各自決定 ~/.claude.json 是否存在，此處先清掉。
    await writeFile(userSettingsPath(), JSON.stringify({}) + '\n');
    rmSync(globalConfigPath(), { force: true });

    svc = new SettingsFileService();
  });

  /* ═══════ getSettings('user') 合併 ═══════ */

  it('getSettings("user")：~/.claude.json 有值 → 覆蓋進回傳物件（不用管 mcpServers/oauthAccount 是否出現）', async () => {
    await writeFile(globalConfigPath(), JSON.stringify({
      autoConnectIde: true,
      diffTool: 'terminal',
      mcpServers: { foo: { command: 'x' } },
      oauthAccount: { id: 'abc' },
    }) + '\n');
    await writeFile(userSettingsPath(), JSON.stringify({ model: 'x' }) + '\n');

    const result = await svc.getSettings('user');
    expect(result.autoConnectIde).toBe(true);
    expect(result.diffTool).toBe('terminal');
    expect(result.model).toBe('x');
  });

  it('getSettings("user")：settings.json 殘留舊值，~/.claude.json 缺該 key → 回傳 undefined（不是殘留值）', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ autoConnectIde: false }) + '\n');
    await writeFile(globalConfigPath(), JSON.stringify({}) + '\n');

    const result = await svc.getSettings('user');
    expect(result.autoConnectIde).toBeUndefined();
  });

  it('getSettings("user")：~/.claude.json 不存在 → 不拋錯，7 個 key 均為 undefined，其餘欄位正常回傳', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ model: 'x', autoConnectIde: true }) + '\n');
    // globalConfigPath 已於 beforeEach 移除

    const result = await svc.getSettings('user');
    expect(result.model).toBe('x');
    for (const key of getGlobalConfigSettingKeys()) {
      expect(result[key]).toBeUndefined();
    }
  });

  it('getSettings("project")：project settings.json 殘留 autoConnectIde → 原樣回傳（不做 global config 合併/清除）', async () => {
    mkdirSync(join(workspaceDir, '.claude'), { recursive: true });
    await writeFile(projectSettingsPath(), JSON.stringify({ autoConnectIde: true }) + '\n');

    const result = await svc.getSettings('project');
    expect(result.autoConnectIde).toBe(true);
  });

  /* ═══════ setSetting ═══════ */

  it('setSetting("user", "autoConnectIde", true)：寫入 ~/.claude.json，保留既有欄位，不寫進 settings.json', async () => {
    await writeFile(globalConfigPath(), JSON.stringify({
      mcpServers: { foo: { command: 'x' } },
    }) + '\n');

    await svc.setSetting('user', 'autoConnectIde', true);

    const globalContent = JSON.parse(await readFile(globalConfigPath(), 'utf-8'));
    expect(globalContent.autoConnectIde).toBe(true);
    expect(globalContent.mcpServers).toEqual({ foo: { command: 'x' } });

    const settingsContent = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(settingsContent.autoConnectIde).toBeUndefined();
  });

  it('setSetting("user", "autoConnectIde", true)：~/.claude.json 不存在 → reject，且不建立新檔', async () => {
    // globalConfigPath 已於 beforeEach 移除

    await expect(svc.setSetting('user', 'autoConnectIde', true)).rejects.toThrow();
    expect(existsSync(globalConfigPath())).toBe(false);
  });

  it('setSetting("user", "diffTool", "terminal")：~/.claude.json 內容非法 JSON → reject', async () => {
    await writeFile(globalConfigPath(), '{ not valid json');

    await expect(svc.setSetting('user', 'diffTool', 'terminal')).rejects.toThrow();
  });

  /* ═══════ deleteSetting ═══════ */

  it('deleteSetting("user", "diffTool")：刪除後 diffTool 消失、mcpServers 保留', async () => {
    await writeFile(globalConfigPath(), JSON.stringify({
      diffTool: 'terminal',
      mcpServers: { foo: { command: 'x' } },
    }) + '\n');

    await svc.deleteSetting('user', 'diffTool');

    const content = JSON.parse(await readFile(globalConfigPath(), 'utf-8'));
    expect(content.diffTool).toBeUndefined();
    expect(content.mcpServers).toEqual({ foo: { command: 'x' } });
  });

  it('deleteSetting("user", "diffTool")：~/.claude.json 不存在 → no-op（resolve 不拋錯，不建立檔案）', async () => {
    // globalConfigPath 已於 beforeEach 移除

    await expect(svc.deleteSetting('user', 'diffTool')).resolves.toBeUndefined();
    expect(existsSync(globalConfigPath())).toBe(false);
  });

  it('deleteSetting("user", "diffTool")：key 不存在於 config 中 → no-op（不寫檔，內容不變）', async () => {
    const original = JSON.stringify({ autoConnectIde: true }) + '\n';
    await writeFile(globalConfigPath(), original);

    await svc.deleteSetting('user', 'diffTool');

    const after = await readFile(globalConfigPath(), 'utf-8');
    expect(after).toBe(original);
  });

  /* ═══════ 對照組：防止過度分流 ═══════ */

  it('setSetting("project", "autoConnectIde", true)：非 user scope → 走原本 settings.json 寫入路徑，不動 ~/.claude.json', async () => {
    await svc.setSetting('project', 'autoConnectIde', true);

    const content = JSON.parse(await readFile(projectSettingsPath(), 'utf-8'));
    expect(content.autoConnectIde).toBe(true);
    expect(existsSync(globalConfigPath())).toBe(false);
  });

  it('setSetting("user", "model", "x")：非 globalConfig key → 走原本 settings.json 寫入路徑，不動 ~/.claude.json', async () => {
    await svc.setSetting('user', 'model', 'x');

    const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
    expect(content.model).toBe('x');
    expect(existsSync(globalConfigPath())).toBe(false);
  });
});
