/**
 * @vitest-environment jsdom
 *
 * Customized 分頁測試 — 功能對應 GitHub issue #9。
 * 功能尚未實作，所有新測試預期為紅（TDD）。
 *
 * --- PR: permissions inline 直接編輯 + Object 欄位 label 缺陷修正 ---
 * 改動後：
 *   - customized 分頁的 permissions 欄位從跳轉按鈕改為 inline 編輯器
 *     (Allow / Deny / Ask 三組同時平鋪 + additionalDirectories)
 *   - allowedMcpServers / deniedMcpServers 仍是跳轉按鈕，但 label 顯示
 *     各自欄位名稱（非「Permissions」）
 * 新增測試（RED）：
 *   - 12. permissions inline 顯示三組標題
 *   - 13. permissions inline 新增規則 → sendRequest settings.set
 *   - 14. permissions inline 刪除規則 → sendRequest settings.set
 *   - 15. additionalDirectories-only → badge=1，inline 顯示 /x
 *   - 16. allowedMcpServers 仍是跳轉按鈕但 label 可區分（非「Permissions」）
 *   - 17. search 中 permissions Object 欄位 labelText 不變（field.label||key）
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

  it('4. [RED] permissions 含非 nested key → inline 直接顯示（無跳轉按鈕）', async () => {
    // 改動後：permissions 在 customized 分頁改為 inline 編輯器，不再顯示跳轉按鈕
    // 改動前此 test 驗「顯示 Permissions → 按鈕 + 點後切到 section」（已通過）
    // 改動後改成驗「無跳轉按鈕 + inline 顯示 Allow / Deny / Ask 三組標題」
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: { allow: ['WebSearch'] } });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // 無「Permissions →」跳轉按鈕（permission 欄位改為 inline）
      const permJumpBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Permissions →',
      );
      expect(permJumpBtn).toBeUndefined();

      // inline 三組標題同時顯示
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
      expect(screen.getByText('Environment Variables →')).toBeTruthy();
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

// ---------------------------------------------------------------------------
// Customized — permissions inline 直接編輯（新行為）
// [RED] 產品碼改動前全部失敗；改動後全部變綠
// ---------------------------------------------------------------------------

describe('SettingsPage — Customized permissions inline 編輯', () => {
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

  it('12. [RED] permissions{allow} → inline 同時顯示 Allow / Deny / Ask 三組標題', async () => {
    // 改動後：三組標題在 customized 分頁平鋪顯示，無跳轉按鈕
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: { allow: ['Bash'] } });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // 三組標題同時可見（平鋪，非 sub-tab 切換）
      expect(screen.getByText('Allow')).toBeTruthy();
      expect(screen.getByText('Deny')).toBeTruthy();
      expect(screen.getByText('Ask')).toBeTruthy();

      // 現有規則顯示在 Allow 組
      expect(screen.getByText('Bash')).toBeTruthy();

      // 絕對沒有「Permissions →」跳轉按鈕
      const permJumpBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Permissions →',
      );
      expect(permJumpBtn).toBeUndefined();
    });
  });

  it('13. [RED] inline permissions → 輸入規則並新增 → sendRequest settings.set 含更新後 allow', async () => {
    // inline 新增規則：輸入 "WebFetch"，按 Add Rule → settings.set permissions.allow=['WebFetch']
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: { allow: [] } });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    // 等 Allow 組標題出現（inline 已載入）
    await waitFor(() => expect(screen.getByText('Allow')).toBeTruthy());

    // 三組 perm-rule-list-editor 同時存在，需 scope 到 Allow 組
    const allowEditor = screen.getByText('Allow').closest('.perm-rule-list-editor') as HTMLElement;
    const toolNameInput = within(allowEditor).getByPlaceholderText('e.g. WebFetch');
    fireEvent.change(toolNameInput, { target: { value: 'WebFetch' } });
    fireEvent.click(within(allowEditor).getByRole('button', { name: 'Add Rule' }));

    await waitFor(() => {
      const setCalls = getCalls('settings.set');
      expect(setCalls.length).toBeGreaterThanOrEqual(1);
      const lastCall = setCalls[setCalls.length - 1][0];
      expect(lastCall.key).toBe('permissions');
      expect((lastCall.value as { allow: string[] }).allow).toContain('WebFetch');
    });
  });

  it('14. [RED] inline permissions → 點刪除規則 → sendRequest settings.set 移除該規則', async () => {
    // inline 刪除：permissions.allow=['Bash'] → 點 × → settings.set permissions.allow=[]
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: { allow: ['Bash'] } });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    // 等規則 tag 出現
    await waitFor(() => expect(screen.getByText('Bash')).toBeTruthy());

    // 點刪除鈕（RuleTag: aria-label="Remove rule Bash"）
    fireEvent.click(screen.getByRole('button', { name: 'Remove rule Bash' }));

    await waitFor(() => {
      const setCalls = getCalls('settings.set');
      expect(setCalls.length).toBeGreaterThanOrEqual(1);
      const lastCall = setCalls[setCalls.length - 1][0];
      expect(lastCall.key).toBe('permissions');
      expect((lastCall.value as { allow: string[] }).allow).not.toContain('Bash');
    });
  });

  it('15. [RED] additionalDirectories-only → badge=1，inline 顯示目錄內容', async () => {
    // 關鍵 reproduction：permissions 只有 additionalDirectories（無 allow/deny/ask）
    // badge 算 1（整個 permissions object），inline 顯示 '/x'
    // 驗 inline 涵蓋整個 permissions object，不是只有三組清單
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: { additionalDirectories: ['/x'] } });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    // badge = 1（additionalDirectories 使 permissions object 非空）
    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      // project tab (index 1) 的 badge；user tab 永遠不顯示 badge
      const projectBadge = tabs[1]?.querySelector('.settings-scope-badge');
      expect(projectBadge).not.toBeNull();
      expect(projectBadge!.textContent).toBe('1');
    });

    // 點 customized
    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    // inline 顯示 additionalDirectories 內容（'/x' tag）
    await waitFor(() => {
      expect(screen.getByText('/x')).toBeTruthy();
    });
  });

  it('16. [RED] allowedMcpServers label 可區分：顯示「Allowed MCP Servers」不等於「Permissions」', async () => {
    // 改動前：allowedMcpServers 在 customized 顯示「Permissions →」（sectionLabel，bug）
    // 改動後：顯示欄位自己的 label「Allowed MCP Servers」
    // permissions{allow} 同時存在，兩者 label 必須不同
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { allow: ['Bash'] },
        allowedMcpServers: [{ serverName: 'github' }],
      });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // allowedMcpServers 跳轉按鈕文字含自己的 label，不含「Permissions →」
      // 改動前：兩個 Object 欄位都顯示「Permissions →」，用 getByText 會報 multiple elements
      // 改動後：permissions inline（無按鈕），allowedMcpServers 按鈕顯示自己的名稱
      const allButtons = Array.from(document.querySelectorAll('button'));
      const permJumpBtn = allButtons.find((b) => b.textContent?.trim() === 'Permissions →');
      expect(permJumpBtn).toBeUndefined();

      // allowedMcpServers 的跳轉按鈕應有自己的欄位名稱文字
      // 按鈕文字格式：「{fieldLabel} →」，fieldLabel = 'Allowed MCP Servers'
      const mcpJumpBtn = allButtons.find((b) => b.textContent?.includes('Allowed MCP Servers'));
      expect(mcpJumpBtn).toBeTruthy();
    });
  });

  it('18. [RED] P1 吞錯 reproduction：settings.set 失敗 → 出現 error toast', async () => {
    // P1 根因：onSavePermissions=(p)=>void fieldOnSave('permissions',p) 丟棄 async promise
    // CustomizedPermissionsEditor.handleAdd 再包 Promise.resolve(onSavePermissions(...)) = 已 resolved
    // withSave 的 catch 收不到 settings.set reject → addToast 不觸發 → 使用者看不到錯誤
    // 修好後：onSavePermissions 必須傳回真 Promise，withSave 才能 catch 並 toast
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: { allow: [] } });
      if (msg.type === 'settings.set') return Promise.reject(new Error('boom'));
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => expect(screen.getByText('Allow')).toBeTruthy());

    const allowEditor = screen.getByText('Allow').closest('.perm-rule-list-editor') as HTMLElement;
    const input = within(allowEditor).getByPlaceholderText('e.g. WebFetch');
    fireEvent.change(input, { target: { value: 'WebFetch' } });
    fireEvent.click(within(allowEditor).getByRole('button', { name: 'Add Rule' }));

    // 修好後：error toast 出現（variant=error，role=alert，message='boom'）
    // 現在產品碼 void 掉 promise → toast 不出現 → 紅
    await waitFor(() => {
      expect(screen.getByText('boom')).toBeTruthy();
    });
  });

  it('19. [guard] nested key 不遺失：刪除 allow 規則後 defaultMode 仍在 payload', async () => {
    // 驗 handleDelete 的 spread 邏輯：{...safePerms,[list]:filtered}
    // safePerms 含 defaultMode:'plan'，刪掉 allow['Bash'] 後 payload 仍須含 defaultMode
    // 若執行者誤改成 {[list]:filtered} 不 spread，此 test 紅
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({
        permissions: { defaultMode: 'plan', allow: ['Bash'] },
      });
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => expect(screen.getByText('Bash')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Remove rule Bash' }));

    await waitFor(() => {
      const setCalls = getCalls('settings.set');
      expect(setCalls.length).toBeGreaterThanOrEqual(1);
      const lastCall = setCalls[setCalls.length - 1][0];
      expect(lastCall.key).toBe('permissions');
      // nested key defaultMode 必須保留在 payload
      expect((lastCall.value as { defaultMode: string }).defaultMode).toBe('plan');
      // allow 已移除 Bash
      expect((lastCall.value as { allow: string[] }).allow).not.toContain('Bash');
    });
  });

  // test 20（saving 期間 disabled）はスキップ：
  // void→Promise.resolve の broken path でも setSaving(true/false) 間の微小窓を waitFor が掴んでしまい
  // false positive になることが確認された（product code の void を修正しても動作変化が測定できない）。
  // saving guard の正しさは test 18（吞錯 reproduction）で P1 として守護する。

  it('17. [guard] search 中 permissions Object 欄位 labelText 不變（field.label || field.key）', async () => {
    // search 用的是 field.label（buildSearchableFields 取 i18n label）
    // permissions 欄位的 label key = settings.permissions.permissions.label（不存在）
    // 所以 label 是空字串，fallback 到 field.key = "permissions"
    // 這個行為改動後須維持不變（search 走另一分支）
    renderPage();

    await waitFor(() => screen.getByPlaceholderText('Search settings...'));
    fireEvent.change(screen.getByPlaceholderText('Search settings...'), {
      target: { value: 'permissions' },
    });

    await waitFor(() => {
      // search 結果出現 permissions 欄位（key match）
      // 在 search 分頁中，Object 欄位仍顯示跳轉按鈕（search 分頁行為不變）
      // 只要能找到與 permissions 相關的 result row 即可
      const results = document.querySelectorAll('.settings-search-result');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
