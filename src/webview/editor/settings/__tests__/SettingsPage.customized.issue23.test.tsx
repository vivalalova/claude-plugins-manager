/**
 * @vitest-environment jsdom
 *
 * GitHub issue #23 — 已自訂分頁逐項 inline 顯示已自訂設定
 *
 * 這些測試描述 #23 要求的新行為，產品碼改動前全部為 RED。
 * 紅的原因是「行為未實作」（assertion 失敗 / waitFor timeout），非測試本身壞。
 *
 * 新行為摘要：
 *   - env    → EnvFieldRenderer 逐項 inline，無跳轉按鈕
 *   - hooks  → HooksSection inline，無跳轉按鈕
 *   - statusLine / worktree → 原 AdvancedSection editor inline，無跳轉按鈕
 *   - permissions → 只渲染有值的子清單（allow/deny/ask 非空才顯示、
 *                   additionalDirectories 非空才顯示）
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';

/* ── Mock vscode bridge（與既有 customized test 相同 pattern）── */
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

const clickCustomized = () => {
  fireEvent.click(screen.getByText('Customized').closest('button')!);
};

// ---------------------------------------------------------------------------
// 共用 mock helper
// ---------------------------------------------------------------------------

function mockSettings(settings: Record<string, unknown>) {
  mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
    if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
    if (msg.type === 'settings.get') return Promise.resolve(settings);
    if (msg.type === 'settings.set') return Promise.resolve(undefined);
    if (msg.type === 'settings.delete') return Promise.resolve(undefined);
    return Promise.resolve(null);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 畫面上沒有任何文字結尾為 → 的按鈕 */
function expectNoJumpButtons() {
  const jumpBtn = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent?.trim().endsWith('→'),
  );
  expect(jumpBtn).toBeUndefined();
}

describe('SettingsPage — issue #23 已自訂分頁 inline 行為', () => {
  beforeEach(() => {
    mockSettings({});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. env 顯示已設定的 known var，無跳轉按鈕
  // -------------------------------------------------------------------------

  it('#23-1 env known var 有值 → inline 顯示 label，無跳轉按鈕', async () => {
    mockSettings({ env: { CLAUDE_CODE_NEW_INIT: '1' } });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // known var label 出現（EnvFieldRenderer 的 toggle label）
      expect(screen.getByText('CLAUDE_CODE_NEW_INIT')).toBeTruthy();
      // 無任何跳轉按鈕
      expectNoJumpButtons();
    });
  });

  // -------------------------------------------------------------------------
  // 2. env 只顯示已設定的 var，不列未設定的 known var
  // -------------------------------------------------------------------------

  it('#23-2 env 只有一個 var → 未設定的 known var 不出現', async () => {
    // 只設定 CLAUDE_CODE_NEW_INIT，ANTHROPIC_MODEL 未設定 → 不應出現
    mockSettings({ env: { CLAUDE_CODE_NEW_INIT: '1' } });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      expect(screen.getByText('CLAUDE_CODE_NEW_INIT')).toBeTruthy();
      expect(screen.queryByText('ANTHROPIC_MODEL')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 3. env 顯示 custom var（非 known var）
  // -------------------------------------------------------------------------

  it('#23-3 env custom var → inline 顯示 key input，無跳轉按鈕', async () => {
    // custom var 的 key 顯示在 EnvCustomField 的 input value（非外層 label 文字）
    // 用 getByDisplayValue 而非 getByText，避免誤導執行者加多餘 <label>
    mockSettings({ env: { MY_CUSTOM_VAR: 'hello' } });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // custom var key 出現在 input 的 displayValue
      expect(screen.getByDisplayValue('MY_CUSTOM_VAR')).toBeTruthy();
      expectNoJumpButtons();
    });
  });

  // -------------------------------------------------------------------------
  // 4. permissions 只顯示有值子清單，空清單不出現
  // -------------------------------------------------------------------------

  it('#23-4 permissions{allow 非空} → 出現 Allow 規則，deny/ask 空塊不出現', async () => {
    mockSettings({ permissions: { allow: ['Bash(npm:*)'] } });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // allow 規則出現
      expect(screen.getByText('Allow')).toBeTruthy();
      expect(screen.getByText('Bash(npm:*)')).toBeTruthy();

      // deny/ask 空 → 標題與空狀態文字均不出現
      expect(screen.queryByText('Deny')).toBeNull();
      expect(screen.queryByText('Ask')).toBeNull();
      // 「No rules defined」空狀態不應出現
      expect(screen.queryAllByText('No rules defined')).toHaveLength(0);
      // additionalDirectories 未設 → 「No additional directories configured」不出現
      expect(screen.queryAllByText('No additional directories configured')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. permissions 多清單皆有值 → 四塊都顯示
  // -------------------------------------------------------------------------

  it('#23-5 permissions{allow+deny+ask+additionalDirectories} → 四塊都顯示', async () => {
    mockSettings({
      permissions: {
        allow: ['A'],
        deny: ['B'],
        ask: ['C'],
        additionalDirectories: ['/d'],
      },
    });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      expect(screen.getByText('Allow')).toBeTruthy();
      expect(screen.getByText('Deny')).toBeTruthy();
      expect(screen.getByText('Ask')).toBeTruthy();
      // additionalDirectories 值出現
      expect(screen.getByText('/d')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // 6. statusLine 有值 → inline editor 顯示，無跳轉按鈕
  // -------------------------------------------------------------------------

  it('#23-6 statusLine 有值 → inline 顯示 command 編輯控件，無跳轉按鈕', async () => {
    mockSettings({ statusLine: { type: 'command', command: 'echo hi' } });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // StatusLineEditor 的 command 輸入框出現（placeholder 固定）
      expect(screen.getByPlaceholderText('e.g. date +%H:%M')).toBeTruthy();
      // command 值填入
      expect((screen.getByPlaceholderText('e.g. date +%H:%M') as HTMLInputElement).value).toBe('echo hi');
      // 無跳轉按鈕
      expectNoJumpButtons();
    });
  });

  // -------------------------------------------------------------------------
  // 7. worktree 有值 → inline JSON editor 顯示，無跳轉按鈕
  // -------------------------------------------------------------------------

  it('#23-7 worktree 有值 → inline 顯示 JSON 編輯控件，無跳轉按鈕', async () => {
    const worktreeValue = { sparsePaths: ['packages/my-app'] };
    mockSettings({ worktree: worktreeValue });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // worktree TextSetting 的 placeholder 出現 → inline 已渲染
      expect(screen.getByPlaceholderText('e.g. { "sparsePaths": ["packages/my-app"] }')).toBeTruthy();
      // 無跳轉按鈕
      expectNoJumpButtons();
    });
  });

  // -------------------------------------------------------------------------
  // 8. hooks 有值 → inline 顯示事件名稱，無跳轉按鈕
  // -------------------------------------------------------------------------

  it('#23-8 hooks 有值 → inline 顯示 PreToolUse，無跳轉按鈕', async () => {
    mockSettings({
      hooks: {
        PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'echo' }] }],
      },
    });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // HooksSection 的事件名稱出現（hooks-event-title）
      expect(screen.getByText('PreToolUse')).toBeTruthy();
      // 無跳轉按鈕
      expectNoJumpButtons();
    });
  });
});

// ---------------------------------------------------------------------------
// Display 欄位 inline 測試（spinnerVerbs、voice）
// MCP 欄位 inline 測試（allowedMcpServers、deniedMcpServers）
// ---------------------------------------------------------------------------

describe('SettingsPage — issue #23 display/MCP object 欄位 inline', () => {
  beforeEach(() => {
    mockSettings({});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('#23-d1 spinnerVerbs 有值 → inline 顯示 Spinner Verbs 控件，無跳轉按鈕', async () => {
    mockSettings({ spinnerVerbs: { mode: 'append', verbs: ['Thinking'] } });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // SpinnerVerbsEditor 的 verb tag 出現
      expect(screen.getByText('Thinking')).toBeTruthy();
      expectNoJumpButtons();
    });
  });

  it('#23-d2 voice 有值 → inline 顯示 JSON 編輯控件，無跳轉按鈕', async () => {
    mockSettings({ voice: { enabled: true, mode: 'tap' } });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // voice TextSetting 的 placeholder 出現 → inline 已渲染
      expect(screen.getByPlaceholderText('e.g. { "enabled": true, "mode": "tap" }')).toBeTruthy();
      expectNoJumpButtons();
    });
  });

  it('#23-d3 allowedMcpServers 有值 → inline 顯示 JSON 編輯控件，無跳轉按鈕', async () => {
    mockSettings({ allowedMcpServers: [{ serverName: 'github' }] });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // allowedMcpServers JSON TextSetting placeholder 出現 → inline 已渲染
      expect(screen.getByPlaceholderText('e.g. [{ "serverName": "github" }]')).toBeTruthy();
      expectNoJumpButtons();
    });
  });

  it('#23-d4 deniedMcpServers 有值 → inline 顯示 JSON 編輯控件，無跳轉按鈕', async () => {
    mockSettings({ deniedMcpServers: [{ serverName: 'filesystem' }] });
    renderPage();

    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(() => {
      // deniedMcpServers JSON TextSetting placeholder 出現 → inline 已渲染
      expect(screen.getByPlaceholderText('e.g. [{ "serverName": "filesystem" }]')).toBeTruthy();
      expectNoJumpButtons();
    });
  });
});

// ---------------------------------------------------------------------------
// 防漂移 guard test：所有 controlType===Object key 一次驗
// 新增 object key 但漏接 dispatcher 時此測試變紅
// ---------------------------------------------------------------------------

import { getAllFlatFieldSchemas } from '../../../../shared/claude-settings-schema';

describe('SettingsPage — issue #23 Object 欄位全覆蓋 guard', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('#23-guard 所有 controlType===Object key 有值時，已自訂分頁無跳轉按鈕且無靜默消失', async () => {
    // 列舉 schema 中所有 controlType === Object 的 key
    const allSchemas = getAllFlatFieldSchemas();
    const objectKeys = Object.entries(allSchemas)
      .filter(([, s]) => s.controlType === Object)
      .map(([k]) => k);

    // 每個 object key 給最小合法值：
    // - permissions / env / hooks 走專屬 editor，其餘走 ObjectFieldEditor dispatcher
    // - 凡是 array value schema（MCP list 等）給 array
    // - 凡是 object value schema 給合法 object
    const minimalSettings: Record<string, unknown> = {
      permissions:         { allow: ['Bash'] },
      env:                 { CLAUDE_CODE_NEW_INIT: '1' },
      hooks:               { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'echo' }] }] },
      spinnerVerbs:        { mode: 'append', verbs: ['Thinking'] },
      spinnerTipsOverride: { tips: ['Stay hydrated!'] },
      voice:               { enabled: true },
      allowedMcpServers:   [{ serverName: 'github' }],
      deniedMcpServers:    [{ serverName: 'filesystem' }],
      modelOverrides:      { 'claude-opus-4-6': 'custom-arn' },
      statusLine:          { type: 'command', command: 'echo hi' },
      subagentStatusLine:  { type: 'command', command: 'echo sub' },
      fileSuggestion:      { type: 'command', command: 'echo file' },
      attribution:         { commit: 'Co-Authored-By: Claude' },
      skillOverrides:      { 'code-review': 'user-invocable-only' },
      worktree:            { sparsePaths: ['packages/my-app'] },
      autoMode:            { environment: ['Source control: github.com/my-org'] },
      sshConfigs:          [{ id: 'dev-vm', name: 'Dev VM', sshHost: 'user@dev.example.com' }],
      sandbox:             { enabled: true },
      companyAnnouncements: ['Welcome!'],
    };

    // 驗所有 19 個 key 都在 minimalSettings 中（漏掉即測試本身有問題）
    for (const key of objectKeys) {
      expect(minimalSettings).toHaveProperty(key);
    }

    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve(minimalSettings);
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();
    await waitFor(() => screen.getByText('Customized'));
    clickCustomized();

    await waitFor(
      () => {
        // (a) 畫面上沒有任何以「→」結尾的按鈕
        const jumpBtns = Array.from(document.querySelectorAll('button')).filter(
          (b) => b.textContent?.trim().endsWith('→'),
        );
        expect(jumpBtns).toHaveLength(0);

        // (b) 每個 object key 都有 render，且內容非空（非靜默消失）
        // 依賴產品碼在 customized block 每個欄位 wrapper 加 data-customized-field={key}
        // 未來新增 object key 漏接 dispatcher case → ObjectFieldEditor return null
        //   → wrapper 存在（data attr 有）但 textContent 空 → 第二斷言紅
        for (const key of objectKeys) {
          const block = document.querySelector(`[data-customized-field="${key}"]`);
          expect(block, `object key ${key} 應在已自訂分頁 render`).toBeTruthy();
          expect((block?.textContent ?? '').trim().length, `object key ${key} render 不可為空`).toBeGreaterThan(0);
        }
      },
      { timeout: 5000 },
    );
  });
});
