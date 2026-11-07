/**
 * @vitest-environment jsdom
 *
 * #44 布林合併規則的交錯模型 C1–C8、C10–C12（webview 端）與紅燈 14（fake 無工作區讀取拋錯）。
 * 期望值來自計畫：AnyTrue 任一生效層寫 true 即生效、UI 取消勾選只刪本層 key、
 * 他層快照未就緒不提示、讀取失敗層標「無法讀取」。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../../vscode', async () => (await import('../../../__test-utils__/fakeSettingsBackend')).fakeVscodeModule);

import { installFakeSettingsBackend, emitPush, type FakeSettingsBackend } from '../../../__test-utils__/fakeSettingsBackend';
import {
  renderSettingsPage,
  waitInitialLoad,
  switchScope,
  clickScope,
  flush,
  search,
  scopeBadge,
} from '../../../__test-utils__/settingsPageHarness';
import { en } from '../../../i18n/locales/en';

type Json = Record<string, unknown>;

const BW = 'Block Writes Outside Working Directories';
const SKIP_DANGEROUS = 'Skip Dangerous Mode Permission Prompt';
const BW_KEY = 'blockWritesOutsideWorkingDirectories';
const SKIP_KEY = 'skipDangerousModePermissionPrompt';
const permBW = (v: unknown): Json => ({ permissions: { [BW_KEY]: v } });

let backend: FakeSettingsBackend;

afterEach(() => {
  cleanup();
});

const localeText = (key: string): string => {
  const tpl = (en as Record<string, string>)[key];
  expect(tpl, `en locale 缺 ${key}`).toBeTypeOf('string');
  return tpl;
};

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 由三語新增的 locale 樣板組出提示的比對式；{value}→On|Off、{scopes}→任意 */
const hintRe = (key: 'settings.common.mergeRuleActual' | 'settings.common.mergeRuleUnreadable', value?: 'On' | 'Off', scopes?: string): RegExp => {
  const tpl = escapeRe(localeText(key));
  const withValue = tpl.replace('\\{value\\}', value ?? '(On|Off)');
  return new RegExp(withValue.replace('\\{scopes\\}', scopes ? escapeRe(scopes) : '.+'));
};

const actualRe = (value: 'On' | 'Off', scope: string): RegExp => hintRe('settings.common.mergeRuleActual', value, scope);
const anyActualRe = (): RegExp => hintRe('settings.common.mergeRuleActual');
const unreadableRe = (): RegExp => hintRe('settings.common.mergeRuleUnreadable');

/** 搜尋後取該 label 所在欄位 */
async function fieldFor(label: string): Promise<HTMLElement> {
  search(label);
  return waitFor(() => {
    const field = screen
      .getAllByText(label)
      .map((el) => el.closest('.settings-field') as HTMLElement | null)
      .find((f): f is HTMLElement => f !== null);
    if (!field) throw new Error(`field ${label} not found`);
    return field;
  });
}

const checkboxOf = (field: HTMLElement): HTMLInputElement => within(field).getByRole('checkbox') as HTMLInputElement;
const textOf = (field: HTMLElement): string => field.textContent ?? '';

const waitNoLoading = () => waitFor(() => expect(document.querySelector('.settings-loading')).toBeNull());

async function openUser(initial: Partial<Record<'user' | 'project' | 'local', Json>>, options: Parameters<typeof installFakeSettingsBackend>[1] = {}): Promise<void> {
  backend = installFakeSettingsBackend(initial, options);
  renderSettingsPage();
  await waitNoLoading();
  await flush();
}

const tabs = (): HTMLButtonElement[] => Array.from(document.querySelectorAll<HTMLButtonElement>('.settings-scope-tab'));

const getsFor = (scope: string) =>
  backend.requests.filter((r) => r.type === 'settings.get' && r.scope === scope);

describe('#44 併發 C1：快照載入中不提示，載入後才補上', () => {
  it('C1 project 分頁 user 快照未回：未勾無提示；回來後出現「實際生效：開（User）」', async () => {
    await openUser({ user: permBW(true) });
    await switchScope('User');
    backend.block('user');
    clickScope('Project');
    const field = await fieldFor(BW);
    expect(checkboxOf(field).checked).toBe(false);
    expect(textOf(field)).not.toMatch(anyActualRe());
    expect(textOf(field)).not.toMatch(unreadableRe());

    await act(async () => { await backend.unblock('user'); });
    await flush();
    const after = await fieldFor(BW);
    expect(checkboxOf(after).checked).toBe(false);
    expect(textOf(after)).toMatch(actualRe('On', 'User'));
  });
});

describe('#44 併發 C2：外部寫他層並推播，重讀前不閃、重讀後出現提示', () => {
  it('C2 project 分頁 user 被外部寫 true：重讀回來前無提示，回來後「開（User）」', async () => {
    await openUser({});
    await switchScope('Project');
    const field = await fieldFor(BW);
    expect(textOf(field)).not.toMatch(anyActualRe());

    backend.block('user');
    backend.setFile('user', permBW(true));
    act(() => { emitPush({ type: 'settings.refresh' }); });
    await flush();
    const during = await fieldFor(BW);
    expect(checkboxOf(during).checked).toBe(false);
    expect(textOf(during)).not.toMatch(anyActualRe());

    await act(async () => { await backend.unblock('user'); });
    await flush();
    expect(textOf(await fieldFor(BW))).toMatch(actualRe('On', 'User'));
  });
});

describe('#44 併發 C3：切分頁後舊回應被丟棄', () => {
  it('C3 user 分頁載入未回就切 local：舊回應到達不產生提示，新回應到達才提示', async () => {
    await openUser({ user: permBW(true) });
    backend.block('user');
    act(() => { emitPush({ type: 'settings.refresh' }); });
    await waitFor(() => expect(backend.pending('user').length).toBeGreaterThanOrEqual(1));
    clickScope('Local');
    await waitFor(() => expect(backend.pending('user').length).toBeGreaterThanOrEqual(2));

    await act(async () => { await backend.release('user', 1); });
    await flush();
    const field = await fieldFor(BW);
    expect(checkboxOf(field).checked).toBe(false);
    expect(textOf(field)).not.toMatch(anyActualRe());

    await act(async () => { await backend.unblock('user'); });
    await flush();
    expect(textOf(await fieldFor(BW))).toMatch(actualRe('On', 'User'));
  });
});

describe('#44 併發 C4：取消勾選與外部寫他層交錯', () => {
  it('C4 local true 取消勾選（寫入在途）時外部 user 寫 true 並兩次推播：未勾、提示「開（User）」、local 檔無此 key', async () => {
    await openUser({ local: permBW(true) });
    await switchScope('Local');
    const field = await fieldFor(BW);
    expect(checkboxOf(field).checked).toBe(true);

    backend.block('local');
    fireEvent.click(checkboxOf(field));
    await waitFor(() => expect(backend.pending('local').some((m) => m.type === 'settings.deleteNested')).toBe(true));
    backend.setFile('user', permBW(true));
    act(() => { emitPush({ type: 'settings.refresh' }); });
    act(() => { emitPush({ type: 'settings.refresh' }); });
    await act(async () => { await backend.unblock('local'); });
    await flush();

    const after = await fieldFor(BW);
    expect(checkboxOf(after).checked).toBe(false);
    expect(textOf(after)).toMatch(actualRe('On', 'User'));
    expect((backend.file('local').permissions as Json | undefined)?.[BW_KEY]).toBeUndefined();
    expect(backend.requests.some((r) => r.type === 'settings.setNested' && r.childKey === BW_KEY && r.value === false)).toBe(false);
  });
});

describe('#44 併發 C5：確定無工作區不讀 project／local', () => {
  it('C5 user 分頁 getFolders 回空：不對 project／local 發 settings.get；無提示', async () => {
    await openUser({ user: {} }, { hasWorkspace: false });
    const field = await fieldFor(BW);
    expect(textOf(field)).not.toMatch(anyActualRe());
    expect(textOf(field)).not.toMatch(unreadableRe());
    act(() => { emitPush({ type: 'settings.refresh' }); });
    await flush();
    expect(getsFor('project')).toHaveLength(0);
    expect(getsFor('local')).toHaveLength(0);
    expect(tabs()[1].disabled).toBe(true);
    expect(tabs()[2].disabled).toBe(true);
  });
});

describe('#44 併發 C6：工作區 pending 期間不提示，確定後才讀入', () => {
  it('C6 getFolders 未回：無提示、不讀 project／local；回 1 資料夾後 local true 出現「開（Local）」', async () => {
    backend = installFakeSettingsBackend({ local: permBW(true) });
    const release = backend.holdFolders();
    renderSettingsPage();
    await waitNoLoading();
    await flush();

    const field = await fieldFor(BW);
    expect(textOf(field)).not.toMatch(anyActualRe());
    expect(textOf(field)).not.toMatch(unreadableRe());
    expect(getsFor('project')).toHaveLength(0);
    expect(getsFor('local')).toHaveLength(0);
    expect(tabs()[1].disabled).toBe(true);

    await act(async () => { release(); });
    await waitFor(() => expect(tabs()[2].disabled).toBe(false));
    await flush();
    expect(getsFor('local').length).toBeGreaterThan(0);
    expect(textOf(await fieldFor(BW))).toMatch(actualRe('On', 'Local'));
  });
});

describe('#44 併發 C7：外部在 user 層回寫 true 與擴充寫入交錯', () => {
  it('C7 擴充寫 skipDangerousMode true 在途、Claude Code 同時寫 true：最終檔案為 true、畫面已勾、local 分頁提示「開（User）」、UI 從不寫 false', async () => {
    await openUser({ user: {} });
    const field = await fieldFor(SKIP_DANGEROUS);
    backend.block('user');
    fireEvent.click(checkboxOf(field));
    await waitFor(() => expect(backend.pending('user').some((m) => m.type === 'settings.set' && m.key === SKIP_KEY)).toBe(true));
    backend.setFile('user', { [SKIP_KEY]: true });
    await act(async () => { await backend.unblock('user'); });
    act(() => { emitPush({ type: 'settings.refresh' }); });
    await flush();

    expect(backend.file('user')[SKIP_KEY]).toBe(true);
    expect(checkboxOf(await fieldFor(SKIP_DANGEROUS)).checked).toBe(true);
    expect(backend.requests.some((r) => (r.key === SKIP_KEY || r.childKey === SKIP_KEY) && r.value === false)).toBe(false);

    await switchScope('Local');
    const local = await fieldFor(SKIP_DANGEROUS);
    expect(checkboxOf(local).checked).toBe(false);
    expect(textOf(local)).toMatch(actualRe('On', 'User'));
  });
});

describe('#44 併發 C8：本層寫入只 patch 本層快照', () => {
  it('C8 local 分頁寫入成功後不對 user／project 重讀；推播後才重讀他層', async () => {
    await openUser({});
    await switchScope('Local');
    const field = await fieldFor(BW);
    await flush();
    const mark = backend.requests.length;

    fireEvent.click(checkboxOf(field));
    await waitFor(() => expect(backend.file('local').permissions).toEqual({ [BW_KEY]: true }));
    await flush();

    const after = backend.requests.slice(mark);
    expect(after.some((r) => r.type === 'settings.get' && (r.scope === 'user' || r.scope === 'project'))).toBe(false);
    expect(checkboxOf(await fieldFor(BW)).checked).toBe(true);

    act(() => { emitPush({ type: 'settings.refresh' }); });
    await flush();
    const afterPush = backend.requests.slice(mark);
    expect(afterPush.some((r) => r.type === 'settings.get' && r.scope === 'user')).toBe(true);
  });
});

describe('#44 併發 C10：某層讀取失敗', () => {
  it('C10a project 分頁 user 已載入 teammateMode、local 讀取失敗：teammateMode 照常繼承 user；blockWrites 顯示「無法讀取 Local」', async () => {
    // model 是純文字欄位、UI 不呈現繼承值；改用 enum 欄位 teammateMode，繼承值顯示在「未設定」選項文字
    await openUser({ user: { teammateMode: 'tmux' } }, { failReads: ['local'] });
    await switchScope('Project');
    const mode = await fieldFor('Teammate Mode');
    const select = within(mode).getByRole('combobox') as HTMLSelectElement;
    const notSetOption = Array.from(select.options).find((o) => o.value === '');
    expect(notSetOption?.textContent).toBe('Inherited from User: Tmux');

    const bw = await fieldFor(BW);
    expect(textOf(bw)).toMatch(unreadableRe());
    expect(textOf(bw)).toContain('Local');
  });

  it('C10b 同前提但 user 已 blockWrites:true：顯示「開（User）」，不顯示無法讀取', async () => {
    await openUser({ user: { model: 'x', ...permBW(true) } }, { failReads: ['local'] });
    await switchScope('Project');
    const bw = await fieldFor(BW);
    expect(textOf(bw)).toMatch(actualRe('On', 'User'));
    expect(textOf(bw)).not.toMatch(unreadableRe());
  });
});

describe('#44 併發 C11：工作區查詢失敗', () => {
  it('C11 user 分頁 getFolders 拋錯：AnyTrue key 顯示「無法讀取 Project、Local」，project／local 分頁不可點', async () => {
    await openUser({}, { failFolders: true });
    const field = await fieldFor(BW);
    expect(textOf(field)).toMatch(unreadableRe());
    expect(textOf(field)).toContain('Project');
    expect(textOf(field)).toContain('Local');
    expect(tabs()[1].disabled).toBe(true);
    expect(tabs()[2].disabled).toBe(true);
  });
});

describe('#44 併發 C12：加入工作區資料夾', () => {
  it('C12 原無工作區，推播後 present：讀入 project／local，出現「開（Local）」與 Local 徽章', async () => {
    await openUser({ local: permBW(true) }, { hasWorkspace: false });
    const before = await fieldFor(BW);
    expect(textOf(before)).not.toMatch(anyActualRe());
    expect(scopeBadge('Local')).toBeNull();

    backend.setWorkspace(true);
    act(() => { emitPush({ type: 'settings.refresh' }); });
    await waitFor(() => expect(tabs()[2].disabled).toBe(false));
    await flush();

    expect(textOf(await fieldFor(BW))).toMatch(actualRe('On', 'Local'));
    await waitFor(() => expect(scopeBadge('Local')).toBe('1'));
  });
});

describe('#44 紅燈 14：fake 無工作區時 project／local 讀取拋錯', () => {
  it('無工作區：settings.get project／local reject，user 仍回值', async () => {
    const b = installFakeSettingsBackend({ user: { model: 'x' }, project: { model: 'p' } }, { hasWorkspace: false });
    await expect(b.handle({ type: 'settings.get', scope: 'project' })).rejects.toThrow();
    await expect(b.handle({ type: 'settings.get', scope: 'local' })).rejects.toThrow();
    await expect(b.handle({ type: 'settings.get', scope: 'user' })).resolves.toMatchObject({ model: 'x' });
  });

  it('有工作區：project 仍回值；failReads 指定的層 reject', async () => {
    const b = installFakeSettingsBackend({ project: { model: 'p' } }, { failReads: ['local'] });
    await expect(b.handle({ type: 'settings.get', scope: 'project' })).resolves.toMatchObject({ model: 'p' });
    await expect(b.handle({ type: 'settings.get', scope: 'local' })).rejects.toThrow();
  });
});
