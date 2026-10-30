/**
 * @vitest-environment jsdom
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

  it('渲染左側 nav：General / Display / Permissions / Env / Hooks / Advanced', async () => {
    renderPage();

    await waitFor(() => {
      const nav = screen.getByRole('navigation');
      expect(within(nav).getByText('General')).toBeTruthy();
      expect(within(nav).getByText('Display')).toBeTruthy();
      expect(within(nav).getByText('Permissions')).toBeTruthy();
      expect(within(nav).getByText('Env')).toBeTruthy();
      expect(within(nav).getByText('Hooks')).toBeTruthy();
      expect(within(nav).getByText('Advanced')).toBeTruthy();
      expect(within(nav).queryByText('Model')).toBeNull();
    });
  });

  it('左側 nav 恰好 7 個 items，順序為 General, Display, Permissions, Env, Hooks, Advanced, Customized', async () => {
    renderPage();

    await waitFor(() => {
      const nav = screen.getByRole('navigation');
      const navButtons = nav.querySelectorAll('button');
      expect(navButtons.length).toBe(7);
      const labels = Array.from(navButtons).map((b) => b.textContent);
      expect(labels).toEqual(['General', 'Display', 'Permissions', 'Env', 'Hooks', 'Advanced', 'Customized']);
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
    expect(settingsNav?.classList.contains('settings-nav--compact')).toBe(true);
    expect(settingsContent?.classList.contains('settings-content--scrollable')).toBe(true);
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

  it('搜尋 Default Mode 時，會讀取 nested permissions 值並寫回父 key', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: { defaultMode: 'plan' } });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Default Mode'));
    fireEvent.change(screen.getByPlaceholderText('Search settings...'), { target: { value: 'Default Mode' } });

    await waitFor(() => {
      const defaultModeSelect = screen.getByRole('combobox', { name: 'Default Mode' }) as HTMLSelectElement;
      expect(defaultModeSelect.value).toBe('plan');
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Default Mode' }), { target: { value: 'dontAsk' } });

    await waitFor(() => {
      const nestedCalls = getCalls('settings.setNested');
      expect(nestedCalls).toHaveLength(1);
      expect(nestedCalls[0][0]).toMatchObject({
        type: 'settings.setNested',
        scope: 'user',
        parentKey: 'permissions',
        childKey: 'defaultMode',
        value: 'dontAsk',
      });
    });
    expect(getCalls('settings.set')).toHaveLength(0);
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

  it('編輯 schema-driven 文字欄位並儲存 → sendRequest settings.set，不觸發 settings.get', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Language'));

    const getCountBefore = getCalls('settings.get').length;

    const languageInput = screen.getByPlaceholderText('e.g. zh-TW');
    const languageField = languageInput.closest('.settings-field') as HTMLElement;
    fireEvent.change(languageInput, { target: { value: 'ja' } });
    await waitFor(() => expect((languageInput as HTMLInputElement).value).toBe('ja'));
    fireEvent.click(within(languageField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const setCalls = getCalls('settings.set');
      expect(setCalls.length).toBe(1);
      expect(setCalls[0][0]).toMatchObject({
        type: 'settings.set',
        scope: 'user',
        key: 'language',
        value: 'ja',
      });
    });

    // optimistic update：save 後不觸發 settings.get
    const getCountAfter = getCalls('settings.get').length;
    expect(getCountAfter).toBe(getCountBefore);
  });

  it('handleSave optimistic update：save 後 UI 立即反映新值，settings.get mock 回舊值也不影響', async () => {
    // settings.get 永遠回傳 {} (language 未設定)，但 save 後 UI 應顯示 optimistic value
    renderPage();

    await waitFor(() => screen.getByText('Language'));
    const languageInput = screen.getByPlaceholderText('e.g. zh-TW');
    const languageField = languageInput.closest('.settings-field') as HTMLElement;
    fireEvent.change(languageInput, { target: { value: 'ja' } });
    fireEvent.click(within(languageField).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(getCalls('settings.set').length).toBe(1);
    });

    // optimistic update 後 input 應保持 ja（不被 mock 的 {} 覆蓋）
    expect((screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement).value).toBe('ja');
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

  it('點擊 Env nav → 顯示 Env 區塊（known vars）', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Env'));
    fireEvent.click(screen.getByText('Env').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText('ANTHROPIC_MODEL')).toBeTruthy();
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
      expect(screen.getByDisplayValue('MY_VAR')).toBeTruthy();
      expect(screen.getByDisplayValue('hello')).toBeTruthy();
      expect(screen.getByDisplayValue('https://api.example.com')).toBeTruthy();
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

  it('點擊規則 × 按鈕 → settings.removePermissionsListItem 只帶 listKey 與該規則（#34）', async () => {
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
      const removeCalls = getCalls('settings.removePermissionsListItem');
      expect(removeCalls.length).toBe(1);
      expect(removeCalls[0][0]).toMatchObject({ scope: 'user', listKey: 'allow', item: 'Bash(git:*)' });
      // 不帶 parentKey／整份清單
      expect(removeCalls[0][0]).not.toHaveProperty('parentKey');
      expect(removeCalls[0][0]).not.toHaveProperty('value');
    });
    expect(getCalls('settings.set')).toHaveLength(0);
    expect(getCalls('settings.setNested')).toHaveLength(0);
  });

  it('刪除最後一條規則 → settings.removePermissionsListItem（清空後留 [] 由擴充端處理，#34）', async () => {
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
      const removeCalls = getCalls('settings.removePermissionsListItem');
      expect(removeCalls.length).toBe(1);
      expect(removeCalls[0][0]).toMatchObject({ listKey: 'allow', item: 'WebSearch' });
    });
    expect(getCalls('settings.setNested')).toHaveLength(0);
  });

  it('新增 ToolName 規則 → settings.addPermissionsListItem 只帶 listKey 與新規則（#34）', async () => {
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

    const ruleInput = screen.getByPlaceholderText('e.g. WebFetch');
    fireEvent.change(ruleInput, { target: { value: 'WebFetch' } });
    fireEvent.click(screen.getByText('Add Rule'));

    await waitFor(() => {
      const addCalls = getCalls('settings.addPermissionsListItem');
      expect(addCalls.length).toBe(1);
      expect(addCalls[0][0]).toMatchObject({ scope: 'user', listKey: 'allow', item: 'WebFetch' });
      expect(addCalls[0][0]).not.toHaveProperty('parentKey');
      expect(addCalls[0][0]).not.toHaveProperty('value');
    });
    expect(getCalls('settings.setNested')).toHaveLength(0);
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

    const ruleInput = screen.getByPlaceholderText('e.g. WebFetch');
    fireEvent.change(ruleInput, { target: { value: 'WebSearch' } });
    fireEvent.click(screen.getByText('Add Rule'));

    await waitFor(() => {
      expect(screen.getByText('Rule already exists')).toBeTruthy();
      expect(getCalls('settings.set').length).toBe(0);
      expect(getCalls('settings.setNested').length).toBe(0);
      expect(getCalls('settings.addPermissionsListItem').length).toBe(0);
      expect(getCalls('settings.removePermissionsListItem').length).toBe(0);
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

    // defaultMode 已移至 General section（預設 nav），不需切換
    await waitFor(() => screen.getByText('Default Mode'));

    const defaultModeSelect = screen.getByRole('combobox', { name: 'Default Mode' });
    fireEvent.change(defaultModeSelect, { target: { value: 'dontAsk' } });

    await waitFor(() => {
      const nestedCalls = getCalls('settings.setNested');
      expect(nestedCalls.length).toBe(1);
      expect(nestedCalls[0][0]).toMatchObject({ parentKey: 'permissions', childKey: 'defaultMode', value: 'dontAsk' });
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

    await waitFor(() => screen.getByText('Default Mode'));

    fireEvent.change(screen.getByRole('combobox', { name: 'Default Mode' }), { target: { value: 'bypassPermissions' } });

    await waitFor(() => {
      expect(screen.getByText('Bypass Permissions')).toBeTruthy();
    });

    // 取消
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(getCalls('settings.set').length).toBe(0);
      expect(getCalls('settings.setNested').length).toBe(0);
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

    await waitFor(() => screen.getByText('Default Mode'));

    fireEvent.change(screen.getByRole('combobox', { name: 'Default Mode' }), { target: { value: 'bypassPermissions' } });

    await waitFor(() => screen.getByText('Bypass Permissions'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      const nestedCalls = getCalls('settings.setNested');
      expect(nestedCalls.length).toBe(1);
      expect(nestedCalls[0][0]).toMatchObject({ parentKey: 'permissions', childKey: 'defaultMode', value: 'bypassPermissions' });
    });
  });

  // #33：清子欄位一律發 settings.deleteNested；父物件變空刪整個 permissions 由擴展端完成。
  it('defaultMode 選「not set」且是 permissions 唯一 key → 發 settings.deleteNested，不發 settings.set／settings.delete', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { defaultMode: 'ask' },
      });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Default Mode'));

    fireEvent.change(screen.getByRole('combobox', { name: 'Default Mode' }), { target: { value: '' } });

    await waitFor(() => {
      const nestedCalls = getCalls('settings.deleteNested');
      expect(nestedCalls.length).toBe(1);
      expect(nestedCalls[0][0]).toMatchObject({ scope: 'user', parentKey: 'permissions', childKey: 'defaultMode' });
    });
    expect(getCalls('settings.set').length).toBe(0);
    expect(getCalls('settings.delete').length).toBe(0);
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

    await waitFor(() => {
      expect(screen.getByText('Current value: strict ⚠️')).toBeTruthy();
    });
  });

  it('切換到新 scope 時，fetch 期間顯示 loading，完成後渲染新 scope 的資料', async () => {
    let resolveProject!: (v: Record<string, unknown>) => void;
    const projectFetchPromise = new Promise<Record<string, unknown>>((res) => { resolveProject = res; });

    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project') return projectFetchPromise;
      if (msg.type === 'settings.get' && msg.scope === 'user') return Promise.resolve({ language: 'ja' });
      return Promise.resolve({});
    });

    renderPage();

    // user scope 有 language 設定
    await waitFor(() => {
      expect((screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement).value).toBe('ja');
    });

    // 切到 Project scope，project fetch 卡住
    fireEvent.click(screen.getByText('Project').closest('button')!);

    // fetch 期間顯示 loading，不顯示上一個 scope 的舊資料
    await waitFor(() => {
      expect(screen.getByText('Loading settings...')).toBeTruthy();
    });

    // project fetch 完成（language 未設定）
    resolveProject({});
    await waitFor(() => {
      expect(screen.queryByText('Loading settings...')).toBeNull();
    });

    // fetch 完成後 language input 應為空（project scope 無 language 設定）
    expect((screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement).value).toBe('');
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

  it('較舊的 scope fetch 結果晚到時，不得覆寫目前 scope 的資料', async () => {
    let resolveProject!: (v: Record<string, unknown>) => void;
    let resolveLocal!: (v: Record<string, unknown>) => void;

    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'user') return Promise.resolve({});
      if (msg.type === 'settings.get' && msg.scope === 'project') {
        return new Promise<Record<string, unknown>>((res) => { resolveProject = res; });
      }
      if (msg.type === 'settings.get' && msg.scope === 'local') {
        return new Promise<Record<string, unknown>>((res) => { resolveLocal = res; });
      }
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Project')).toBeTruthy();
      expect(screen.getByText('Local')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Project').closest('button')!);
    fireEvent.click(screen.getByText('Local').closest('button')!);

    resolveLocal({ language: 'fr' });
    await waitFor(() => {
      expect((screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement).value).toBe('fr');
    });

    resolveProject({});
    await waitFor(() => {
      expect((screen.getByPlaceholderText('e.g. zh-TW') as HTMLInputElement).value).toBe('fr');
    });
  });

});

// #35 R35-MO：主快照（user scope settings.get）晚到、內容區在 act 外掛載時，
// 輸入框一出現就同步輸入並按 Save，不得被掛載時的同步蓋回空白
describe('SettingsPage #35 輸入框掛載後立即輸入並儲存', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('settings.get(user) 晚到：輸入框一出現就輸入 ja 並 Save → set 1 次（ja）、delete 0 次', async () => {
    let resolveUserGet!: (v: unknown) => void;
    const userGet = new Promise((resolve) => {
      resolveUserGet = resolve;
    });
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return msg.scope === 'user' ? userGet : Promise.resolve({});
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => {
      expect(getCalls('settings.get').some((c) => c[0]?.scope === 'user')).toBe(true);
    });

    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const prevActEnv = g.IS_REACT_ACT_ENVIRONMENT;
    g.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      const selector = 'input[placeholder="e.g. zh-TW"]';
      const appeared = new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          if (document.querySelector(selector)) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });
      resolveUserGet({});
      await appeared;
    } finally {
      g.IS_REACT_ACT_ENVIRONMENT = prevActEnv;
    }

    // 同步輸入並按 Save，中間不讓出控制權給 passive effect
    const input = document.querySelector('input[placeholder="e.g. zh-TW"]') as HTMLInputElement;
    const field = input.closest('.settings-field') as HTMLElement;
    fireEvent.change(input, { target: { value: 'ja' } });
    fireEvent.click(within(field).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(getCalls('settings.set')).toHaveLength(1));
    expect(getCalls('settings.set')[0][0]).toMatchObject({ scope: 'user', key: 'language', value: 'ja' });
    expect(getCalls('settings.delete')).toHaveLength(0);
  });
});

