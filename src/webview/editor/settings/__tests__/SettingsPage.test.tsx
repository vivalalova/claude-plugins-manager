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

const getCalls = (type: string): any[][] =>
  mockSendRequest.mock.calls.filter((c: any[]) => c[0]?.type === type);

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

  it('左側 nav 恰好 7 個 items，順序為 General, Display, Model, Permissions, Env, Hooks, Advanced', async () => {
    renderPage();

    await waitFor(() => {
      const nav = screen.getByRole('navigation');
      const navButtons = nav.querySelectorAll('button');
      expect(navButtons.length).toBe(7);
      const labels = Array.from(navButtons).map((b) => b.textContent);
      expect(labels).toEqual(['General', 'Display', 'Model', 'Permissions', 'Env', 'Hooks', 'Advanced']);
    });
  });

  it('點擊 Display nav → 顯示 Display section title', async () => {
    renderPage();

    await waitFor(() => screen.getByRole('navigation'));
    const nav = screen.getByRole('navigation');
    const displayBtn = Array.from(nav.querySelectorAll('button')).find((b) => b.textContent === 'Display')!;
    fireEvent.click(displayBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Display' })).toBeTruthy();
    });
  });

  it('只有右側內容區是 scroll container，scope tabs 與左側 nav 保持固定 shell', async () => {
    const { container } = renderPage();

    await waitFor(() => screen.getByRole('navigation'));

    const settingsPage = container.querySelector('.settings-page');
    const scopeTabs = container.querySelector('.settings-scope-tabs');
    const settingsBody = container.querySelector('.settings-body');
    const settingsNav = container.querySelector('.settings-nav');
    const settingsContent = container.querySelector('.settings-content');

    expect(settingsPage?.classList.contains('settings-page--fixed-shell')).toBe(true);
    expect(scopeTabs?.classList.contains('settings-scope-tabs--fixed')).toBe(true);
    expect(settingsBody?.classList.contains('settings-body--fixed-shell')).toBe(true);
    expect(settingsNav?.classList.contains('settings-nav--fixed')).toBe(true);
    expect(settingsContent?.classList.contains('settings-content--scrollable')).toBe(true);
  });

  it('點擊 Advanced nav → 顯示 Advanced section title', async () => {
    renderPage();

    await waitFor(() => screen.getByRole('navigation'));
    const nav = screen.getByRole('navigation');
    const advancedBtn = Array.from(nav.querySelectorAll('button')).find((b) => b.textContent === 'Advanced')!;
    fireEvent.click(advancedBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Advanced' })).toBeTruthy();
    });
  });

  it('Display 區塊刪除既有 spinner verb 後，optimistic update 不會清空未送出的草稿', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        spinnerVerbs: { mode: 'append', verbs: ['Thinking', 'Working'] },
      });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByRole('navigation'));
    fireEvent.click(screen.getByText('Display').closest('button')!);

    await waitFor(() => screen.getByPlaceholderText('e.g. Thinking'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Thinking'), { target: { value: 'Draft verb' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Thinking' }));

    await waitFor(() => {
      const setCalls = getCalls('settings.set');
      expect(setCalls.some((call) => (
        call[0]?.key === 'spinnerVerbs'
        && call[0]?.value?.mode === 'append'
        && Array.isArray(call[0]?.value?.verbs)
        && call[0].value.verbs.length === 1
        && call[0].value.verbs[0] === 'Working'
      ))).toBe(true);
    });

    expect((screen.getByPlaceholderText('e.g. Thinking') as HTMLInputElement).value).toBe('Draft verb');
  });

  it('預設顯示 General 區塊', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Effort Level')).toBeTruthy();
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

    await waitFor(() => screen.getByText('Model'));
    fireEvent.click(screen.getByText('Model').closest('button')!);

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const modelSelect = selects.find((s) => s.className.includes('settings-model-select'));
      expect(modelSelect?.value).toBe('claude-opus-4-6');
    });
  });

  it('Model 區塊顯示 setting key hint', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Model'));
    fireEvent.click(screen.getByText('Model').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('(model)')).toBeTruthy();
    });
  });

  it('點擊切換到 Project scope → 重新 fetch settings', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Project'));
    fireEvent.click(screen.getByText('Project').closest('button')!);

    await waitFor(() => {
      const settingsGetCalls = getCalls('settings.get');
      // user scope + project scope = 2 calls
      expect(settingsGetCalls.length).toBeGreaterThanOrEqual(2);
      expect(settingsGetCalls.some((c) => c[0]?.scope === 'project')).toBe(true);
    });
  });

  it('選擇 model 並點擊 Save → sendRequest settings.set，不觸發 settings.get', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Model'));
    fireEvent.click(screen.getByText('Model').closest('button')!);

    await waitFor(() => screen.getAllByRole('combobox'));

    const getCountBefore = getCalls('settings.get').length;

    const modelSelect = (screen.getAllByRole('combobox') as HTMLSelectElement[])
      .find((s) => s.className.includes('settings-model-select'))!;
    fireEvent.change(modelSelect, { target: { value: 'claude-sonnet-4-6' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      const setCalls = getCalls('settings.set');
      expect(setCalls.length).toBe(1);
      expect(setCalls[0][0]).toMatchObject({
        type: 'settings.set',
        scope: 'user',
        key: 'model',
        value: 'claude-sonnet-4-6',
      });
    });

    // optimistic update：save 後不觸發 settings.get
    const getCountAfter = getCalls('settings.get').length;
    expect(getCountAfter).toBe(getCountBefore);
  });

  it('model 已設定時顯示 Clear 按鈕，點擊後 sendRequest settings.delete，不觸發 settings.get', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ model: 'claude-sonnet-4-6' });
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Model'));
    fireEvent.click(screen.getByText('Model').closest('button')!);

    await waitFor(() => screen.getByText('Clear'));

    const getCountBefore = getCalls('settings.get').length;

    fireEvent.click(screen.getByText('Clear'));

    await waitFor(() => {
      const deleteCalls = getCalls('settings.delete');
      expect(deleteCalls.length).toBe(1);
      expect(deleteCalls[0][0]).toMatchObject({
        type: 'settings.delete',
        scope: 'user',
        key: 'model',
      });
    });

    // optimistic update：delete 後不觸發 settings.get
    const getCountAfter = getCalls('settings.get').length;
    expect(getCountAfter).toBe(getCountBefore);
  });

  it('handleSave optimistic update：save 後 UI 立即反映新值，settings.get mock 回舊值也不影響', async () => {
    // settings.get 永遠回傳 {} (model 未設定)，但 save 後 UI 應顯示 optimistic value
    renderPage();

    await waitFor(() => screen.getByText('Model'));
    fireEvent.click(screen.getByText('Model').closest('button')!);

    await waitFor(() => screen.getAllByRole('combobox'));
    const modelSelect = (screen.getAllByRole('combobox') as HTMLSelectElement[])
      .find((s) => s.className.includes('settings-model-select'))!;
    fireEvent.change(modelSelect, { target: { value: 'claude-sonnet-4-6' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(getCalls('settings.set').length).toBe(1);
    });

    // optimistic update 後 select 應保持 claude-sonnet-4-6（不被 mock 的 {} 覆蓋）
    const updatedSelect = (screen.getAllByRole('combobox') as HTMLSelectElement[])
      .find((s) => s.className.includes('settings-model-select'))!;
    expect(updatedSelect.value).toBe('claude-sonnet-4-6');
  });

  it('預設顯示 General 區塊（Effort Level / Language / Fast Mode）', async () => {
    renderPage();

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
      const setCalls = getCalls('settings.set');
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
      const setCalls = getCalls('settings.set');
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
      const setCalls = getCalls('settings.set');
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
      expect(getCalls('settings.set').length).toBe(0);
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
      const setCalls = getCalls('settings.set');
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
      expect(getCalls('settings.set').length).toBe(0);
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
      const setCalls = getCalls('settings.set');
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
      const setCalls = getCalls('settings.set');
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
    const capture: { fn: ((msg: { type: string }) => void) | null } = { fn: null };
    mockOnPushMessage.mockImplementation(((h: (msg: { type: string }) => void) => {
      capture.fn = h;
      return () => {};
    }) as () => () => void);

    renderPage();
    await waitFor(() => screen.getAllByRole('combobox'));

    const beforeCount = getCalls('settings.get').length;

    // 觸發 push message
    capture.fn?.({ type: 'settings.refresh' });

    await waitFor(() => {
      expect(getCalls('settings.get').length).toBeGreaterThan(beforeCount);
    });
  });
});
