/**
 * SettingsFileService — General Settings 欄位讀寫整合測試。
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfs-general-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { SettingsFileService } from '../SettingsFileService';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

const BOOLEAN_FIELDS = [
  'enableAllProjectMcpServers',
  'includeGitInstructions',
  'respectGitignore',
  'fastMode',
  'alwaysThinkingEnabled',
] as const;

describe('SettingsFileService — general settings（integration）', () => {
  let svc: SettingsFileService;
  let workspaceDir: string;
  let testIdx = 0;

  const userSettingsPath = () => join(SUITE_HOME, '.claude', 'settings.json');

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-general-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    await writeFile(userSettingsPath(), JSON.stringify({}) + '\n');
    svc = new SettingsFileService();
  });

  // ---------------------------------------------------------------------------
  // project scope（自動建立 .claude/ 目錄）
  // ---------------------------------------------------------------------------

  it('project scope：setSetting fastMode true → 自動建立 .claude/ 目錄並寫入', async () => {
    await svc.setSetting('project', 'fastMode', true);

    const projectSettingsPath = join(workspaceDir, '.claude', 'settings.json');
    const content = JSON.parse(await readFile(projectSettingsPath, 'utf-8'));
    expect(content.fastMode).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Boolean fields
  // ---------------------------------------------------------------------------

  describe.each(BOOLEAN_FIELDS)('%s（boolean）', (field) => {
    it('setSetting true → JSON 寫入 true', async () => {
      await svc.setSetting('user', field, true);
      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content[field]).toBe(true);
    });

    it('deleteSetting → JSON 移除欄位，其他欄位不受影響', async () => {
      await writeFile(userSettingsPath(), JSON.stringify({ [field]: true, model: 'claude-sonnet-4-6' }) + '\n');
      svc = new SettingsFileService();

      await svc.deleteSetting('user', field);

      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content[field]).toBeUndefined();
      expect(content.model).toBe('claude-sonnet-4-6');
    });

    it('round-trip：setSetting → getSettings → deleteSetting → getSettings undefined', async () => {
      await svc.setSetting('user', field, true);
      expect((await svc.getSettings('user'))[field]).toBe(true);

      await svc.deleteSetting('user', field);
      expect((await svc.getSettings('user'))[field]).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // effortLevel
  // ---------------------------------------------------------------------------

  describe('effortLevel', () => {
    it.each(['high', 'medium', 'low'] as const)('setSetting "%s" → JSON 寫入', async (val) => {
      await svc.setSetting('user', 'effortLevel', val);
      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.effortLevel).toBe(val);
    });

    it('未知值 "max" 直接寫入（service 不驗證）', async () => {
      await svc.setSetting('user', 'effortLevel', 'max');
      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.effortLevel).toBe('max');
    });

    it('deleteSetting → 移除欄位', async () => {
      await writeFile(userSettingsPath(), JSON.stringify({ effortLevel: 'high' }) + '\n');
      svc = new SettingsFileService();

      await svc.deleteSetting('user', 'effortLevel');

      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.effortLevel).toBeUndefined();
    });

    it('getSettings 讀回正確值', async () => {
      await writeFile(userSettingsPath(), JSON.stringify({ effortLevel: 'low' }) + '\n');
      svc = new SettingsFileService();

      const data = await svc.getSettings('user');
      expect(data.effortLevel).toBe('low');
    });

    it('round-trip：set medium → get → delete → get undefined', async () => {
      await svc.setSetting('user', 'effortLevel', 'medium');
      expect((await svc.getSettings('user')).effortLevel).toBe('medium');

      await svc.deleteSetting('user', 'effortLevel');
      expect((await svc.getSettings('user')).effortLevel).toBeUndefined();
    });

    it('覆寫：high → low', async () => {
      await svc.setSetting('user', 'effortLevel', 'high');
      await svc.setSetting('user', 'effortLevel', 'low');
      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.effortLevel).toBe('low');
    });
  });

  // ---------------------------------------------------------------------------
  // outputStyle
  // ---------------------------------------------------------------------------

  describe('outputStyle', () => {
    it.each(['auto', 'stream-json'] as const)('setSetting "%s" → JSON 寫入', async (val) => {
      await svc.setSetting('user', 'outputStyle', val);
      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.outputStyle).toBe(val);
    });

    it('未知值直接寫入（service 不驗證）', async () => {
      await svc.setSetting('user', 'outputStyle', 'unknown-val');
      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.outputStyle).toBe('unknown-val');
    });

    it('deleteSetting → 移除欄位', async () => {
      await writeFile(userSettingsPath(), JSON.stringify({ outputStyle: 'auto' }) + '\n');
      svc = new SettingsFileService();

      await svc.deleteSetting('user', 'outputStyle');

      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.outputStyle).toBeUndefined();
    });

    it('round-trip', async () => {
      await svc.setSetting('user', 'outputStyle', 'stream-json');
      expect((await svc.getSettings('user')).outputStyle).toBe('stream-json');

      await svc.deleteSetting('user', 'outputStyle');
      expect((await svc.getSettings('user')).outputStyle).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // language
  // ---------------------------------------------------------------------------

  describe('language', () => {
    it('setSetting string → JSON 寫入', async () => {
      await svc.setSetting('user', 'language', '台灣繁體中文');
      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.language).toBe('台灣繁體中文');
    });

    it('getSettings 讀回 language', async () => {
      await writeFile(userSettingsPath(), JSON.stringify({ language: 'zh-TW' }) + '\n');
      svc = new SettingsFileService();

      const data = await svc.getSettings('user');
      expect(data.language).toBe('zh-TW');
    });

    it('deleteSetting → 移除欄位，其他欄位不受影響', async () => {
      await writeFile(userSettingsPath(), JSON.stringify({ language: 'en', model: 'x' }) + '\n');
      svc = new SettingsFileService();

      await svc.deleteSetting('user', 'language');

      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.language).toBeUndefined();
      expect(content.model).toBe('x');
    });

    it('空字串：service 不攔截，直接寫入', async () => {
      await svc.setSetting('user', 'language', '');
      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.language).toBe('');
    });

    it('round-trip', async () => {
      await svc.setSetting('user', 'language', 'ja');
      expect((await svc.getSettings('user')).language).toBe('ja');

      await svc.deleteSetting('user', 'language');
      expect((await svc.getSettings('user')).language).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // availableModels
  // ---------------------------------------------------------------------------

  describe('availableModels', () => {
    it('setSetting 陣列 → JSON 寫入', async () => {
      await svc.setSetting('user', 'availableModels', ['claude-sonnet-4-6', 'claude-opus-4-6']);
      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.availableModels).toEqual(['claude-sonnet-4-6', 'claude-opus-4-6']);
    });

    it('getSettings 讀回陣列', async () => {
      await writeFile(userSettingsPath(), JSON.stringify({ availableModels: ['claude-haiku-4-5-20251001'] }) + '\n');
      svc = new SettingsFileService();

      const data = await svc.getSettings('user');
      expect(data.availableModels).toEqual(['claude-haiku-4-5-20251001']);
    });

    it('空陣列保留（不為 undefined）', async () => {
      await svc.setSetting('user', 'availableModels', []);
      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.availableModels).toEqual([]);
    });

    it('空陣列 getSettings 回傳 []', async () => {
      await writeFile(userSettingsPath(), JSON.stringify({ availableModels: [] }) + '\n');
      svc = new SettingsFileService();

      const data = await svc.getSettings('user');
      expect(data.availableModels).toEqual([]);
    });

    it('deleteSetting → 移除欄位', async () => {
      await writeFile(userSettingsPath(), JSON.stringify({ availableModels: ['x'] }) + '\n');
      svc = new SettingsFileService();

      await svc.deleteSetting('user', 'availableModels');

      const content = JSON.parse(await readFile(userSettingsPath(), 'utf-8'));
      expect(content.availableModels).toBeUndefined();
    });

    it('round-trip：set → get → delete → get undefined', async () => {
      await svc.setSetting('user', 'availableModels', ['a', 'b']);
      expect((await svc.getSettings('user')).availableModels).toEqual(['a', 'b']);

      await svc.deleteSetting('user', 'availableModels');
      expect((await svc.getSettings('user')).availableModels).toBeUndefined();
    });
  });
});
