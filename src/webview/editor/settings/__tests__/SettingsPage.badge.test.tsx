/**
 * @vitest-environment jsdom
 *
 * Issue #8 — Scope tab badge：顯示該層設定項數量
 * 功能尚未實作時：顯示類測試紅、guard 類測試綠
 * 功能實作後：optimistic 分支測試綠、guard 仍綠
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';

/* ── Mock vscode bridge ── */
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

describe('SettingsPage — scope tab badge（issue #8）', () => {
  beforeEach(() => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({});
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Badge 顯示（功能未實作時這三條 RED）
  // ---------------------------------------------------------------------------

  it('Project / Local 有設定時，tab 顯示正確 badge 數字', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ model: 'x', env: { A: '1' } }); // 2 top-level keys
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ permissions: {} }); // 1 top-level key
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    // Wait until tabs are stable (workspace resolved)
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect(tabs.length).toBe(3);
      expect((tabs[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      // project tab（index 1）should show badge "2"
      expect(tabs[1].textContent).toContain('2');
      // local tab（index 2）should show badge "1"
      expect(tabs[2].textContent).toContain('1');
    });
  });

  it('0 個 key 時，該 tab 不顯示 badge 數字（以同測試驗 project badge=2 作紅燈錨）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ theme: 'dark', model: 'x' }); // 2 keys → badge "2" (紅燈錨)
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({}); // 0 keys → no badge
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect((tabs[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      // project has 2 keys → badge must appear (red-light anchor)
      expect(tabs[1].textContent).toContain('2');
    });

    // local has 0 keys → no numeric badge; textContent should be pure label text (no digits)
    const tabs = container.querySelectorAll('.settings-scope-tab');
    const localText = tabs[2].textContent ?? '';
    expect(localText).not.toMatch(/\d/);
  });

  it('User tab 永遠不顯示 badge（以 project badge=3 作紅燈錨）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ a: 1, b: 2, c: 3 }); // 3 keys → badge "3" (紅燈錨)
      if (msg.type === 'settings.get' && msg.scope === 'user')
        return Promise.resolve({ language: 'zh-TW', model: 'x', theme: 'dark' }); // 3 keys
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect((tabs[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      // project badge exists (red-light anchor)
      expect(tabs[1].textContent).toContain('3');
    });

    // user tab (index 0) label is "User" — no digits should appear regardless of user key count
    const tabs = container.querySelectorAll('.settings-scope-tab');
    const userText = tabs[0].textContent ?? '';
    expect(userText).not.toMatch(/\d/);
  });

  // ---------------------------------------------------------------------------
  // Guard（功能前後皆 GREEN）
  // ---------------------------------------------------------------------------

  // NOTE: 無 workspace 時功能未實作 → 不發 count fetch（與未實作行為一致）。
  // 功能實作後，此測試守衛「disabled 狀態下不發 count fetch」行為。
  it('（guard）無 workspace 時，不對 project/local 發 count 用 settings.get', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([]);
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    // Wait until workspace check is done → tabs are disabled
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect((tabs[1] as HTMLButtonElement).disabled).toBe(true);
      expect((tabs[2] as HTMLButtonElement).disabled).toBe(true);
    });

    const projectOrLocalGetCalls = mockSendRequest.mock.calls.filter(
      (c: any[]) =>
        c[0]?.type === 'settings.get' &&
        (c[0]?.scope === 'project' || c[0]?.scope === 'local'),
    );
    expect(projectOrLocalGetCalls.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Push refresh → badge 即時更新（功能未實作時 RED）
  // ---------------------------------------------------------------------------

  it('settings.refresh push 後，badge 數量即時更新', async () => {
    // Capture all push handlers (handles cases where multiple listeners are registered)
    const pushHandlers: Array<(msg: { type: string }) => void> = [];
    mockOnPushMessage.mockImplementation(((h: (msg: { type: string }) => void) => {
      pushHandlers.push(h);
      return () => {};
    }) as () => () => void);

    let projectKeyCount = 1;
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve(
          projectKeyCount === 1 ? { a: 1 } : { a: 1, b: 2 },
        );
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    // Initial state: project badge = 1
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect((tabs[1] as HTMLButtonElement).disabled).toBe(false);
      expect(tabs[1].textContent).toContain('1');
    });

    // Simulate a save / external change: project now returns 2 keys
    projectKeyCount = 2;

    // Fire settings.refresh through all captured push handlers
    for (const handler of pushHandlers) {
      handler({ type: 'settings.refresh' });
    }

    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect(tabs[1].textContent).toContain('2');
    });
  });

  // ---------------------------------------------------------------------------
  // Optimistic count 分支（功能未實作時 RED；正確 prod 下 GREEN）
  // Mutation 自驗說明在各 it() 內
  // ---------------------------------------------------------------------------

  it('save 新 key → Project tab badge +1（optimistic）', async () => {
    // Project scope 初始為空 → badge 不顯示
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project') return Promise.resolve({});
      if (msg.type === 'settings.get' && msg.scope === 'local') return Promise.resolve({});
      if (msg.type === 'settings.get') return Promise.resolve({});
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    // 切到 Project tab
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect((tabs[1] as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(container.querySelectorAll('.settings-scope-tab')[1]);

    // 等待 Project scope 載入完成（Language 欄位可見）
    await waitFor(() => screen.getByPlaceholderText('e.g. zh-TW'));

    // 確認初始無 badge 數字
    const tabsBefore = container.querySelectorAll('.settings-scope-tab');
    expect(tabsBefore[1].textContent).not.toMatch(/\d/);

    // 在 Language（text 欄位）填值並按 Save → 新 key 寫入
    const languageInput = screen.getByPlaceholderText('e.g. zh-TW');
    const languageField = languageInput.closest('.settings-field') as HTMLElement;
    fireEvent.change(languageInput, { target: { value: 'ja' } });
    fireEvent.click(within(languageField).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(getCalls('settings.set').length).toBe(1));

    // Optimistic +1 → badge 應出現 "1"
    // Mutation 打死：把 `prev[scope] + 1` 改成 `+2` → badge 會是 "2" → 紅
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect(tabs[1].textContent).toContain('1');
    });
  });

  it('save 已存在 key（改值）→ Project badge 不變（isNew guard）', async () => {
    // Project scope 初始有 language: 'en' → badge "1"
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project') return Promise.resolve({ language: 'en' });
      if (msg.type === 'settings.get' && msg.scope === 'local') return Promise.resolve({});
      if (msg.type === 'settings.get') return Promise.resolve({});
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    // 切到 Project tab
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect((tabs[1] as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(container.querySelectorAll('.settings-scope-tab')[1]);

    // 等 badge "1" 出現
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect(tabs[1].textContent).toContain('1');
    });

    // 改 Language 值（key 已存在），按 Save
    const languageInput = screen.getByPlaceholderText('e.g. zh-TW');
    const languageField = languageInput.closest('.settings-field') as HTMLElement;
    fireEvent.change(languageInput, { target: { value: 'fr' } });
    fireEvent.click(within(languageField).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(getCalls('settings.set').length).toBe(1));

    // 既有 key 改值 → count 不變，仍為 "1"
    // Mutation 打死：移除 `if (isNew)` guard（每次 save 都 +1）→ badge 會是 "2" → 紅
    const tabs = container.querySelectorAll('.settings-scope-tab');
    expect(tabs[1].textContent).toContain('1');
    // 也確認不是 "2"（避免 "12" 等意外情況混過去）
    expect(tabs[1].textContent).not.toMatch(/2/);
  });

  it('delete 已存在 key → Project badge -1（optimistic）', async () => {
    // Project scope 初始有 language: 'en' → badge "1"
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project') return Promise.resolve({ language: 'en' });
      if (msg.type === 'settings.get' && msg.scope === 'local') return Promise.resolve({});
      if (msg.type === 'settings.get') return Promise.resolve({});
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    // 切到 Project tab
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect((tabs[1] as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(container.querySelectorAll('.settings-scope-tab')[1]);

    // 等 badge "1" 出現
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect(tabs[1].textContent).toContain('1');
    });

    // 按 Reset Language 按鈕 → 呼叫 onDelete('language')
    await waitFor(() => screen.getByRole('button', { name: 'Reset Language' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Language' }));

    await waitFor(() => expect(getCalls('settings.delete').length).toBe(1));

    // Optimistic -1 → count 變 0 → badge 消失（textContent 不含數字）
    // Mutation 打死 1：移除 `key in settings` guard → delete 不存在 key 也會 -1（count 可能負）
    // Mutation 打死 2：移除 `Math.max(0, ...)` → count 可能負數 → 顯示 "-1" 等異常
    // Mutation 打死 3：移除整個 delete 的 -1 邏輯 → badge 仍顯示 "1" → 紅
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect(tabs[1].textContent).not.toMatch(/\d/);
    });
  });
});
