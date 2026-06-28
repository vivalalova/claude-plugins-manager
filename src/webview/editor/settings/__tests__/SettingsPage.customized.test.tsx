/**
 * @vitest-environment jsdom
 *
 * Customized 分頁測試 — 功能對應 GitHub issue #9。
 * 功能尚未實作，所有新測試預期為紅（TDD）。
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

const clickCustomized = () => {
  fireEvent.click(screen.getByText('Customized').closest('button')!);
};

describe('SettingsPage — Customized 分頁', () => {
  beforeEach(() => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
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
  // Regression guard: search 仍可用（防止 customized 實作污染搜尋流程）
  // ---------------------------------------------------------------------------

  it('[regression] 搜尋欄位名稱 → 顯示對應欄位 row', async () => {
    renderPage();

    await waitFor(() => screen.getByPlaceholderText('Search settings...'));
    fireEvent.change(screen.getByPlaceholderText('Search settings...'), { target: { value: 'Language' } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. zh-TW')).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // Customized 分頁測試
  // ---------------------------------------------------------------------------

  it('1. nav 含 Customized 且在 Advanced 之後', async () => {
    renderPage();

    await waitFor(() => {
      const nav = screen.getByRole('navigation');
      const navButtons = Array.from(nav.querySelectorAll('button'));
      const labels = navButtons.map((b) => b.textContent);
      expect(labels).toContain('Customized');
      const advIdx = labels.indexOf('Advanced');
      const custIdx = labels.indexOf('Customized');
      expect(custIdx).toBe(advIdx + 1);
    });
  });

  it('2. schema scalar 已設定 → customized 顯示該欄位', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ language: 'ja' });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. zh-TW')).toBeTruthy();
      expect((screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement).value).toBe('ja');
    });
  });

  it('3. nestedUnder 已設定 → customized 顯示 nested row，不出現 Permissions 跳轉卡片', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: { defaultMode: 'plan' } });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // Default Mode row 應出現
      expect(screen.getByText('Default Mode')).toBeTruthy();
      // Permissions 跳轉按鈕不應出現（nested key 已各自以 row 呈現）
      expect(screen.queryByText('Permissions →')).toBeNull();
    });
  });

  it('4. permissions 含非 nested key → 顯示跳轉卡片，點後切到 permissions section', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: { allow: ['WebSearch'] } });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      expect(screen.getByText('Permissions →')).toBeTruthy();
    });

    // 點跳轉按鈕 → 切到 permissions section
    fireEvent.click(screen.getByText('Permissions →'));

    await waitFor(() => {
      expect(screen.getByText('Allow')).toBeTruthy();
      expect(screen.getByText('Deny')).toBeTruthy();
      expect(screen.getByText('Ask')).toBeTruthy();
    });
  });

  it('5. env 已設定 → 顯示單一 Env 跳轉卡片', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ env: { MY_VAR: 'x' } });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      expect(screen.getByText('Env →')).toBeTruthy();
    });
  });

  it('6. hooks 已設定 → 顯示 Hooks 跳轉卡片', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }] },
      });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      expect(screen.getByText('Hooks →')).toBeTruthy();
    });
  });

  it('7. unknown key → 顯示可編輯 row，刪除後呼叫 settings.delete', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ someUnknownKey: 1 });
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      expect(screen.getByText('someUnknownKey')).toBeTruthy();
    });

    // 點 Reset 按鈕刪除（TextSetting 的 ResetOrClearButton，aria-label = "Reset <key>"）
    const resetBtn = screen.getByRole('button', { name: 'Reset someUnknownKey' });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      const deleteCalls = getCalls('settings.delete');
      expect(deleteCalls.length).toBe(1);
      expect(deleteCalls[0][0].key).toBe('someUnknownKey');
    });
  });

  it('8. HIDDEN key 不顯示，且呈空狀態（無欄位 row）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        enabledPlugins: { 'some-plugin': true },
      });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      expect(screen.queryByText('$schema')).toBeNull();
      expect(screen.queryByText('enabledPlugins')).toBeNull();
      // 也不應有任何 schema scalar row
      expect(screen.queryByPlaceholderText('e.g. zh-TW')).toBeNull();
      // 空狀態提示必須出現（移除該提示時此斷言紅）
      expect(screen.getByText('No customized settings in this scope.')).toBeTruthy();
    });
  });

  it('9b. permissions 為空物件 → 不顯示 Permissions 卡片，顯示空狀態訊息', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: {} });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // permissions 空物件不應產生卡片
      expect(screen.queryByText('Permissions →')).toBeNull();
      // 也不應有 schema scalar row
      expect(screen.queryByPlaceholderText('e.g. zh-TW')).toBeNull();
      // 空狀態訊息必須出現
      expect(screen.getByText('No customized settings in this scope.')).toBeTruthy();
    });
  });

  it('9. 空狀態：settings 為 {} → customized 無任何欄位 row', async () => {
    // 預設 beforeEach mock 就是 settings.get → {}
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('e.g. zh-TW')).toBeNull();
      expect(screen.queryByText('Permissions →')).toBeNull();
      expect(screen.queryByText('Env →')).toBeNull();
      expect(screen.queryByText('Hooks →')).toBeNull();
      // 搜尋結果的 noResults 文字不應出現（搜尋欄是空的）
      expect(screen.queryByText('No results found')).toBeNull();
      // 空狀態提示必須出現（移除該提示時此斷言紅）
      expect(screen.getByText('No customized settings in this scope.')).toBeTruthy();
    });
  });

  it('10. 即時更新：在 customized 內編輯 Language 並 Save → row 仍在且值更新', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ language: 'ja' });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      expect((screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement).value).toBe('ja');
    });

    const languageInput = screen.getByPlaceholderText('e.g. zh-TW');
    const languageField = languageInput.closest('.settings-field') as HTMLElement;
    fireEvent.change(languageInput, { target: { value: 'fr' } });
    fireEvent.click(within(languageField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(getCalls('settings.set').length).toBe(1);
    });

    // optimistic update：row 仍在且值為 fr
    expect((screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement).value).toBe('fr');
  });

  it('11. 切換 scope：User 有 language，Project 為空 → customized 隨 scope 切換', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'user') return Promise.resolve({ language: 'ja' });
      if (msg.type === 'settings.get' && msg.scope === 'project') return Promise.resolve({});
      if (msg.type === 'settings.get' && msg.scope === 'local') return Promise.resolve({});
      if (msg.type === 'settings.get') return Promise.resolve({ language: 'ja' });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    // User scope → language row 存在
    await waitFor(() => {
      expect((screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement).value).toBe('ja');
    });

    // 切換到 Project scope
    fireEvent.click(screen.getByText('Project').closest('button')!);

    // Project scope → 無 language row（空狀態）
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('e.g. zh-TW')).toBeNull();
      expect(screen.queryByText('Permissions →')).toBeNull();
    });
  });
});
