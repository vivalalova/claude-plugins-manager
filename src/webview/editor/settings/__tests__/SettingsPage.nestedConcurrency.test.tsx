/**
 * @vitest-environment jsdom
 *
 * #33 情況 2：同一父物件（permissions／remote／autoMode／env）下兩個子欄位在一次來回內先後存檔，
 * 兩筆修改都要留在設定檔（AC4）；子欄位刪到父物件變空要刪整個父 key（AC5）。
 * fake backend 依檔案分 FIFO、讀寫同隊、卡住後逐筆放行；斷言一律看 fake 最終檔案內容。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../../vscode', async () => (await import('../../../__test-utils__/fakeSettingsBackend')).fakeVscodeModule);

import { installFakeSettingsBackend, emitPush, type FakeSettingsBackend } from '../../../__test-utils__/fakeSettingsBackend';
import {
  renderSettingsPage,
  waitInitialLoad,
  switchScope,
  clickNav,
  flush,
  search,
  saveText,
  selectByName,
  selectValue,
  clickCheckboxByHint,
  envCheckbox,
  addRule,
} from '../../../__test-utils__/settingsPageHarness';

const REMOTE_JSON = 'e.g. { "defaultEnvironmentId": "env_0123abcd" }';
const REMOTE_ID = 'e.g. env_0123abcd';
const AUTO_MODE_JSON = 'e.g. { "environment": ["Source control: github.com/my-org"] }';
const LANGUAGE = 'e.g. zh-TW';

let backend: FakeSettingsBackend;

/** 以初始檔案內容開頁、等 user scope 載入完成 */
async function openUser(user: Record<string, unknown> = {}): Promise<void> {
  backend = installFakeSettingsBackend({ user });
  renderSettingsPage();
  await waitInitialLoad();
}

const waitPending = (lane: 'user' | 'project', n: number) =>
  waitFor(() => expect(backend.pending(lane)).toHaveLength(n));

const drain = async (lane: 'user' | 'project'): Promise<void> => {
  await act(async () => { await backend.unblock(lane); });
  await flush();
};

/** env 自訂變數列：改名（值不變）後按該列 Save */
function renameEnvRow(oldKey: string, newKey: string): void {
  const keyInput = screen.getByDisplayValue(oldKey);
  const row = keyInput.closest('.env-custom-row') as HTMLElement;
  fireEvent.change(keyInput, { target: { value: newKey } });
  fireEvent.click(within(row).getByRole('button', { name: 'Save' }));
}

afterEach(() => {
  cleanup();
});

describe('#33 AC4 permissions：兩個子欄位並行存檔都留在檔案', () => {
  it('X1 搜尋結果列：defaultMode 與 disableAutoMode 先後存（第一筆未回）→ 兩者都在', async () => {
    await openUser();
    search('mode');
    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Auto Mode' }));
    backend.block('user');

    selectByName('Default Mode', 'plan');
    await waitPending('user', 1);
    selectByName('Disable Auto Mode', 'disable');
    await waitPending('user', 2);
    await drain('user');

    expect(backend.file('user').permissions).toEqual({ defaultMode: 'plan', disableAutoMode: 'disable' });
  });

  it('X3 跨分頁：General 存 defaultMode 未回 → 切到 Permissions 改 disableAutoMode → 兩者都在', async () => {
    await openUser();
    backend.block('user');

    selectByName('Default Mode', 'plan');
    await waitPending('user', 1);
    clickNav('Permissions');
    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Auto Mode' }));
    selectByName('Disable Auto Mode', 'disable');
    await waitPending('user', 2);
    await drain('user');

    expect(backend.file('user').permissions).toEqual({ defaultMode: 'plan', disableAutoMode: 'disable' });
  });

  it('X2 已自訂分頁：規則清單新增 allow 規則＋defaultMode 列並行 → 兩者都在', async () => {
    await openUser({ permissions: { allow: ['Bash'], defaultMode: 'plan' } });
    clickNav('Customized');
    await waitFor(() => screen.getByRole('button', { name: 'Add Rule' }));
    backend.block('user');

    addRule('WebFetch');
    await waitPending('user', 1);
    selectByName('Default Mode', 'dontAsk');
    await waitPending('user', 2);
    await drain('user');

    expect(backend.file('user').permissions).toEqual({ allow: ['Bash', 'WebFetch'], defaultMode: 'dontAsk' });
  });

  // 接受的窗口（拍板：同一陣列子欄位跨入口並行，陣列整值最後寫入者勝）。本條宣告此行為，擋「意外做成合併」之外的變動。
  it('X26 同一陣列子欄位跨入口：權限頁加 A 未回 → 已自訂頁加 B → allow 只剩 B（宣告接受）', async () => {
    await openUser({ permissions: { allow: ['Bash'] } });
    clickNav('Permissions');
    await waitFor(() => screen.getByRole('button', { name: 'Add Rule' }));
    backend.block('user');

    addRule('WebFetch');
    await waitPending('user', 1);
    clickNav('Customized');
    await waitFor(() => screen.getByRole('button', { name: 'Add Rule' }));
    addRule('WebSearch');
    await waitPending('user', 2);
    await drain('user');

    expect(backend.file('user').permissions).toEqual({ allow: ['Bash', 'WebSearch'] });
  });

  it('X36 同父物件 deleteNested 與 setNested 交錯：清 defaultMode（唯一子欄位）後設 disableAutoMode → 檔案與畫面一致', async () => {
    await openUser({ permissions: { defaultMode: 'plan' } });
    search('mode');
    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Auto Mode' }));
    backend.block('user');

    selectByName('Default Mode', '');
    await waitPending('user', 1);
    selectByName('Disable Auto Mode', 'disable');
    await waitPending('user', 2);
    await drain('user');

    expect(backend.file('user').permissions).toEqual({ disableAutoMode: 'disable' });
    expect(selectValue('Default Mode')).toBe('');
    expect(selectValue('Disable Auto Mode')).toBe('disable');
  });
});

describe('#33 AC4 remote／autoMode：整包 JSON 與子欄位交錯', () => {
  // remote JSON 只允許 defaultEnvironmentId（schema 驗證），所以用「JSON 移除外部加的 extra」當可觀察的 JSON 內容：
  // 子欄位那筆若帶舊父物件整包寫回，extra 會復活。
  it('X5：先存 remote JSON（移除 extra，未回）再存 defaultEnvironmentId → JSON 內容保留並換上新 id', async () => {
    await openUser({ remote: { defaultEnvironmentId: 'env-0', extra: 1 } });
    clickNav('Advanced');
    await waitFor(() => screen.getByPlaceholderText(REMOTE_ID));
    backend.block('user');

    saveText(REMOTE_JSON, '{"defaultEnvironmentId":"env-0"}');
    await waitPending('user', 1);
    saveText(REMOTE_ID, 'env-1');
    await waitPending('user', 2);
    await drain('user');

    expect(backend.file('user').remote).toEqual({ defaultEnvironmentId: 'env-1' });
  });

  // 守門（現況綠）：整包 JSON 後到 → 最後寫入者勝（票面已定，不合併）。
  it('X5r：先存 defaultEnvironmentId 再存 remote JSON → JSON 整包勝', async () => {
    await openUser();
    clickNav('Advanced');
    await waitFor(() => screen.getByPlaceholderText(REMOTE_ID));
    backend.block('user');

    saveText(REMOTE_ID, 'env-1');
    await waitPending('user', 1);
    saveText(REMOTE_JSON, '{"defaultEnvironmentId":"env-9"}');
    await waitPending('user', 2);
    await drain('user');

    expect(backend.file('user').remote).toEqual({ defaultEnvironmentId: 'env-9' });
  });

  it('X6 已自訂分頁：先存 autoMode JSON（未回）再切 classifyAllShell → JSON 其他欄位保留', async () => {
    await openUser({ autoMode: { classifyAllShell: false } });
    clickNav('Customized');
    await waitFor(() => screen.getByPlaceholderText(AUTO_MODE_JSON));
    backend.block('user');

    saveText(AUTO_MODE_JSON, '{"classifyAllShell":false,"environment":["e"]}');
    await waitPending('user', 1);
    clickCheckboxByHint('(classifyAllShell: false)');
    await waitPending('user', 2);
    await drain('user');

    expect(backend.file('user').autoMode).toEqual({ classifyAllShell: true, environment: ['e'] });
  });

  it('X32：畫面上的 remote 是字串、檔案已被外部改成 {} → 存 id 不白屏、重新讀檔後顯示新值', async () => {
    await openUser({ remote: 'x' });
    clickNav('Advanced');
    await waitFor(() => screen.getByPlaceholderText(REMOTE_ID));
    backend.setFile('user', {});
    const userGets = () => backend.requests.filter((m) => m.type === 'settings.get' && m.scope === 'user').length;
    const getsBefore = userGets();

    saveText(REMOTE_ID, 'env-1');
    await waitFor(() => expect(backend.file('user').remote).toEqual({ defaultEnvironmentId: 'env-1' }));
    await waitFor(() => expect(userGets()).toBeGreaterThan(getsBefore));
    await flush();

    expect(screen.getByText('Default Cloud Environment')).toBeTruthy();
    await waitFor(() => expect((screen.getByPlaceholderText(REMOTE_ID) as HTMLInputElement).value).toBe('env-1'));
  });
});

describe('#33 AC4 env（F1→A）：變數為子欄位', () => {
  const A = 'CLAUDE_CODE_SKIP_BEDROCK_AUTH';
  const B = 'CLAUDE_CODE_SKIP_VERTEX_AUTH';

  it('X7 搜尋結果兩個 env 變數列並行存檔 → 兩個變數都在', async () => {
    await openUser();
    search('CLAUDE_CODE_SKIP_');
    await waitFor(() => envCheckbox(B));
    backend.block('user');

    fireEvent.click(envCheckbox(A));
    await waitPending('user', 1);
    fireEvent.click(envCheckbox(B));
    await waitPending('user', 2);
    await drain('user');

    expect(backend.file('user').env).toEqual({ [A]: '1', [B]: '1' });
  });

  it('X8 已自訂分頁兩個已知變數列並行存檔 → 兩個都在', async () => {
    await openUser({ env: { [A]: '0', [B]: '0' } });
    clickNav('Customized');
    await waitFor(() => envCheckbox(B));
    backend.block('user');

    fireEvent.click(envCheckbox(A));
    await waitPending('user', 1);
    fireEvent.click(envCheckbox(B));
    await waitPending('user', 2);
    await drain('user');

    expect(backend.file('user').env).toEqual({ [A]: '1', [B]: '1' });
  });

  it('AC5 env：刪掉最後一個變數 → 檔案不留 env key', async () => {
    await openUser({ env: { ONLY_VAR: 'v' } });
    clickNav('Env');
    const row = (await screen.findByDisplayValue('ONLY_VAR')).closest('.env-custom-row') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(backend.file('user')).not.toHaveProperty('env'));
    expect(backend.requests.some((m) => m.type === 'settings.deleteNested' && m.parentKey === 'env' && m.childKey === 'ONLY_VAR')).toBe(true);
  });

  it('X29 rename：先 setNested 新名、再 deleteNested 舊名；中途檔案新舊並存，最後只剩新名', async () => {
    await openUser({ env: { OLD_VAR: 'v', KEEP: 'k' } });
    clickNav('Env');
    await screen.findByDisplayValue('OLD_VAR');
    backend.block('user');

    renameEnvRow('OLD_VAR', 'NEW_VAR');
    await waitPending('user', 1);
    await act(async () => { await backend.release('user'); });

    await waitFor(() => expect(backend.pending('user').map((m) => [m.type, m.childKey]))
      .toEqual([['settings.deleteNested', 'OLD_VAR']]));
    expect(backend.file('user').env).toEqual({ OLD_VAR: 'v', KEEP: 'k', NEW_VAR: 'v' });

    await drain('user');
    expect(backend.file('user').env).toEqual({ KEEP: 'k', NEW_VAR: 'v' });
  });

  // 對照「第二筆讀目前 scope」的錯誤實作：deleteNested 會送往 local，必須轉紅。
  it('X27 rename 第一筆未回時切到 local → 第二筆 deleteNested 仍送往 project', async () => {
    backend = installFakeSettingsBackend({ project: { env: { OLD_VAR: 'v' } } });
    renderSettingsPage();
    await waitInitialLoad();
    clickNav('Env');
    await switchScope('Project');
    await screen.findByDisplayValue('OLD_VAR');
    backend.block('project');

    renameEnvRow('OLD_VAR', 'NEW_VAR');
    await waitPending('project', 1);
    await switchScope('Local');
    await drain('project');
    await waitFor(() => expect(backend.requests.some((m) => m.type === 'settings.deleteNested')).toBe(true));
    await drain('project');

    const deletes = backend.requests.filter((m) => m.type === 'settings.deleteNested');
    expect(deletes).toEqual([expect.objectContaining({ scope: 'project', parentKey: 'env', childKey: 'OLD_VAR' })]);
    const localWrites = backend.requests.filter((m) => m.scope === 'local' && m.type !== 'settings.get');
    expect(localWrites).toEqual([]);
    expect(backend.file('project').env).toEqual({ NEW_VAR: 'v' });
    expect(backend.file('local')).toEqual({});
  });
});

describe('#33 X17 webview 層：回推讀取與寫入同隊', () => {
  // 守門（現況綠）：讀取排在寫入之前、先回應；之後寫入回應的樂觀更新不被舊讀取蓋掉。
  it('回推的讀取先排隊、接著存 language → 最終畫面含寫入值', async () => {
    await openUser();
    backend.block('user');

    act(() => { emitPush({ type: 'settings.refresh' }); });
    await waitFor(() => expect(backend.pending('user').some((m) => m.type === 'settings.get')).toBe(true));
    saveText(LANGUAGE, 'ja');
    await waitFor(() => expect(backend.pending('user').some((m) => m.type === 'settings.set')).toBe(true));
    await drain('user');

    expect(backend.file('user').language).toBe('ja');
    expect((screen.getByPlaceholderText(LANGUAGE) as HTMLInputElement).value).toBe('ja');
  });
});
