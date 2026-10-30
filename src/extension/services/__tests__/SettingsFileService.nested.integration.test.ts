/**
 * #33 SettingsFileService 巢狀子欄位寫入、讀取排隊（F4a）、ensureSettingsFile（E4）整合測試。
 * 用真實 filesystem（tmpdir）；jsonFile 以 passthrough spy 包住，需要製造延遲時才換成卡住的實作。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfs-nested-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

/* 保存真實 jsonFile 實作，供各 test 換回 passthrough 或包一層延遲 */
const holder = vi.hoisted(() => ({ actual: null as unknown as typeof import('../../utils/jsonFile') }));

vi.mock('../../utils/jsonFile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/jsonFile')>();
  holder.actual = actual;
  return {
    ...actual,
    readJsonFile: vi.fn(actual.readJsonFile),
    writeJsonFileAtomic: vi.fn(actual.writeJsonFileAtomic),
  };
});

import * as jsonFile from '../../utils/jsonFile';
import { SettingsFileService } from '../SettingsFileService';

const writeSpy = vi.mocked(jsonFile.writeJsonFileAtomic);
const readSpy = vi.mocked(jsonFile.readJsonFile);

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

/** 可由測試手動放行的 promise */
function gate(): { promise: Promise<void>; release: () => void } {
  let release!: () => void;
  const promise = new Promise<void>((r) => { release = r; });
  return { promise, release };
}

/** 讓佇列外的錯誤實作有時間先跑完 */
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

describe('SettingsFileService 巢狀子欄位與讀寫排隊（#33 integration）', () => {
  let svc: SettingsFileService;
  let workspaceDir: string;
  let testIdx = 0;

  const userSettingsPath = () => join(SUITE_HOME, '.claude', 'settings.json');
  const globalConfigPath = () => join(SUITE_HOME, '.claude.json');
  const projectSettingsPath = () => join(workspaceDir, '.claude', 'settings.json');
  const readJson = async (p: string) => JSON.parse(await readFile(p, 'utf-8')) as Record<string, unknown>;

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-nested-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });
    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    writeSpy.mockReset();
    writeSpy.mockImplementation(holder.actual.writeJsonFileAtomic);
    readSpy.mockReset();
    readSpy.mockImplementation(holder.actual.readJsonFile);

    await writeFile(userSettingsPath(), JSON.stringify({}) + '\n');
    rmSync(globalConfigPath(), { force: true });

    svc = new SettingsFileService();
  });

  /* ═══════ AC3：同父物件兩個子欄位並行 ═══════ */

  it('AC3：不 await 連發兩筆 setNestedSetting(permissions) → 兩個子欄位都留在檔案，其他欄位不動', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({
      model: 'opus',
      permissions: { allow: ['Bash(ls)'] },
    }) + '\n');

    await Promise.all([
      svc.setNestedSetting('user', 'permissions', 'defaultMode', 'plan'),
      svc.setNestedSetting('user', 'permissions', 'disableAutoMode', 'disable'),
    ]);

    expect(await readJson(userSettingsPath())).toEqual({
      model: 'opus',
      permissions: { allow: ['Bash(ls)'], defaultMode: 'plan', disableAutoMode: 'disable' },
    });
  });

  it('AC3 對照：兩筆各帶舊父物件的整包 setSetting → 第一筆的子欄位遺失（整包寫入最後寫入者勝）', async () => {
    const stale = { allow: ['Bash(ls)'] };
    await Promise.all([
      svc.setSetting('user', 'permissions', { ...stale, defaultMode: 'plan' }),
      svc.setSetting('user', 'permissions', { ...stale, disableAutoMode: 'disable' }),
    ]);

    const perms = (await readJson(userSettingsPath())).permissions as Record<string, unknown>;
    expect(perms.disableAutoMode).toBe('disable');
    expect(perms.defaultMode).toBeUndefined();
  });

  it('父 key 缺席 → 建立 { 子欄位: 值 }（project scope 自動建目錄）', async () => {
    await svc.setNestedSetting('project', 'remote', 'defaultEnvironmentId', 'env-1');
    expect(await readJson(projectSettingsPath())).toEqual({ remote: { defaultEnvironmentId: 'env-1' } });
  });

  it('setNestedSetting 以檔案最新內容為準：外部已改的其他子欄位保留', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ remote: { x: 1 } }) + '\n');
    await svc.setNestedSetting('user', 'remote', 'defaultEnvironmentId', 'env-1');
    expect(await readJson(userSettingsPath())).toEqual({ remote: { x: 1, defaultEnvironmentId: 'env-1' } });
  });

  /* ═══════ AC5：deleteNested 刪空父物件 ═══════ */

  it('AC5：deleteNested 刪掉唯一子欄位 → 檔案沒有父 key（不留 {}）', async () => {
    mkdirSync(join(workspaceDir, '.claude'), { recursive: true });
    await writeFile(projectSettingsPath(), JSON.stringify({
      model: 'x',
      remote: { defaultEnvironmentId: 'env-1' },
    }) + '\n');

    await svc.deleteNestedSetting('project', 'remote', 'defaultEnvironmentId');

    const file = await readJson(projectSettingsPath());
    expect(file).toEqual({ model: 'x' });
    expect('remote' in file).toBe(false);
  });

  it('AC5（env）：刪掉最後一個變數 → 檔案沒有 env key', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ env: { ONLY: '1' } }) + '\n');
    await svc.deleteNestedSetting('user', 'env', 'ONLY');
    expect('env' in (await readJson(userSettingsPath()))).toBe(false);
  });

  it('AC5：父物件還有其他子欄位 → 只刪該子欄位，其餘保留', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({
      remote: { defaultEnvironmentId: 'env-1', x: 1 },
    }) + '\n');
    await svc.deleteNestedSetting('user', 'remote', 'defaultEnvironmentId');
    expect(await readJson(userSettingsPath())).toEqual({ remote: { x: 1 } });
  });

  it('AC5：父 key 不存在 → 不寫檔', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ model: 'x' }) + '\n');
    await svc.deleteNestedSetting('user', 'remote', 'defaultEnvironmentId');
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('AC5：子 key 不存在 → 不寫檔', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ remote: { x: 1 } }) + '\n');
    await svc.deleteNestedSetting('user', 'remote', 'defaultEnvironmentId');
    expect(writeSpy).not.toHaveBeenCalled();
  });

  /* ═══════ X33（F3a）：檔案內父 key 形狀不符 ═══════ */

  it.each([
    ['字串', 'x'],
    ['null', null],
    ['陣列', []],
  ])('X33：檔案內 permissions 為%s → setNestedSetting 拒絕、檔案不變', async (_label, parent) => {
    const raw = JSON.stringify({ permissions: parent }) + '\n';
    await writeFile(userSettingsPath(), raw);

    await expect(svc.setNestedSetting('user', 'permissions', 'defaultMode', 'plan')).rejects.toThrow();
    expect(await readFile(userSettingsPath(), 'utf-8')).toBe(raw);
  });

  it('X33：拒絕後同檔佇列照常繼續', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ permissions: 'x' }) + '\n');
    const bad = svc.setNestedSetting('user', 'permissions', 'defaultMode', 'plan');
    const good = svc.setSetting('user', 'model', 'opus');
    await expect(bad).rejects.toThrow();
    await good;
    expect((await readJson(userSettingsPath())).model).toBe('opus');
  });

  /* ═══════ #34：permissions 清單單條加刪 ═══════ */

  it('R6（#34）：不 await 連發兩筆 addPermissionsListItem，各帶不同規則 → 兩條都在，其他欄位不動', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({
      model: 'opus',
      permissions: { allow: ['Bash(ls)'] },
    }) + '\n');

    await Promise.all([
      svc.addPermissionsListItem('user', 'allow', 'WebFetch'),
      svc.addPermissionsListItem('user', 'allow', 'WebSearch'),
    ]);

    expect(await readJson(userSettingsPath())).toEqual({
      model: 'opus',
      permissions: { allow: ['Bash(ls)', 'WebFetch', 'WebSearch'] },
    });
  });

  it('R6b（#34）：同一條 WebFetch 不 await 連發兩次 add → 檔案只有一個 WebFetch', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }) + '\n');

    await Promise.all([
      svc.addPermissionsListItem('user', 'allow', 'WebFetch'),
      svc.addPermissionsListItem('user', 'allow', 'WebFetch'),
    ]);

    expect((await readJson(userSettingsPath())).permissions).toEqual({ allow: ['Bash(ls)', 'WebFetch'] });
  });

  it.each(['allow', 'deny', 'ask', 'additionalDirectories'] as const)(
    '#34：setNestedSetting(permissions, %s) 整份清單寫入 → reject、檔案內容不變',
    async (listKey) => {
      const raw = JSON.stringify({ model: 'opus', permissions: { [listKey]: ['Read'] } }) + '\n';
      await writeFile(userSettingsPath(), raw);
      writeSpy.mockClear();

      await expect(svc.setNestedSetting('user', 'permissions', listKey as never, ['Bash'])).rejects.toThrow(
        new RegExp(listKey),
      );

      expect(writeSpy).not.toHaveBeenCalled();
      expect(await readFile(userSettingsPath(), 'utf-8')).toBe(raw);
      expect((await readJson(userSettingsPath())).permissions).toEqual({ [listKey]: ['Read'] });
    },
  );

  it('#34：permissions.defaultMode 與 env 底下名為 allow 的變數 → setNestedSetting 照舊寫入', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ permissions: { allow: ['Read'] } }) + '\n');

    await svc.setNestedSetting('user', 'permissions', 'defaultMode', 'plan');
    await svc.setNestedSetting('user', 'env', 'allow', 'yes');

    expect(await readJson(userSettingsPath())).toEqual({
      permissions: { allow: ['Read'], defaultMode: 'plan' },
      env: { allow: 'yes' },
    });
  });

  it('R5a（#34 P4）：檔案有 X → 不 await 連發 remove(X)、add(X) → 後到的 add 生效，X 在', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ permissions: { allow: ['X'] } }) + '\n');

    await Promise.all([
      svc.removePermissionsListItem('user', 'allow', 'X'),
      svc.addPermissionsListItem('user', 'allow', 'X'),
    ]);

    expect((await readJson(userSettingsPath())).permissions).toEqual({ allow: ['X'] });
  });

  it('R5b（#34 P4）：檔案沒有 X → 不 await 連發 add(X)、remove(X) → 後到的 remove 生效，X 不在', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }) + '\n');

    await Promise.all([
      svc.addPermissionsListItem('user', 'allow', 'X'),
      svc.removePermissionsListItem('user', 'allow', 'X'),
    ]);

    expect((await readJson(userSettingsPath())).permissions).toEqual({ allow: ['Bash(ls)'] });
  });

  it.each(['allow', 'deny', 'ask', 'additionalDirectories'] as const)(
    '#34：%s 的 add 以檔案最新內容為準（外部已改的其他清單與子欄位保留）',
    async (listKey) => {
      await writeFile(userSettingsPath(), JSON.stringify({
        permissions: { defaultMode: 'plan', [listKey]: ['a'] },
      }) + '\n');

      await svc.addPermissionsListItem('user', listKey, 'b');

      expect((await readJson(userSettingsPath())).permissions).toEqual({ defaultMode: 'plan', [listKey]: ['a', 'b'] });
    },
  );

  it('#34：permissions 缺席 → add 建立 permissions.allow（project scope 自動建目錄）', async () => {
    await svc.addPermissionsListItem('project', 'allow', 'WebFetch');
    expect(await readJson(projectSettingsPath())).toEqual({ permissions: { allow: ['WebFetch'] } });
  });

  it('#34：remove 刪到空 → 檔案留 allow: []（不刪 key）', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ permissions: { allow: ['X'] } }) + '\n');
    await svc.removePermissionsListItem('user', 'allow', 'X');
    expect(await readJson(userSettingsPath())).toEqual({ permissions: { allow: [] } });
  });

  it('#34：remove 時清單或 permissions 不存在 → 不寫檔、不建立 key', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ model: 'x' }) + '\n');
    writeSpy.mockClear();
    await svc.removePermissionsListItem('user', 'allow', 'X');
    expect(writeSpy).not.toHaveBeenCalled();
    expect(await readJson(userSettingsPath())).toEqual({ model: 'x' });

    await writeFile(userSettingsPath(), JSON.stringify({ permissions: { defaultMode: 'plan' } }) + '\n');
    await svc.removePermissionsListItem('user', 'allow', 'X');
    expect(writeSpy).not.toHaveBeenCalled();
    expect(await readJson(userSettingsPath())).toEqual({ permissions: { defaultMode: 'plan' } });
  });

  it('#34：清單內沒有該條 → remove 不寫檔', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }) + '\n');
    writeSpy.mockClear();
    await svc.removePermissionsListItem('user', 'allow', 'X');
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('#34：檔案內 allow 為字串 → add／remove 拒絕、檔案不變，佇列照常繼續', async () => {
    const raw = JSON.stringify({ permissions: { allow: 'x' } }) + '\n';
    await writeFile(userSettingsPath(), raw);

    const badAdd = svc.addPermissionsListItem('user', 'allow', 'X');
    const badRemove = svc.removePermissionsListItem('user', 'allow', 'X');
    const good = svc.setSetting('user', 'model', 'opus');
    await expect(badAdd).rejects.toThrow();
    await expect(badRemove).rejects.toThrow();
    await good;

    expect(await readJson(userSettingsPath())).toEqual({ permissions: { allow: 'x' }, model: 'opus' });
  });

  it('#34：檔案內 permissions 為字串 → add 拒絕、檔案不變', async () => {
    const raw = JSON.stringify({ permissions: 'x' }) + '\n';
    await writeFile(userSettingsPath(), raw);
    await expect(svc.addPermissionsListItem('user', 'allow', 'X')).rejects.toThrow();
    expect(await readFile(userSettingsPath(), 'utf-8')).toBe(raw);
  });

  it('R6e 基礎（#34）：寫入卡住時發出 getSettings → get 等 add 完成、結果含新條目', async () => {
    const g = gate();
    writeSpy.mockImplementationOnce(async (p, data) => {
      await g.promise;
      return holder.actual.writeJsonFileAtomic(p, data);
    });

    const write = svc.addPermissionsListItem('user', 'allow', 'WebFetch');
    const read = svc.getSettings('user');
    await settle();
    g.release();

    await write;
    expect((await read).permissions).toEqual({ allow: ['WebFetch'] });
  });

  /* ═══════ I3：globalConfig 父 key 明確拋錯 ═══════ */

  it('I3：user scope 以 globalConfig key 當父 key → setNested／deleteNested 拋錯，兩個檔都不動', async () => {
    const globalRaw = JSON.stringify({ autoConnectIde: { a: 1 } }) + '\n';
    await writeFile(globalConfigPath(), globalRaw);
    const userRaw = await readFile(userSettingsPath(), 'utf-8');

    await expect(svc.setNestedSetting('user', 'autoConnectIde', 'x', 1)).rejects.toThrow();
    await expect(svc.deleteNestedSetting('user', 'autoConnectIde', 'a')).rejects.toThrow();

    expect(await readFile(globalConfigPath(), 'utf-8')).toBe(globalRaw);
    expect(await readFile(userSettingsPath(), 'utf-8')).toBe(userRaw);
  });

  /* ═══════ F4a：讀取排進同檔佇列 ═══════ */

  it('X17：寫入卡住時發出 getSettings → get 等寫入完成、結果含新值', async () => {
    const g = gate();
    writeSpy.mockImplementationOnce(async (p, data) => {
      await g.promise;
      return holder.actual.writeJsonFileAtomic(p, data);
    });

    const write = svc.setSetting('user', 'model', 'opus');
    const read = svc.getSettings('user');
    await settle();
    g.release();

    await write;
    expect((await read).model).toBe('opus');
  });

  it('X17u：getSettings(user) 的 ~/.claude.json 讀取延遲中發出 user 寫入 → get 先完成且不含新值', async () => {
    await writeFile(globalConfigPath(), JSON.stringify({ autoConnectIde: true }) + '\n');
    const g = gate();
    readSpy.mockImplementation(async (p, def) => {
      if (p === globalConfigPath()) await g.promise;
      return holder.actual.readJsonFile(p, def);
    });

    const order: string[] = [];
    const read = svc.getSettings('user').then((r) => { order.push('get'); return r; });
    const write = svc.setSetting('user', 'sandbox', { enabled: true }).then(() => { order.push('set'); });
    await settle();
    g.release();

    const result = await read;
    await write;
    expect(order).toEqual(['get', 'set']);
    expect(result.sandbox).toBeUndefined();
    expect(result.autoConnectIde).toBe(true);
    expect((await readJson(userSettingsPath())).sandbox).toEqual({ enabled: true });
  });

  it('X34：globalConfig 寫入卡住期間 getSettings(user) → 放行後 get 完成（不死結）且含新值', async () => {
    await writeFile(globalConfigPath(), JSON.stringify({ autoConnectIde: false }) + '\n');
    const g = gate();
    writeSpy.mockImplementationOnce(async (p, data) => {
      await g.promise;
      return holder.actual.writeJsonFileAtomic(p, data);
    });

    const write = svc.setGlobalConfigSetting('autoConnectIde', true);
    const read = svc.getSettings('user');
    await settle();
    g.release();

    await write;
    expect((await read).autoConnectIde).toBe(true);
  });

  /* ═══════ E4：ensureSettingsFile ═══════ */

  it('E4：檔案不存在 → 建目錄並寫入 { $schema, hooks: {} }（格式同現行）', async () => {
    await svc.ensureSettingsFile('project');
    expect(await readFile(projectSettingsPath(), 'utf-8')).toBe(JSON.stringify({
      $schema: 'https://json.schemastore.org/claude-code-settings.json',
      hooks: {},
    }, null, 2) + '\n');
  });

  it('E4：檔案已存在 → 不覆寫', async () => {
    mkdirSync(join(workspaceDir, '.claude'), { recursive: true });
    const raw = JSON.stringify({ model: 'x' }) + '\n';
    await writeFile(projectSettingsPath(), raw);

    await svc.ensureSettingsFile('project');

    expect(await readFile(projectSettingsPath(), 'utf-8')).toBe(raw);
  });

  it('X30：檔案不存在、寫入排隊中緊接 ensureSettingsFile → ensure 完成時檔案已含剛存的 key，且 ensure 不另寫檔', async () => {
    expect(existsSync(projectSettingsPath())).toBe(false);
    const g = gate();
    writeSpy.mockImplementationOnce(async (p, data) => {
      await g.promise;
      return holder.actual.writeJsonFileAtomic(p, data);
    });

    const write = svc.setSetting('project', 'x', 1);
    const ensured = svc.ensureSettingsFile('project').then(() => readJson(projectSettingsPath()));
    await settle();
    g.release();

    await write;
    expect((await ensured).x).toBe(1);
    expect((await readJson(projectSettingsPath())).x).toBe(1);
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });
});
