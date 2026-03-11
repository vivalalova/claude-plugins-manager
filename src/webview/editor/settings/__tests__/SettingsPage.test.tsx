/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('SettingsPage', () => {
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

  it('渲染 scope tabs：User / Project / Local', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('User')).toBeTruthy();
      expect(screen.getByText('Project')).toBeTruthy();
      expect(screen.getByText('Local')).toBeTruthy();
    });
  });

  it('渲染左側 nav：Model / Permissions / Env / Hooks / General', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Model')).toBeTruthy();
      expect(screen.getByText('Permissions')).toBeTruthy();
      expect(screen.getByText('Env')).toBeTruthy();
      expect(screen.getByText('Hooks')).toBeTruthy();
      expect(screen.getByText('General')).toBeTruthy();
    });
  });

  it('預設顯示 Model 區塊', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy();
    });
  });

  it('無 workspace 時 Project/Local tab 為 disabled', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([]);
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => {
      const projectTab = screen.getByText('Project').closest('button');
      expect(projectTab?.disabled).toBe(true);
      const localTab = screen.getByText('Local').closest('button');
      expect(localTab?.disabled).toBe(true);
    });
  });

  it('有 workspace 時 Project tab 可點擊', async () => {
    renderPage();

    await waitFor(() => {
      const projectTab = screen.getByText('Project').closest('button');
      expect(projectTab?.disabled).toBe(false);
    });
  });

  it('model 已設定時，Select 顯示對應值', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ model: 'claude-opus-4-6' });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('claude-opus-4-6');
    });
  });

  it('點擊切換到 Project scope → 重新 fetch settings', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Project'));
    fireEvent.click(screen.getByText('Project').closest('button')!);

    await waitFor(() => {
      const settingsGetCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.get',
      );
      // user scope + project scope = 2 calls
      expect(settingsGetCalls.length).toBeGreaterThanOrEqual(2);
      expect(settingsGetCalls.some((c: any[]) => c[0]?.scope === 'project')).toBe(true);
    });
  });

  it('選擇 model 並點擊 Save → sendRequest settings.set', async () => {
    renderPage();

    await waitFor(() => screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'claude-sonnet-4-6' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      const setCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.set',
      );
      expect(setCalls.length).toBe(1);
      expect(setCalls[0][0]).toMatchObject({
        type: 'settings.set',
        scope: 'user',
        key: 'model',
        value: 'claude-sonnet-4-6',
      });
    });
  });

  it('model 已設定時顯示 Clear 按鈕，點擊後 sendRequest settings.delete', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ model: 'claude-sonnet-4-6' });
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Clear'));
    fireEvent.click(screen.getByText('Clear'));

    await waitFor(() => {
      const deleteCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.delete',
      );
      expect(deleteCalls.length).toBe(1);
      expect(deleteCalls[0][0]).toMatchObject({
        type: 'settings.delete',
        scope: 'user',
        key: 'model',
      });
    });
  });

  it('點擊 General nav → 顯示 General 區塊（Effort Level / Language / Fast Mode）', async () => {
    renderPage();

    await waitFor(() => screen.getByText('General'));
    fireEvent.click(screen.getByText('General').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Effort Level')).toBeTruthy();
      expect(screen.getByText('Language')).toBeTruthy();
      expect(screen.getByText('Fast Mode')).toBeTruthy();
    });
  });

  it('點擊 Hooks nav → 顯示 Hooks 區塊（empty state）', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Hooks'));
    fireEvent.click(screen.getByText('Hooks').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('No hooks configured')).toBeTruthy();
    });
  });

  it('Hooks 區塊顯示 disableAllHooks toggle', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Hooks'));
    fireEvent.click(screen.getByText('Hooks').closest('button')!);

    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toBeTruthy();
      expect(screen.getByText('Disable All Hooks')).toBeTruthy();
    });
  });

  it('點擊 Env nav → 顯示 Env 區塊（empty state）', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Env'));
    fireEvent.click(screen.getByText('Env').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('No environment variables defined')).toBeTruthy();
    });
  });

  it('Env 區塊顯示已存在的 env vars', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        env: { MY_VAR: 'hello', API_URL: 'https://api.example.com' },
      });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Env'));
    fireEvent.click(screen.getByText('Env').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('MY_VAR')).toBeTruthy();
      expect(screen.getByText('hello')).toBeTruthy();
      expect(screen.getByText('API_URL')).toBeTruthy();
      expect(screen.getByText('https://api.example.com')).toBeTruthy();
    });
  });

  it('點擊 Permissions nav → 顯示 Allow / Deny / Ask 子 tab', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Allow')).toBeTruthy();
      expect(screen.getByText('Deny')).toBeTruthy();
      expect(screen.getByText('Ask')).toBeTruthy();
    });
  });

  it('Permissions 區塊顯示 allow 規則 tag', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { allow: ['Bash(git:*)', 'WebSearch'], deny: [], ask: [] },
      });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Bash(git:*)')).toBeTruthy();
      expect(screen.getByText('WebSearch')).toBeTruthy();
    });
  });

  it('切換到 Deny sub-tab → 顯示 deny 規則', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { allow: ['WebSearch'], deny: ['WebFetch'], ask: [] },
      });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => screen.getByText('Deny'));
    fireEvent.click(screen.getByText('Deny'));

    await waitFor(() => {
      expect(screen.getByText('WebFetch')).toBeTruthy();
    });
  });

  it('點擊規則 × 按鈕 → settings.set 不含該規則', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { allow: ['Bash(git:*)', 'WebSearch'], deny: [], ask: [] },
      });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => screen.getByText('Bash(git:*)'));
    const deleteBtn = screen.getByLabelText('Remove rule Bash(git:*)');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      const setCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.set',
      );
      expect(setCalls.length).toBe(1);
      const { value } = setCalls[0][0];
      expect(value.allow).toEqual(['WebSearch']);
    });
  });

  it('刪除最後一條規則 → settings.set payload 含 allow: []', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { allow: ['WebSearch'], deny: [], ask: [] },
      });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => screen.getByLabelText('Remove rule WebSearch'));
    fireEvent.click(screen.getByLabelText('Remove rule WebSearch'));

    await waitFor(() => {
      const setCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.set',
      );
      expect(setCalls.length).toBe(1);
      expect(setCalls[0][0].value.allow).toEqual([]);
    });
  });

  it('新增 ToolName 規則 → settings.set 含新規則', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { allow: [], deny: [], ask: [] },
      });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => screen.getByText('Add Rule'));

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'WebFetch' } });
    fireEvent.click(screen.getByText('Add Rule'));

    await waitFor(() => {
      const setCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.set',
      );
      expect(setCalls.length).toBe(1);
      expect(setCalls[0][0].value.allow).toContain('WebFetch');
    });
  });

  it('新增重複規則 → 顯示「Rule already exists」，不呼叫 settings.set', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { allow: ['WebSearch'], deny: [], ask: [] },
      });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => screen.getByText('Add Rule'));

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'WebSearch' } });
    fireEvent.click(screen.getByText('Add Rule'));

    await waitFor(() => {
      expect(screen.getByText('Rule already exists')).toBeTruthy();
      const setCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.set',
      );
      expect(setCalls.length).toBe(0);
    });
  });

  it('defaultMode 選已知值（非 bypassPermissions）→ 直接寫入無需 confirm', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: {} });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => screen.getByText('Default Mode'));

    const selects = screen.getAllByRole('combobox');
    // defaultMode select is the second combobox (first is format selector)
    const defaultModeSelect = selects[0];
    fireEvent.change(defaultModeSelect, { target: { value: 'ask' } });

    await waitFor(() => {
      const setCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.set',
      );
      expect(setCalls.length).toBe(1);
      expect(setCalls[0][0].value.defaultMode).toBe('ask');
    });
  });

  it('defaultMode 選 bypassPermissions → 顯示 ConfirmDialog，取消不寫入', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: {} });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => screen.getByText('Default Mode'));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'bypassPermissions' } });

    await waitFor(() => {
      expect(screen.getByText('Bypass Permissions')).toBeTruthy();
    });

    // 取消
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      const setCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.set',
      );
      expect(setCalls.length).toBe(0);
    });
  });

  it('defaultMode 選 bypassPermissions → 確認後寫入 bypassPermissions', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: {} });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);
    await waitFor(() => screen.getByText('Default Mode'));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'bypassPermissions' } });

    await waitFor(() => screen.getByText('Bypass Permissions'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      const setCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.set',
      );
      expect(setCalls.length).toBe(1);
      expect(setCalls[0][0].value.defaultMode).toBe('bypassPermissions');
    });
  });

  it('defaultMode 選「not set」→ settings.set payload 不含 defaultMode key', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { defaultMode: 'ask' },
      });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);
    await waitFor(() => screen.getByText('Default Mode'));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '' } });

    await waitFor(() => {
      const setCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.set',
      );
      expect(setCalls.length).toBe(1);
      expect(setCalls[0][0].value).not.toHaveProperty('defaultMode');
    });
  });

  it('settings.json defaultMode 為未知值 → 顯示「Current value: strict ⚠️」', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { defaultMode: 'strict' },
      });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('Current value: strict ⚠️')).toBeTruthy();
    });
  });

  it('settings.refresh push message → 重新 fetch', async () => {
    let pushHandler: ((msg: { type: string }) => void) | null = null;
    mockOnPushMessage.mockImplementation((handler: (msg: { type: string }) => void) => {
      pushHandler = handler;
      return () => {};
    });

    renderPage();
    await waitFor(() => screen.getByRole('combobox'));

    const beforeCount = mockSendRequest.mock.calls.filter(
      (c: any[]) => c[0]?.type === 'settings.get',
    ).length;

    // 觸發 push message
    pushHandler?.({ type: 'settings.refresh' });

    await waitFor(() => {
      const afterCount = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.get',
      ).length;
      expect(afterCount).toBeGreaterThan(beforeCount);
    });
  });
});
