/**
 * Settings CRUD E2E 測試。
 * MessageRouter → SettingsFileService → 真實 filesystem。
 * 覆蓋 settings.set / settings.get / settings.delete 完整路徑。
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-settings-crud-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

import { MessageRouter } from '../MessageRouter';
import { SettingsFileService } from '../../services/SettingsFileService';
import type { PluginService } from '../../services/PluginService';
import type { MarketplaceService } from '../../services/MarketplaceService';
import type { McpService } from '../../services/McpService';
import type { TranslationService } from '../../services/TranslationService';
import type { HookExplanationService } from '../../services/HookExplanationService';
import type { ExtensionInfoService } from '../../services/ExtensionInfoService';
import type { RequestMessage, ResponseMessage } from '../protocol';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

/** 空殼 stub services（settings CRUD 不需要這些） */
function createStubServices() {
  return {
    marketplace: { list: vi.fn() } as unknown as MarketplaceService,
    plugin: { listInstalled: vi.fn() } as unknown as PluginService,
    mcp: { listFromFiles: vi.fn() } as unknown as McpService,
    translation: { translate: vi.fn() } as unknown as TranslationService,
    hookExplanation: { explain: vi.fn() } as unknown as HookExplanationService,
    extensionInfo: { getInfo: vi.fn() } as unknown as ExtensionInfoService,
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

describe('Settings CRUD（E2E：MessageRouter → SettingsFileService → Filesystem）', () => {
  let router: MessageRouter;
  let settingsSvc: SettingsFileService;
  let workspaceDir: string;
  let testIdx = 0;

  const userSettingsPath = join(SUITE_HOME, '.claude', 'settings.json');
  const projectSettingsPath = () => join(workspaceDir, '.claude', 'settings.json');
  const localSettingsPath = () => join(workspaceDir, '.claude', 'settings.local.json');

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-settings-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    // 每次測試從乾淨的 user settings 開始
    await writeFile(userSettingsPath, '{}');

    settingsSvc = new SettingsFileService();
    const stubs = createStubServices();
    router = new MessageRouter(
      stubs.marketplace,
      stubs.plugin,
      stubs.mcp,
      stubs.translation,
      settingsSvc,
      stubs.hookExplanation,
      stubs.extensionInfo,
    );
  });

  /* ══════════════════════════════════════════════════════
     user scope round-trip
     ══════════════════════════════════════════════════════ */

  describe('user scope', () => {
    it('set → get 驗證值存在', async () => {
      const setRes = await send(router, {
        type: 'settings.set',
        scope: 'user',
        key: 'language',
        value: 'zh-TW',
      });
      expect(setRes.type).toBe('response');

      const getRes = await send(router, { type: 'settings.get', scope: 'user' });
      expect(getRes.type).toBe('response');
      expect((getRes as any).data.language).toBe('zh-TW');
    });

    it('set → delete → get 驗證 key 已移除', async () => {
      await send(router, {
        type: 'settings.set',
        scope: 'user',
        key: 'language',
        value: 'en',
      });

      const delRes = await send(router, {
        type: 'settings.delete',
        scope: 'user',
        key: 'language',
      });
      expect(delRes.type).toBe('response');

      const getRes = await send(router, { type: 'settings.get', scope: 'user' });
      expect((getRes as any).data.language).toBeUndefined();
    });

    it('set 寫入磁碟可直接讀取驗證', async () => {
      await send(router, {
        type: 'settings.set',
        scope: 'user',
        key: 'effortLevel',
        value: 'high',
      });

      const raw = await readFile(userSettingsPath, 'utf-8');
      expect(JSON.parse(raw).effortLevel).toBe('high');
    });

    it('delete 不存在的 key → no-op，不報錯', async () => {
      const res = await send(router, {
        type: 'settings.delete',
        scope: 'user',
        key: 'nonExistentKey',
      });
      expect(res.type).toBe('response');
    });

    it('多個 key 依序 set → get 全部存在', async () => {
      await send(router, { type: 'settings.set', scope: 'user', key: 'language', value: 'en' });
      await send(router, { type: 'settings.set', scope: 'user', key: 'effortLevel', value: 'low' });
      await send(router, { type: 'settings.set', scope: 'user', key: 'fastMode', value: true });

      const getRes = await send(router, { type: 'settings.get', scope: 'user' });
      const data = (getRes as any).data;
      expect(data.language).toBe('en');
      expect(data.effortLevel).toBe('low');
      expect(data.fastMode).toBe(true);
    });

    it('覆寫既有 key → 回傳新值', async () => {
      await send(router, { type: 'settings.set', scope: 'user', key: 'language', value: 'en' });
      await send(router, { type: 'settings.set', scope: 'user', key: 'language', value: 'ja' });

      const getRes = await send(router, { type: 'settings.get', scope: 'user' });
      expect((getRes as any).data.language).toBe('ja');
    });
  });

  /* ══════════════════════════════════════════════════════
     project scope round-trip
     ══════════════════════════════════════════════════════ */

  describe('project scope', () => {
    it('set → get 驗證值（自動建立 .claude/）', async () => {
      const setRes = await send(router, {
        type: 'settings.set',
        scope: 'project',
        key: 'language',
        value: 'zh',
      });
      expect(setRes.type).toBe('response');

      const getRes = await send(router, { type: 'settings.get', scope: 'project' });
      expect((getRes as any).data.language).toBe('zh');
    });

    it('set → delete → get 驗證 key 已刪除', async () => {
      await send(router, { type: 'settings.set', scope: 'project', key: 'language', value: 'zh' });
      await send(router, { type: 'settings.delete', scope: 'project', key: 'language' });

      const getRes = await send(router, { type: 'settings.get', scope: 'project' });
      expect((getRes as any).data.language).toBeUndefined();
    });

    it('set 寫入磁碟可直接讀取驗證', async () => {
      await send(router, {
        type: 'settings.set',
        scope: 'project',
        key: 'includeGitInstructions',
        value: false,
      });

      const raw = await readFile(projectSettingsPath(), 'utf-8');
      expect(JSON.parse(raw).includeGitInstructions).toBe(false);
    });

    it('get 在 project settings 不存在時回傳空物件', async () => {
      const getRes = await send(router, { type: 'settings.get', scope: 'project' });
      expect(getRes.type).toBe('response');
      expect((getRes as any).data).toEqual({});
    });
  });

  /* ══════════════════════════════════════════════════════
     local scope round-trip
     ══════════════════════════════════════════════════════ */

  describe('local scope', () => {
    it('set → get 驗證值（寫入 settings.local.json）', async () => {
      const setRes = await send(router, {
        type: 'settings.set',
        scope: 'local',
        key: 'language',
        value: 'ja',
      });
      expect(setRes.type).toBe('response');

      const getRes = await send(router, { type: 'settings.get', scope: 'local' });
      expect((getRes as any).data.language).toBe('ja');
    });

    it('set → delete → get round-trip', async () => {
      await send(router, { type: 'settings.set', scope: 'local', key: 'fastMode', value: true });
      await send(router, { type: 'settings.delete', scope: 'local', key: 'fastMode' });

      const getRes = await send(router, { type: 'settings.get', scope: 'local' });
      expect((getRes as any).data.fastMode).toBeUndefined();
    });

    it('set 寫入 settings.local.json（非 settings.json）', async () => {
      await send(router, {
        type: 'settings.set',
        scope: 'local',
        key: 'language',
        value: 'ko',
      });

      const raw = await readFile(localSettingsPath(), 'utf-8');
      expect(JSON.parse(raw).language).toBe('ko');
    });
  });

  /* ══════════════════════════════════════════════════════
     scope 獨立性：各 scope 寫入不互相影響
     ══════════════════════════════════════════════════════ */

  describe('scope 獨立性', () => {
    it('user set → project get 回傳空（scope 隔離）', async () => {
      await send(router, { type: 'settings.set', scope: 'user', key: 'language', value: 'en' });

      const getRes = await send(router, { type: 'settings.get', scope: 'project' });
      expect((getRes as any).data.language).toBeUndefined();
    });

    it('project set → local get 回傳空（scope 隔離）', async () => {
      await send(router, { type: 'settings.set', scope: 'project', key: 'language', value: 'zh' });

      const getRes = await send(router, { type: 'settings.get', scope: 'local' });
      expect((getRes as any).data.language).toBeUndefined();
    });

    it('三 scope 各設不同值 → 各自 get 回傳自己的值', async () => {
      await send(router, { type: 'settings.set', scope: 'user', key: 'language', value: 'en' });
      await send(router, { type: 'settings.set', scope: 'project', key: 'language', value: 'zh' });
      await send(router, { type: 'settings.set', scope: 'local', key: 'language', value: 'ja' });

      const userRes = await send(router, { type: 'settings.get', scope: 'user' });
      const projectRes = await send(router, { type: 'settings.get', scope: 'project' });
      const localRes = await send(router, { type: 'settings.get', scope: 'local' });

      expect((userRes as any).data.language).toBe('en');
      expect((projectRes as any).data.language).toBe('zh');
      expect((localRes as any).data.language).toBe('ja');
    });
  });

  /* ══════════════════════════════════════════════════════
     cross-scope delete 不影響其他 scope
     settings.get 回傳 raw scope，不做跨 scope merge。
     delete 只影響被刪 scope，其他 scope 的同一 key 不受影響。
     ══════════════════════════════════════════════════════ */

  describe('cross-scope delete 隔離', () => {
    it('delete local scope → local get 後無值，project 值不受影響', async () => {
      await send(router, { type: 'settings.set', scope: 'project', key: 'language', value: 'zh' });
      await send(router, { type: 'settings.set', scope: 'local', key: 'language', value: 'ja' });

      await send(router, { type: 'settings.delete', scope: 'local', key: 'language' });

      const localRes = await send(router, { type: 'settings.get', scope: 'local' });
      expect((localRes as any).data.language).toBeUndefined();

      const projectRes = await send(router, { type: 'settings.get', scope: 'project' });
      expect((projectRes as any).data.language).toBe('zh');
    });

    it('delete project scope → project get 後無值，user 值不受影響', async () => {
      await send(router, { type: 'settings.set', scope: 'user', key: 'language', value: 'en' });
      await send(router, { type: 'settings.set', scope: 'project', key: 'language', value: 'zh' });

      await send(router, { type: 'settings.delete', scope: 'project', key: 'language' });

      const projectRes = await send(router, { type: 'settings.get', scope: 'project' });
      expect((projectRes as any).data.language).toBeUndefined();

      const userRes = await send(router, { type: 'settings.get', scope: 'user' });
      expect((userRes as any).data.language).toBe('en');
    });
  });

  /* ══════════════════════════════════════════════════════
     值型別 edge cases
     ══════════════════════════════════════════════════════ */

  describe('值型別 edge cases', () => {
    it('value = false（falsy boolean）→ 正確儲存', async () => {
      await send(router, { type: 'settings.set', scope: 'user', key: 'fastMode', value: false });

      const getRes = await send(router, { type: 'settings.get', scope: 'user' });
      expect((getRes as any).data.fastMode).toBe(false);
    });

    it('value = 0（falsy number）→ 正確儲存', async () => {
      await send(router, { type: 'settings.set', scope: 'user', key: 'cleanupPeriodDays', value: 0 });

      const getRes = await send(router, { type: 'settings.get', scope: 'user' });
      expect((getRes as any).data.cleanupPeriodDays).toBe(0);
    });

    it('value = empty string → 正確儲存', async () => {
      await send(router, { type: 'settings.set', scope: 'user', key: 'language', value: '' });

      const getRes = await send(router, { type: 'settings.get', scope: 'user' });
      expect((getRes as any).data.language).toBe('');
    });

    it('value = object → 正確儲存並回傳', async () => {
      const permissions = { allow: ['Bash(*)'], deny: [] };
      await send(router, { type: 'settings.set', scope: 'user', key: 'permissions', value: permissions });

      const getRes = await send(router, { type: 'settings.get', scope: 'user' });
      expect((getRes as any).data.permissions).toEqual(permissions);
    });

    it('value = array → 正確儲存並回傳', async () => {
      const models = ['claude-opus-4-5', 'claude-sonnet-4-5'];
      await send(router, { type: 'settings.set', scope: 'user', key: 'availableModels', value: models });

      const getRes = await send(router, { type: 'settings.get', scope: 'user' });
      expect((getRes as any).data.availableModels).toEqual(models);
    });

    it('$schema 欄位在 set 後被保留（不被清除）', async () => {
      // 先寫入含 $schema 的設定
      await writeFile(
        userSettingsPath,
        JSON.stringify({ $schema: 'https://example.com/schema.json', language: 'en' }, null, 2) + '\n',
      );

      await send(router, { type: 'settings.set', scope: 'user', key: 'fastMode', value: true });

      const raw = await readFile(userSettingsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.$schema).toBe('https://example.com/schema.json');
      expect(parsed.language).toBe('en');
      expect(parsed.fastMode).toBe(true);
    });
  });

  /* ══════════════════════════════════════════════════════
     無 workspace 的錯誤場景
     ══════════════════════════════════════════════════════ */

  describe('無 workspace 錯誤場景', () => {
    it('project scope set（無 workspace）→ 回傳 error', async () => {
      workspace.workspaceFolders = undefined;

      const res = await send(router, {
        type: 'settings.set',
        scope: 'project',
        key: 'language',
        value: 'en',
      });

      expect(res.type).toBe('error');
      expect((res as any).error).toContain('No workspace folder open');
    });

    it('local scope get（無 workspace）→ 回傳 error', async () => {
      workspace.workspaceFolders = undefined;

      const res = await send(router, { type: 'settings.get', scope: 'local' });

      expect(res.type).toBe('error');
      expect((res as any).error).toContain('No workspace folder open');
    });

    it('local scope delete（無 workspace）→ 回傳 error', async () => {
      workspace.workspaceFolders = undefined;

      const res = await send(router, {
        type: 'settings.delete',
        scope: 'local',
        key: 'language',
      });

      expect(res.type).toBe('error');
      expect((res as any).error).toContain('No workspace folder open');
    });
  });
});
