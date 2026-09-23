/**
 * @vitest-environment jsdom
 */
// #26 — 上層 scope 快照載入完成前／失敗時，寫入判斷不能誤判成「沒有父層設定」而
// 靜默刪除；父層真的沒設、或明確載入完成且沒有該 key 時才刪。
// alwaysThinkingEnabled：default=true。field 用 settingKey hint 定位（與 GeneralSection
// 既有測試同一手法，不依賴確切文案）。
// 從 SettingsPage.test.tsx 拆出（該檔已達 800 行上限），維持獨立可執行。
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

const renderPage = () => renderWithI18n(<ToastProvider><SettingsPage /></ToastProvider>);

const getCalls = (type: string): any[][] =>
  mockSendRequest.mock.calls.filter((c: any[]) => c[0]?.type === type);

const getAlwaysThinkingField = () =>
  screen.getByText('(alwaysThinkingEnabled: true)').closest('.settings-field') as HTMLElement;

describe('SettingsPage — 繼承感知寫入（#26 R5/R6）', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('R5：切到 project，own=false，父層(user)=false（已載入）→ 點擊 → settings.set 而非 settings.delete', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project') return Promise.resolve({ alwaysThinkingEnabled: false });
      if (msg.type === 'settings.get' && msg.scope === 'user') return Promise.resolve({ alwaysThinkingEnabled: false });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Project')).toHaveLength(1));
    fireEvent.click(screen.getByText('Project').closest('button')!);

    await waitFor(() => getAlwaysThinkingField());
    // 判別性等待：只等「呼叫過 settings.get」不能證明 parentSnapshot 已套進這次 render（stale
    // 快照也會讓呼叫次數 > 0）。改等 own 欄位本身冒出 override badge——badge 只在
    // parentSnapshot.forScope === 'project' 且 inherited.kind === 'known' 時渲染，是「父層快照
    // 已就緒且套用到當前 scope」的直接證據。
    await within(getAlwaysThinkingField()).findByText('Overrides User', {}, { timeout: 5000 });

    fireEvent.click(within(getAlwaysThinkingField()).getByRole('checkbox'));

    await waitFor(() => {
      expect(getCalls('settings.set').some((c) => c[0]?.key === 'alwaysThinkingEnabled' && c[0]?.value === true)).toBe(true);
      expect(getCalls('settings.delete').some((c) => c[0]?.key === 'alwaysThinkingEnabled')).toBe(false);
    });
  });

  it('R5b：同一情境但 user 完全沒設該 key → settings.delete', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project') return Promise.resolve({ alwaysThinkingEnabled: false, fastMode: true });
      if (msg.type === 'settings.get' && msg.scope === 'user') return Promise.resolve({ fastMode: true });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Project')).toHaveLength(1));
    fireEvent.click(screen.getByText('Project').closest('button')!);

    await waitFor(() => getAlwaysThinkingField());
    // alwaysThinkingEnabled 本身父層沒設此 key、不會有 override badge（inherited=none）；改用
    // fastMode（兩層都設同值）當「parentSnapshot 已就緒」的旁證訊號——它與 alwaysThinkingEnabled
    // 共用同一份 parentSnapshot，其 badge 出現即代表快照已套用到本次 render。
    const fastModeField = screen.getByText('(fastMode: false)').closest('.settings-field') as HTMLElement;
    await within(fastModeField).findByText('Overrides User', {}, { timeout: 5000 });
    // 訊號到位前不該有任何提早送出的 alwaysThinkingEnabled 寫入。
    expect(getCalls('settings.set').some((c) => c[0]?.key === 'alwaysThinkingEnabled')).toBe(false);

    fireEvent.click(within(getAlwaysThinkingField()).getByRole('checkbox'));

    await waitFor(() => {
      expect(getCalls('settings.delete').some((c) => c[0]?.key === 'alwaysThinkingEnabled')).toBe(true);
    });
  });

  it('R6(A)：project settings.get 已解析，但 user 父層 settings.get 一直不 resolve → 操作 → settings.set，不發 settings.delete', async () => {
    let resolveUser: ((v: Record<string, unknown>) => void) | undefined;
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project') return Promise.resolve({ alwaysThinkingEnabled: false });
      if (msg.type === 'settings.get' && msg.scope === 'user') {
        return new Promise<Record<string, unknown>>((res) => { resolveUser = res; });
      }
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Project')).toHaveLength(1));
    fireEvent.click(screen.getByText('Project').closest('button')!);

    await waitFor(() => getAlwaysThinkingField());
    // scope=user call count 要 >= 2：一次來自初始（scope='user' 時）own settings 載入，
    // 一次來自切到 project 後觸發的父層 settings.get('user')。只驗 > 0 驗不出後者是否真的
    // 發出過（前者本身就會讓計數 > 0，即便父層 fetch 尚未觸發也會誤判通過）。
    await waitFor(() => {
      const userCalls = getCalls('settings.get').filter((c) => c[0]?.scope === 'user');
      expect(userCalls.length).toBeGreaterThanOrEqual(2);
    }, { timeout: 5000 });
    expect(resolveUser).toBeDefined();

    fireEvent.click(within(getAlwaysThinkingField()).getByRole('checkbox'));

    await waitFor(() => {
      expect(getCalls('settings.set').some((c) => c[0]?.key === 'alwaysThinkingEnabled' && c[0]?.value === true)).toBe(true);
      expect(getCalls('settings.delete').some((c) => c[0]?.key === 'alwaysThinkingEnabled')).toBe(false);
    });
  });

  it('R6b(C)：父層 settings.get 直接 reject → 操作 → settings.set，不發 settings.delete', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project') return Promise.resolve({ alwaysThinkingEnabled: false });
      if (msg.type === 'settings.get' && msg.scope === 'user') return Promise.reject(new Error('load failed'));
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Project')).toHaveLength(1));
    fireEvent.click(screen.getByText('Project').closest('button')!);

    await waitFor(() => getAlwaysThinkingField());
    await waitFor(() => {
      expect(getCalls('settings.get').some((c) => c[0]?.scope === 'user')).toBe(true);
    }, { timeout: 5000 });

    fireEvent.click(within(getAlwaysThinkingField()).getByRole('checkbox'));

    await waitFor(() => {
      expect(getCalls('settings.set').some((c) => c[0]?.key === 'alwaysThinkingEnabled' && c[0]?.value === true)).toBe(true);
      expect(getCalls('settings.delete').some((c) => c[0]?.key === 'alwaysThinkingEnabled')).toBe(false);
    });
  });

  it('R6b 續（C→D）：父層第一輪成功回傳 {}（none），之後 reject，push settings.refresh 送出新一輪待決請求 → 操作 → settings.set，不發 settings.delete（guard try/catch failure marker 真的生效，非沿用上一輪的成功快照）', async () => {
    const handlers: Array<(msg: { type: string }) => void> = [];
    mockOnPushMessage.mockImplementation(((h: (msg: { type: string }) => void) => {
      handlers.push(h);
      return () => {};
    }) as () => () => void);

    let userCallCount = 0;
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project') return Promise.resolve({ alwaysThinkingEnabled: false });
      if (msg.type === 'settings.get' && msg.scope === 'user') {
        userCallCount += 1;
        if (userCallCount === 1) return Promise.resolve({});
        return Promise.reject(new Error('load failed'));
      }
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => expect(screen.getAllByText('Project')).toHaveLength(1));
    fireEvent.click(screen.getByText('Project').closest('button')!);

    await waitFor(() => getAlwaysThinkingField());
    // 第一輪父層載入成功回傳 {}（loaded, 沒設 → none）。
    await waitFor(() => expect(userCallCount).toBeGreaterThanOrEqual(1), { timeout: 5000 });

    // 推播 settings.refresh，觸發第二輪父層載入——這次會 reject（loadParentSettings 內部
    // try/catch 應把 snapshots 標成 undefined／未知，而非沿用上一輪成功的 {} 快照）。
    handlers.forEach((h) => h({ type: 'settings.refresh' }));
    await waitFor(() => expect(userCallCount).toBeGreaterThanOrEqual(2), { timeout: 5000 });
    // flush：讓 reject 的 catch 分支跑完並 setState。
    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(within(getAlwaysThinkingField()).getByRole('checkbox'));

    await waitFor(() => {
      expect(getCalls('settings.set').some((c) => c[0]?.key === 'alwaysThinkingEnabled' && c[0]?.value === true)).toBe(true);
      expect(getCalls('settings.delete').some((c) => c[0]?.key === 'alwaysThinkingEnabled')).toBe(false);
    });
  });

  it('R6c（I3，整合層）：user scope 初始載入（parents=[] 無網路呼叫），選到 default → 仍走 settings.delete', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ alwaysThinkingEnabled: false });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => getAlwaysThinkingField());
    fireEvent.click(within(getAlwaysThinkingField()).getByRole('checkbox'));

    await waitFor(() => {
      expect(getCalls('settings.delete').some((c) => c[0]?.key === 'alwaysThinkingEnabled')).toBe(true);
    });
  });

  // #26 interleaving A→B→A：切走又切回同一 scope、新一輪父層 fetch 未完成時，forScope 仍等於目前 scope；
  // 父層 loading 期間必須視為未知，不可拿切走前的舊快照做刪除判斷。
  it('local→project→local：project 父層 fetch 掛住不 resolve，切回 local 後新一輪父層 fetch 也還沒 resolve → 點擊選到 default → 不得送出 settings.delete', async () => {
    // 用「切到 project 前／後」這個時間點當界線，而非對 project/user scope 的呼叫次數計數
    // （scope counts 的 loadScopeCounts 也會對 project/local 發 settings.get，計數會被它污染、
    // 呼叫順序在真實 React 排程下也不保證固定，數次數是脆弱的判斷依據）。
    let hang = false;
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'local') {
        return Promise.resolve({ alwaysThinkingEnabled: false });
      }
      if (msg.type === 'settings.get' && (msg.scope === 'project' || msg.scope === 'user')) {
        return hang ? new Promise<Record<string, unknown>>(() => {}) : Promise.resolve({});
      }
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    // A：切到 local，讓第一輪父層 fetch（project/user）正常 resolve。
    await waitFor(() => expect(screen.getAllByText('Local')).toHaveLength(1));
    fireEvent.click(screen.getByText('Local').closest('button')!);
    await waitFor(() => getAlwaysThinkingField());
    await new Promise((r) => setTimeout(r, 0));

    // B：切到 project 前掛起旗標——project 自己的 settings.get 與其父層 fetch（user）都掛住不 resolve。
    hang = true;
    fireEvent.click(screen.getByText('Project').closest('button')!);
    await new Promise((r) => setTimeout(r, 0));

    // A：切回 local，觸發新一輪父層 fetch（project/user）；旗標仍是 hang，這輪也不會 resolve。
    fireEvent.click(screen.getByText('Local').closest('button')!);
    await waitFor(() => getAlwaysThinkingField());
    await new Promise((r) => setTimeout(r, 0));

    // 選到 default（own=false 點擊 → true = alwaysThinkingEnabled 的 schema default）。
    fireEvent.click(within(getAlwaysThinkingField()).getByRole('checkbox'));

    await waitFor(() => {
      expect(getCalls('settings.delete').some((c) => c[0]?.key === 'alwaysThinkingEnabled')).toBe(false);
    });
    expect(getCalls('settings.set').some((c) => c[0]?.key === 'alwaysThinkingEnabled' && c[0]?.value === true)).toBe(true);
  });
});
