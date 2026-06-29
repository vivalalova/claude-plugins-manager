/**
 * @vitest-environment jsdom
 *
 * Issue #8 — Scope tab badge：顯示該層設定項數量
 *
 * Bug（已確認）：badge 目前 = Object.keys(scopeSettings).length（top-level key 數），
 * 把 enabledPlugins / $schema / feedbackSurveyState / 空 permissions:{} 也算進去，
 * 導致「badge ≥1 但已自訂分頁空白」的矛盾。
 *
 * 正確口徑 = collectCustomizedSchemaFields(scopeSettings).length + getUnknownSettingsEntries(scopeSettings).length
 * 即 badge 數 === 點進「已自訂」分頁看到的項數。
 *
 * 紅燈：reproduction 和新口徑的斷言在未修 code 失敗（證明 bug 存在）。
 * 綠燈：修好後所有測試轉綠。
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

/** 取某個 scope-tab 上的 badge span，不存在則 null */
function getScopeBadge(container: HTMLElement, scopeIndex: number): HTMLElement | null {
  const tabs = container.querySelectorAll('.settings-scope-tab');
  const tab = tabs[scopeIndex];
  if (!tab) return null;
  return tab.querySelector('.settings-scope-badge');
}

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
  // Bug reproduction（未修 code 紅；修後綠）
  // ---------------------------------------------------------------------------

  it('[RED] enabledPlugins 是 hidden key → badge 應為 0（無 badge span）', async () => {
    // 口徑差異：current code 計 top-level key = 1，正確 = 0
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ enabledPlugins: { 'some-plugin': {} } }); // hidden key
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect((tabs[1] as HTMLButtonElement).disabled).toBe(false);
    });

    // Badge 必須不存在（0 items）
    // 當前未修 code：badge span 存在且顯示 "1" → test 紅，證明 bug
    await waitFor(() => {
      expect(getScopeBadge(container, 1)).toBeNull();
    });
  });

  it('[RED] $schema 是 hidden key → badge 應為 0（無 badge span）', async () => {
    // local 有 model:'x' 作紅燈錨：確認 loadScopeCounts 已完成，才能判定 project badge 的真實值
    // 舊口徑：project top-level key = 1 → badge "1"；正確口徑：0 → 無 badge
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ $schema: 'https://json.schemastore.org/claude-code-settings.json' });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ model: 'x' }); // 錨點：local badge "1" 出現表示 fetch 完成
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    // 等 local badge "1" 出現，確認 loadScopeCounts 已完成
    await waitFor(() => {
      const localBadge = getScopeBadge(container, 2);
      expect(localBadge).not.toBeNull();
      expect(localBadge!.textContent).toBe('1');
    });

    // project 只有 $schema（hidden key）→ 無 badge
    // 舊口徑：project badge = "1" → 此斷言紅，證明 bug
    expect(getScopeBadge(container, 1)).toBeNull();
  });

  it('[RED] feedbackSurveyState 是 hidden key → badge 應為 0（無 badge span）', async () => {
    // local 有 model:'x' 作紅燈錨：確認 loadScopeCounts 已完成
    // 舊口徑：project top-level key = 1 → badge "1"；正確口徑：0 → 無 badge
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ feedbackSurveyState: { dismissed: true } });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ model: 'x' }); // 錨點：local badge "1" 出現表示 fetch 完成
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    // 等 local badge "1" 出現，確認 loadScopeCounts 已完成
    await waitFor(() => {
      const localBadge = getScopeBadge(container, 2);
      expect(localBadge).not.toBeNull();
      expect(localBadge!.textContent).toBe('1');
    });

    // project 只有 feedbackSurveyState（hidden key）→ 無 badge
    // 舊口徑：project badge = "1" → 此斷言紅，證明 bug
    expect(getScopeBadge(container, 1)).toBeNull();
  });

  it('[RED] permissions:{} 空物件 → badge 應為 0（無 badge span）', async () => {
    // 口徑差異：current code 計 top-level key = 1（permissions 算 1），正確 = 0（空物件不算）
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ permissions: {} }); // 空 permissions
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      expect(getScopeBadge(container, 1)).toBeNull();
    });
  });

  it('[RED] permissions:{defaultMode, allow} → badge 應為 2（defaultMode 1 + permissions card 1）', async () => {
    // 口徑差異：current code 計 top-level key = 1（permissions 算 1），正確 = 2
    // defaultMode 是 nestedUnder:'permissions' → 在 customized 顯示為獨立 row（算 1）
    // allow 是非 nested key → 出現 Permissions 跳轉卡片（算 1）
    // 共 2
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ permissions: { defaultMode: 'acceptEdits', allow: ['Bash'] } });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('2');
    });
  });

  // ---------------------------------------------------------------------------
  // 正確口徑（部分在未修 code 已綠，因舊新口徑恰好一致）
  // ---------------------------------------------------------------------------

  it('permissions:{defaultMode} → badge = 1（nested row 算 1；top-level key 數也是 1，新舊一致）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ permissions: { defaultMode: 'acceptEdits' } });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });
  });

  it('model:"opus" → badge = 1（schema key，新舊一致）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ model: 'opus' });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });
  });

  it('model + env + someUnknown → badge = 3（schema×2 + unknown×1；top-level key 數也 3，新舊一致）', async () => {
    // model = schema scalar row（1）
    // env = schema Object → Env 跳轉卡片（1）
    // someUnknown = unknown entry（1）
    // total = 3（舊口徑 top-level key 也 3 → 新舊恰好一致）
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ model: 'opus', env: { A: '1' }, someUnknown: 'x' });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('3');
    });
  });

  // ---------------------------------------------------------------------------
  // Badge 顯示 — 基本 schema fields（重寫舊口徑測試，改用精確斷言）
  // ---------------------------------------------------------------------------

  it('Project / Local 有 schema 設定時，tab 顯示正確 badge 數字', async () => {
    // project: { model: 'x', env: { A: '1' } } → model(1) + env card(1) = 2
    // local: { permissions: {} } → 空 permissions 不算 → 0（無 badge）
    // 注意：local badge 改為 0（空 permissions 不算），這在舊口徑顯示 1，是修後才綠的改動
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ model: 'x', env: { A: '1' } });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ permissions: {} }); // 空 permissions → 新口徑 0
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      const tabs = container.querySelectorAll('.settings-scope-tab');
      expect((tabs[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      // project badge = 2
      const projectBadge = getScopeBadge(container, 1);
      expect(projectBadge).not.toBeNull();
      expect(projectBadge!.textContent).toBe('2');
    });

    // local badge 不存在（空 permissions → 0 items）
    // 舊口徑此處顯示 "1" → 修後才綠
    await waitFor(() => {
      expect(getScopeBadge(container, 2)).toBeNull();
    });
  });

  it('0 個 customized 項時，該 tab 不顯示 badge span', async () => {
    // project: { theme: 'dark', model: 'x' } → theme 在 display section，model 在 general；都是 schema scalar → 2 items
    // local: {} → 0 → no badge
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ theme: 'dark', model: 'x' });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({});
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      // project badge = 2（red-light anchor）
      const projectBadge = getScopeBadge(container, 1);
      expect(projectBadge).not.toBeNull();
      expect(projectBadge!.textContent).toBe('2');
    });

    // local: no badge
    expect(getScopeBadge(container, 2)).toBeNull();
  });

  it('User tab 永遠不顯示 badge（project badge 作紅燈錨）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ a: 1, b: 2, c: 3 }); // 3 unknown keys → badge "3" (red-light anchor)
      if (msg.type === 'settings.get' && msg.scope === 'user')
        return Promise.resolve({ language: 'zh-TW', model: 'x', theme: 'dark' });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      // project badge = 3（red-light anchor）
      const projectBadge = getScopeBadge(container, 1);
      expect(projectBadge).not.toBeNull();
      expect(projectBadge!.textContent).toBe('3');
    });

    // user tab (index 0) badge 永遠不顯示
    expect(getScopeBadge(container, 0)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Guard（功能前後皆 GREEN）
  // ---------------------------------------------------------------------------

  it('（guard）無 workspace 時，不對 project/local 發 count 用 settings.get', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([]);
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

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
  // Push refresh → badge 即時更新（未實作時 RED）
  // ---------------------------------------------------------------------------

  it('settings.refresh push 後，badge 數量即時更新', async () => {
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
          projectKeyCount === 1 ? { model: 'x' } : { model: 'x', language: 'ja' },
        );
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    // Initial: project badge = 1
    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });

    // Simulate external change: project now returns 2 schema keys
    projectKeyCount = 2;

    for (const handler of pushHandlers) {
      handler({ type: 'settings.refresh' });
    }

    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('2');
    });
  });

  // ---------------------------------------------------------------------------
  // Optimistic count（mutation 級可信）
  // ---------------------------------------------------------------------------

  it('save 新 schema key → Project tab badge +1（optimistic），不觸發 settings.get', async () => {
    // Project scope 初始為空 → 無 badge
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
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(container.querySelectorAll('.settings-scope-tab')[1]);

    // 等 Project scope 載入（Language placeholder 可見）
    await waitFor(() => screen.getByPlaceholderText('e.g. zh-TW'));

    // 確認初始無 badge
    expect(getScopeBadge(container, 1)).toBeNull();

    // 記錄目前 settings.get call 數
    const getCallsBefore = getCalls('settings.get').length;

    // 在 Language 欄位填值並 Save
    const languageInput = screen.getByPlaceholderText('e.g. zh-TW');
    const languageField = languageInput.closest('.settings-field') as HTMLElement;
    fireEvent.change(languageInput, { target: { value: 'ja' } });
    fireEvent.click(within(languageField).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(getCalls('settings.set').length).toBe(1));

    // Optimistic +1 → badge 出現 "1"
    // Mutation kill：把 +1 改 +2 → badge 顯示 "2" → 紅
    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });

    // 存/刪不可觸發 settings.get（call 數不得增加）
    expect(getCalls('settings.get').length).toBe(getCallsBefore);
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
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(container.querySelectorAll('.settings-scope-tab')[1]);

    // 等 badge "1" 出現
    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });

    const getCallsBefore = getCalls('settings.get').length;

    // 改 Language 值（key 已存在）
    const languageInput = screen.getByPlaceholderText('e.g. zh-TW');
    const languageField = languageInput.closest('.settings-field') as HTMLElement;
    fireEvent.change(languageInput, { target: { value: 'fr' } });
    fireEvent.click(within(languageField).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(getCalls('settings.set').length).toBe(1));

    // 既有 key 改值 → badge 不變，仍為 "1"
    // Mutation kill：重算誤把已存在 key 當新增（next settings 含原本就有的 language）→ badge 變 "2" → 紅
    const badge = getScopeBadge(container, 1);
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('1');

    // 不觸發 settings.get
    expect(getCalls('settings.get').length).toBe(getCallsBefore);
  });

  it('delete 已存在 key → Project badge -1（optimistic），不觸發 settings.get', async () => {
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
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(container.querySelectorAll('.settings-scope-tab')[1]);

    // 等 badge "1" 出現
    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });

    const getCallsBefore = getCalls('settings.get').length;

    // 按 Reset Language → 呼叫 onDelete('language')
    await waitFor(() => screen.getByRole('button', { name: 'Reset Language' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Language' }));

    await waitFor(() => expect(getCalls('settings.delete').length).toBe(1));

    // Optimistic 重算 → count 0 → badge 消失
    // Mutation kill：重算未用刪除後的 next（仍含該 key）→ badge 不歸 0 → 紅
    await waitFor(() => {
      expect(getScopeBadge(container, 1)).toBeNull();
    });

    // 不觸發 settings.get
    expect(getCalls('settings.get').length).toBe(getCallsBefore);
  });
});

// ---------------------------------------------------------------------------
// Bug reproduction — permissions 空子清單的 badge 計數與渲染不一致
//
// Bug：collectCustomizedSchemaFields 對 permissions 只看 key 是否存在（`Object.keys(perms).some(...)`)，
// 不看值是否為空陣列；但 CustomizedPermissionsEditor 對空子清單 return null（不渲染）。
// 結果：{ allow: [] } 或 { additionalDirectories: [] } 使 badge +1，但 Customized 分頁卻空白。
//
// 正確口徑：badge 計入 permissions iff CustomizedPermissionsEditor 會 render 至少一個子清單，
// 即至少一個非 nested key（allow/deny/ask/additionalDirectories）持有非空陣列。
// ---------------------------------------------------------------------------

describe('SettingsPage — badge 計數：permissions 空子清單 bug reproduction', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // [RED] 1. permissions:{ allow: [] } → badge 應為 0
  // 目前 code 因 `Object.keys(perms).some(k => !PERMISSIONS_NESTED_KEYS.has(k))` 看到 "allow" key
  // 存在就算 1，但 CustomizedPermissionsEditor 對空陣列 return null → 空白面板。
  // 使用 anchor pattern：local scope 有 { model: 'x' } → badge "1" 出現後再斷言 project badge。
  // -------------------------------------------------------------------------

  it('[RED] permissions:{ allow: [] } 空陣列 → project badge 應為 0（無 badge span）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ permissions: { allow: [] } });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ model: 'x' }); // 錨點：local badge "1" 出現表示 loadScopeCounts 完成
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    // 等 local badge "1" 出現，確認 loadScopeCounts 已完成（避免「尚未載入→null」誤判為通過）
    await waitFor(() => {
      const localBadge = getScopeBadge(container, 2);
      expect(localBadge).not.toBeNull();
      expect(localBadge!.textContent).toBe('1');
    });

    // project 只有 permissions:{ allow:[] }（空陣列）→ 應無 badge
    // 當前未修 code：badge span 存在且顯示 "1" → 此斷言紅，reproduction 確認
    expect(getScopeBadge(container, 1)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // [GREEN] 2. 對照組：permissions:{ allow: ['Bash(ls)'] } 非空 → badge 為 1
  // 防止修 bug 時矯枉過正，把非空陣列也誤算為 0。
  // -------------------------------------------------------------------------

  it('[GREEN guard] permissions:{ allow: [\'Bash(ls)\'] } 非空 → project badge 為 1', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ permissions: { allow: ['Bash(ls)'] } });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });
  });

  // -------------------------------------------------------------------------
  // [RED optional] 3. permissions:{ additionalDirectories: [] } 空 → badge 0
  // -------------------------------------------------------------------------

  it('[RED] permissions:{ additionalDirectories: [] } 空陣列 → project badge 應為 0（無 badge span）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ permissions: { additionalDirectories: [] } });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ model: 'x' }); // 錨點
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    // 等 local badge "1"（錨點：loadScopeCounts 完成）
    await waitFor(() => {
      const localBadge = getScopeBadge(container, 2);
      expect(localBadge).not.toBeNull();
      expect(localBadge!.textContent).toBe('1');
    });

    // project 只有 permissions:{ additionalDirectories:[] }（空陣列）→ 應無 badge
    expect(getScopeBadge(container, 1)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // [GREEN optional guard] 4. permissions:{ additionalDirectories: ['/x'] } 非空 → badge 1
  // -------------------------------------------------------------------------

  it('[GREEN guard] permissions:{ additionalDirectories: [\'/x\'] } 非空 → project badge 為 1', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ permissions: { additionalDirectories: ['/x'] } });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });
  });

  // -------------------------------------------------------------------------
  // [RED render optional] 5. permissions:{ allow: [] } 時已自訂分頁出現空狀態訊息
  // CustomizedPermissionsEditor 整體 return null（空容器），collectCustomizedSchemaFields
  // 不計入 → 已自訂分頁沒有任何欄位 → 出現空狀態訊息。
  // 目前 bug：collectCustomizedSchemaFields 計入了 permissions → 傳入 CustomizedPermissionsEditor
  // → 它 render 空容器 → 畫面無任何規則，但頁面不顯示空狀態訊息（Customized 分頁有被視為「有內容」）。
  // -------------------------------------------------------------------------

  it('[RED render] permissions:{ allow: [] } → 已自訂分頁出現空狀態訊息（無 permissions 區塊）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ permissions: { allow: [] } });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    fireEvent.click(screen.getByText('Customized').closest('button')!);

    await waitFor(() => {
      // 空狀態訊息必須出現（badge=0 與 render 一致）
      expect(screen.getByText('No customized settings in this scope.')).toBeTruthy();
      // Allow/Deny/Ask 標題不應出現（空陣列不渲染）
      expect(screen.queryByText('Allow')).toBeNull();
      expect(screen.queryByText('Deny')).toBeNull();
      expect(screen.queryByText('Ask')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // [GREEN guard] nested-only permissions 行為不受影響：
  // permissions:{ defaultMode: 'plan' } → badge 仍為 1（defaultMode 以頂層 row 計入，
  // permissions card 本身因無非 nested key 而不計入，但 defaultMode 走 nestedUnder 路徑另算 1）
  // -------------------------------------------------------------------------

  it('[GREEN guard] permissions:{ defaultMode: \'plan\' } nested-only → badge 仍為 1（行為不受本 bug 修正影響）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ permissions: { defaultMode: 'plan' } });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });

    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });
  });
});

// ---------------------------------------------------------------------------
// Bug reproduction — 空容器（{} / []）被當已自訂計入
//
// Bug：collectCustomizedSchemaFields 用 `value !== undefined` 判定，空物件 env:{}/hooks:{}
// 與空陣列（availableModels:[] 等）都 !== undefined → badge +1，但對應編輯器畫不出任何
// 可操作項（env 空白、hooks 空狀態、TagInput 空清單）→「計數說有、面板空白」矛盾。
// 與 permissions 空子清單同 class（permissions 已有 hasVisiblePermissionsContent 守門）。
//
// 正確口徑：空容器不算已自訂。badge 計入 iff 值有實質內容（非 undefined、非空 {}、非空 []）。
// ---------------------------------------------------------------------------

describe('SettingsPage — badge 計數：空容器 {} / [] bug reproduction', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('[RED] env:{} 空物件 → project badge 應為 0（無 badge span）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ env: {} });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ model: 'x' }); // 錨點：local badge "1" → loadScopeCounts 完成
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });
    await waitFor(() => {
      const localBadge = getScopeBadge(container, 2);
      expect(localBadge).not.toBeNull();
      expect(localBadge!.textContent).toBe('1');
    });

    expect(getScopeBadge(container, 1)).toBeNull();
  });

  it('[GREEN guard] env:{ A: \'1\' } 非空 → project badge 為 1', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ env: { A: '1' } });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });
    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });
  });

  it('[RED render] env:{} → 已自訂分頁出現空狀態訊息（無空白 Env 區塊）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ env: {} });
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => screen.getByText('Customized'));
    fireEvent.click(screen.getByText('Customized').closest('button')!);

    await waitFor(() => {
      // 空狀態訊息必須出現（badge=0 與 render 一致）
      expect(screen.getByText('No customized settings in this scope.')).toBeTruthy();
      // 空白 Env 區塊不應渲染（空物件不算已自訂）
      expect(container.querySelector('[data-customized-field="env"]')).toBeNull();
    });
  });

  it('[RED] hooks:{} 空物件 → project badge 應為 0（無 badge span）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ hooks: {} });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ model: 'x' });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });
    await waitFor(() => {
      const localBadge = getScopeBadge(container, 2);
      expect(localBadge).not.toBeNull();
      expect(localBadge!.textContent).toBe('1');
    });

    expect(getScopeBadge(container, 1)).toBeNull();
  });

  it('[RED] availableModels:[] 空陣列 → project badge 應為 0（無 badge span）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ availableModels: [] });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ model: 'x' });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });
    await waitFor(() => {
      const localBadge = getScopeBadge(container, 2);
      expect(localBadge).not.toBeNull();
      expect(localBadge!.textContent).toBe('1');
    });

    expect(getScopeBadge(container, 1)).toBeNull();
  });

  it('[GREEN guard] availableModels:[\'claude-x\'] 非空 → project badge 為 1', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ availableModels: ['claude-x'] });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    const { container } = renderPage();

    await waitFor(() => {
      expect((container.querySelectorAll('.settings-scope-tab')[1] as HTMLButtonElement).disabled).toBe(false);
    });
    await waitFor(() => {
      const badge = getScopeBadge(container, 1);
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });
  });
});
