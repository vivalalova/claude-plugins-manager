/**
 * @vitest-environment jsdom
 */
// #31 — 10 個 key 在本層與所有生效上層都沒設時，Claude Code 改讀 ~/.claude.json 的值。
// 設定頁以獨立 request 取得這批 key 的備援值：
// - 標記 key 選到預設值一律寫值、不刪 key（與備援快照狀態無關，I1a）；重設仍刪 key。
// - 本層未設且 inherited=none、快照就緒、值合法時，顯示值反映備援值並在欄位旁顯示唯讀提示（I6／I7）。
// - 快照載入中、失敗、回 null、型別不符、上層 unknown／known → 完全不影響顯示（I3／I6）。
// 提示以「.claude.json 之後緊接值標籤」判定（en 預期文案：Current value (from ~/.claude.json): Off），
// 不依賴確切前綴字樣；enum 的 '' 選項文字另計，提示只看 select 以外的文字。
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';

const { mockSendRequest, mockOnPushMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
}));

vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

import { SettingsPage } from '../SettingsPage';
import { ToastProvider } from '../../../components/Toast';

/** #31 新 request type（實作需對齊此字面）。 */
const FALLBACK_TYPE = 'settings.getGlobalConfigFallback';

type Scope = 'user' | 'project' | 'local';
type Obj = Record<string, unknown>;

interface MockOptions {
  /** 各 scope 設定檔內容；settings.set／delete 會同步改寫（模擬寫入後的重讀）。 */
  own?: Partial<Record<Scope, Obj>>;
  /** 回傳 undefined＝走 own；否則以此 promise 回應該次 settings.get（用於掛住／拒絕上層讀取）。 */
  overrideGet?: (scope: Scope) => Promise<unknown> | undefined;
  /** 每次備援 request 呼叫一次；未提供＝回 null（與其他未知 request 相同）。 */
  fallback?: () => Promise<unknown>;
}

function setupMock({ own = {}, overrideGet, fallback }: MockOptions = {}): void {
  const files: Record<Scope, Obj> = { user: { ...own.user }, project: { ...own.project }, local: { ...own.local } };
  mockSendRequest.mockImplementation((msg: { type: string; scope?: Scope; key?: string; value?: unknown }) => {
    if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
    if (msg.type === 'settings.get' && msg.scope) {
      const overridden = overrideGet?.(msg.scope);
      if (overridden) return overridden;
      return Promise.resolve({ ...files[msg.scope] });
    }
    if (msg.type === 'settings.set' && msg.scope && msg.key) {
      files[msg.scope][msg.key] = msg.value;
      return Promise.resolve(undefined);
    }
    if (msg.type === 'settings.delete' && msg.scope && msg.key) {
      delete files[msg.scope][msg.key];
      return Promise.resolve(undefined);
    }
    if (msg.type === FALLBACK_TYPE) return fallback ? fallback() : Promise.resolve(null);
    return Promise.resolve(null);
  });
}

/** 捕捉 push handler，供發送 settings.refresh。 */
function capturePush(): (msg: { type: string }) => void {
  const handlers: Array<(msg: { type: string }) => void> = [];
  mockOnPushMessage.mockImplementation(((h: (msg: { type: string }) => void) => {
    handlers.push(h);
    return () => {};
  }) as () => () => void);
  return (msg) => handlers.forEach((h) => h(msg));
}

const renderPage = () => renderWithI18n(<ToastProvider><SettingsPage /></ToastProvider>);

const getCalls = (type: string): any[][] =>
  mockSendRequest.mock.calls.filter((c: any[]) => c[0]?.type === type);

const hasSet = (key: string, value: unknown): boolean =>
  getCalls('settings.set').some((c) => c[0]?.key === key && c[0]?.value === value);
const hasDelete = (key: string): boolean =>
  getCalls('settings.delete').some((c) => c[0]?.key === key);

const field = (hint: string): HTMLElement =>
  screen.getByText(hint).closest('.settings-field') as HTMLElement;
const checkbox = (hint: string): HTMLInputElement =>
  within(field(hint)).getByRole('checkbox') as HTMLInputElement;

/** 欄位內 select 以外的文字中，從 ".claude.json" 起的片段；沒有提示回 null。 */
function fallbackHint(hint: string): string | null {
  const clone = field(hint).cloneNode(true) as HTMLElement;
  clone.querySelectorAll('select').forEach((s) => s.remove());
  const text = clone.textContent ?? '';
  const i = text.indexOf('.claude.json');
  return i < 0 ? null : text.slice(i);
}
const hintShowing = (hint: string, valueLabel: string): boolean =>
  new RegExp(`^\\.claude\\.json[^A-Za-z]*${valueLabel}\\b`).test(fallbackHint(hint) ?? '');

const RG = '(respectGitignore: true)';
const STD = '(showTurnDuration: true)';
const TPB = '(terminalProgressBarEnabled: true)';
const THEME = '(theme: dark)';
const RCAS = '(remoteControlAtStartup)';
const AUTOSCROLL = '(autoScrollEnabled: true)';

const goSection = async (name: string): Promise<void> => {
  await waitFor(() => screen.getByRole('navigation'));
  fireEvent.click(within(screen.getByRole('navigation')).getByText(name));
};
const goScope = async (name: 'Project' | 'Local'): Promise<void> => {
  await waitFor(() => expect(screen.getAllByText(name)).toHaveLength(1));
  fireEvent.click(screen.getByText(name).closest('button')!);
};
/** 等備援 request 至少發出 n 次並讓 resolve／reject 分支跑完。 */
const waitFallbackSettled = async (n = 1): Promise<void> => {
  await waitFor(() => expect(getCalls(FALLBACK_TYPE).length).toBeGreaterThanOrEqual(n), { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockOnPushMessage.mockImplementation(() => () => {});
});

describe('SettingsPage — 標記 key 選到預設值一律寫值（#31 I1a）', () => {
  it('A3：user scope（無上層）、showTurnDuration=false、備援回 null → 點擊 → settings.set true，不刪 key', async () => {
    setupMock({ own: { user: { showTurnDuration: false } } });
    renderPage();
    await goSection('Display');
    await waitFor(() => field(STD));
    await waitFallbackSettled();

    fireEvent.click(checkbox(STD));

    await waitFor(() => expect(hasSet('showTurnDuration', true)).toBe(true));
    expect(hasDelete('showTurnDuration')).toBe(false);
  });

  it('A4：project scope、上層 user 已載入且沒設 → 點擊選到預設值 → settings.set true，不刪 key', async () => {
    setupMock({
      own: {
        user: { autoScrollEnabled: false },
        project: { showTurnDuration: false, autoScrollEnabled: false },
      },
    });
    renderPage();
    await goScope('Project');
    await goSection('Display');
    await waitFor(() => field(STD));
    // 上層快照已套用的旁證：兩層都設的 autoScrollEnabled 冒出 override badge。
    await within(field(AUTOSCROLL)).findByText('Overrides User', {}, { timeout: 5000 });

    fireEvent.click(checkbox(STD));

    await waitFor(() => expect(hasSet('showTurnDuration', true)).toBe(true));
    expect(hasDelete('showTurnDuration')).toBe(false);
  });

  it('A5：備援 request 掛住不回，user scope showTurnDuration=false → 點擊 → settings.set true，不刪 key', async () => {
    setupMock({ own: { user: { showTurnDuration: false } }, fallback: () => new Promise(() => {}) });
    renderPage();
    await goSection('Display');
    await waitFor(() => field(STD));
    await waitFor(() => expect(getCalls(FALLBACK_TYPE).length).toBeGreaterThanOrEqual(1), { timeout: 5000 });

    fireEvent.click(checkbox(STD));

    await waitFor(() => expect(hasSet('showTurnDuration', true)).toBe(true));
    expect(hasDelete('showTurnDuration')).toBe(false);
  });

  it('A14（W2）：標記 key 本層有值 → Reset → settings.delete', async () => {
    setupMock({ own: { user: { showTurnDuration: false } }, fallback: () => Promise.resolve({ showTurnDuration: false }) });
    renderPage();
    await goSection('Display');
    await waitFor(() => field(STD));

    fireEvent.click(within(field(STD)).getByRole('button', { name: /Reset/ }));

    await waitFor(() => expect(hasDelete('showTurnDuration')).toBe(true));
  });
});

describe('SettingsPage — 備援值顯示與提示（#31 W1）', () => {
  it('A6：備援 {respectGitignore:false}、各層未設 → 未勾、提示 Off → 點擊 → settings.set true', async () => {
    setupMock({ fallback: () => Promise.resolve({ respectGitignore: false }) });
    renderPage();
    await waitFor(() => field(RG));

    await waitFor(() => expect(checkbox(RG).checked).toBe(false), { timeout: 5000 });
    expect(hintShowing(RG, 'Off')).toBe(true);

    fireEvent.click(checkbox(RG));

    await waitFor(() => expect(hasSet('respectGitignore', true)).toBe(true));
    expect(hasDelete('respectGitignore')).toBe(false);
  });

  it('A7：備援未回 → 勾（預設）、無提示 → 點擊 → settings.set false', async () => {
    setupMock({ fallback: () => new Promise(() => {}) });
    renderPage();
    await waitFor(() => field(RG));
    await waitFor(() => expect(getCalls(FALLBACK_TYPE).length).toBeGreaterThanOrEqual(1), { timeout: 5000 });

    expect(checkbox(RG).checked).toBe(true);
    expect(fallbackHint(RG)).toBeNull();

    fireEvent.click(checkbox(RG));
    await waitFor(() => expect(hasSet('respectGitignore', false)).toBe(true));
  });

  it('A8：備援 request reject → 勾、無提示', async () => {
    setupMock({ fallback: () => Promise.reject(new Error('read failed')) });
    renderPage();
    await waitFor(() => field(RG));
    await waitFallbackSettled();

    expect(checkbox(RG).checked).toBe(true);
    expect(fallbackHint(RG)).toBeNull();
  });

  it('A9（I7）：備援值型別不符（"no"）→ 勾、無提示；同回應內合法的兄弟 key 照常顯示', async () => {
    setupMock({ fallback: () => Promise.resolve({ showTurnDuration: 'no', terminalProgressBarEnabled: false }) });
    renderPage();
    await goSection('Display');
    await waitFor(() => field(STD));
    await waitFor(() => expect(hintShowing(TPB, 'Off')).toBe(true), { timeout: 5000 });

    expect(checkbox(STD).checked).toBe(true);
    expect(fallbackHint(STD)).toBeNull();
  });

  it('A10（I6）：local scope、上層讀取掛住（unknown）、備援 false 已到 → 勾、無提示 → 點擊 → settings.set false', async () => {
    let switched = false;
    setupMock({
      overrideGet: (s) => (switched && s !== 'local' ? new Promise(() => {}) : undefined),
      fallback: () => Promise.resolve({ showTurnDuration: false }),
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByText('Local')).toHaveLength(1));
    switched = true;
    await goScope('Local');
    await goSection('Display');
    await waitFor(() => field(STD));
    await waitFallbackSettled();

    expect(checkbox(STD).checked).toBe(true);
    expect(fallbackHint(STD)).toBeNull();

    fireEvent.click(checkbox(STD));
    await waitFor(() => expect(hasSet('showTurnDuration', false)).toBe(true));
  });

  it('A11（I6）：project scope、user 設 showTurnDuration=true、備援 false → 勾、無提示', async () => {
    setupMock({
      own: { user: { showTurnDuration: true } },
      fallback: () => Promise.resolve({ showTurnDuration: false, terminalProgressBarEnabled: false }),
    });
    renderPage();
    await goScope('Project');
    await goSection('Display');
    await waitFor(() => field(STD));
    // 旁證：上層沒設的兄弟 key 顯示提示＝上層快照（none）與備援快照都已就緒。
    await waitFor(() => expect(hintShowing(TPB, 'Off')).toBe(true), { timeout: 5000 });

    expect(checkbox(STD).checked).toBe(true);
    expect(fallbackHint(STD)).toBeNull();
  });

  it('A12：備援 {theme:"light"} → select 仍為 ""、"" 選項文字含 Light 與 ~/.claude.json、旁有提示 → 選 dark（預設值）→ settings.set theme=dark，不刪', async () => {
    setupMock({ fallback: () => Promise.resolve({ theme: 'light' }) });
    renderPage();
    await goSection('Display');
    await waitFor(() => field(THEME));

    const select = within(field(THEME)).getByRole('combobox') as HTMLSelectElement;
    await waitFor(() => expect(hintShowing(THEME, 'Light')).toBe(true), { timeout: 5000 });
    expect(select.value).toBe('');
    const emptyOption = select.querySelector('option[value=""]') as HTMLOptionElement;
    expect(emptyOption.textContent).toContain('.claude.json');
    expect(emptyOption.textContent).toContain('Light');

    fireEvent.change(select, { target: { value: 'dark' } });

    await waitFor(() => expect(hasSet('theme', 'dark')).toBe(true));
    expect(hasDelete('theme')).toBe(false);
  });

  it('A13（I7）：備援 {theme:"solarized"}（不在選項內）→ "" 選項為 notSet 標籤、無提示', async () => {
    setupMock({ fallback: () => Promise.resolve({ theme: 'solarized', showTurnDuration: false }) });
    renderPage();
    await goSection('Display');
    await waitFor(() => field(THEME));
    await waitFor(() => expect(hintShowing(STD, 'Off')).toBe(true), { timeout: 5000 });

    const select = within(field(THEME)).getByRole('combobox') as HTMLSelectElement;
    expect((select.querySelector('option[value=""]') as HTMLOptionElement).textContent).toBe('— not set —');
    expect(fallbackHint(THEME)).toBeNull();
  });

  it('A24：remoteControlAtStartup（無預設值）備援 true → 勾、提示 On', async () => {
    setupMock({ fallback: () => Promise.resolve({ remoteControlAtStartup: true }) });
    renderPage();
    await goSection('Advanced');
    await waitFor(() => field(RCAS));

    await waitFor(() => expect(checkbox(RCAS).checked).toBe(true), { timeout: 5000 });
    expect(hintShowing(RCAS, 'On')).toBe(true);
  });
});

describe('SettingsPage — 備援快照重載（#31 R2／R3／K3）', () => {
  it('A15：先回 false（未勾、有提示）→ settings.refresh 後改 reject → 提示消失、回到勾選', async () => {
    const push = capturePush();
    let n = 0;
    setupMock({
      fallback: () => (++n === 1 ? Promise.resolve({ respectGitignore: false }) : Promise.reject(new Error('parse error'))),
    });
    renderPage();
    await waitFor(() => field(RG));
    await waitFor(() => expect(hintShowing(RG, 'Off')).toBe(true), { timeout: 5000 });
    expect(checkbox(RG).checked).toBe(false);

    push({ type: 'settings.refresh' });
    await waitFallbackSettled(2);

    await waitFor(() => expect(checkbox(RG).checked).toBe(true));
    expect(fallbackHint(RG)).toBeNull();
  });

  it('A16：先回 false → settings.refresh 後回 true → 勾、提示 On', async () => {
    const push = capturePush();
    let n = 0;
    setupMock({ fallback: () => Promise.resolve({ respectGitignore: ++n === 1 ? false : true }) });
    renderPage();
    await waitFor(() => field(RG));
    await waitFor(() => expect(hintShowing(RG, 'Off')).toBe(true), { timeout: 5000 });

    push({ type: 'settings.refresh' });

    await waitFor(() => expect(hintShowing(RG, 'On')).toBe(true), { timeout: 5000 });
    expect(checkbox(RG).checked).toBe(true);
  });

  it('A17：refresh 前後備援值都是 false → 顯示不變（未勾、提示 Off）', async () => {
    const push = capturePush();
    setupMock({ fallback: () => Promise.resolve({ respectGitignore: false }) });
    renderPage();
    await waitFor(() => field(RG));
    await waitFor(() => expect(hintShowing(RG, 'Off')).toBe(true), { timeout: 5000 });
    expect(checkbox(RG).checked).toBe(false);

    push({ type: 'settings.refresh' });
    await waitFallbackSettled(2);

    expect(checkbox(RG).checked).toBe(false);
    expect(hintShowing(RG, 'Off')).toBe(true);
  });

  it('A18（R3）：A6 點擊寫入後提示立即消失；refresh 後本層已有值，仍無提示', async () => {
    const push = capturePush();
    setupMock({ fallback: () => Promise.resolve({ respectGitignore: false }) });
    renderPage();
    await waitFor(() => field(RG));
    await waitFor(() => expect(hintShowing(RG, 'Off')).toBe(true), { timeout: 5000 });

    fireEvent.click(checkbox(RG));
    await waitFor(() => expect(hasSet('respectGitignore', true)).toBe(true));
    await waitFor(() => expect(fallbackHint(RG)).toBeNull());
    expect(checkbox(RG).checked).toBe(true);

    push({ type: 'settings.refresh' });
    await waitFallbackSettled(2);

    expect(fallbackHint(RG)).toBeNull();
    expect(checkbox(RG).checked).toBe(true);
  });

  it('A19（K3）：備援 pending 時 checkbox 可操作（未停用）；resolve false 後變未勾', async () => {
    let resolveFallback: ((v: unknown) => void) | undefined;
    setupMock({ fallback: () => new Promise((res) => { resolveFallback = res; }) });
    renderPage();
    await waitFor(() => field(RG));
    await waitFor(() => expect(resolveFallback).toBeDefined(), { timeout: 5000 });

    expect(checkbox(RG).disabled).toBe(false);
    expect(checkbox(RG).checked).toBe(true);

    resolveFallback!({ respectGitignore: false });

    await waitFor(() => expect(checkbox(RG).checked).toBe(false), { timeout: 5000 });
    expect(checkbox(RG).disabled).toBe(false);
  });
});
