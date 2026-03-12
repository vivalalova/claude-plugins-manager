/**
 * @vitest-environment jsdom
 */
import React from 'react'; // needed for JSX transform
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { HooksSection } from '../HooksSection';
import { ToastProvider } from '../../../components/Toast';

const { mockSendRequest } = vi.hoisted(() => ({
  mockSendRequest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

const renderSection = (
  settings: Record<string, unknown> = {},
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
  scope: 'user' | 'project' | 'local' = 'user',
) =>
  renderWithI18n(
    <ToastProvider>
      <HooksSection scope={scope} settings={settings} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('HooksSection — 渲染', () => {
  it('hooks 為空 → 顯示 empty state', async () => {
    renderSection({});

    await waitFor(() => {
      expect(screen.getByText('No hooks configured')).toBeTruthy();
    });
  });

  it('HooksSection 不顯示 settings key hint', async () => {
    const { container } = renderSection({});

    await waitFor(() => {
      expect(screen.getByText('No hooks configured')).toBeTruthy();
      expect(container.querySelector('.settings-key-hint')).toBeNull();
    });
  });

  it('有 hooks → 顯示 event type 標題', async () => {
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('PreToolUse')).toBeTruthy();
    });
  });

  it('顯示 matcher 值', async () => {
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Bash')).toBeTruthy();
    });
  });

  it('command hook 顯示 command 欄位', async () => {
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('/guard.sh')).toBeTruthy();
    });
  });

  it('http hook 顯示 url 欄位', async () => {
    renderSection({
      hooks: {
        Notification: [{ matcher: '', hooks: [{ type: 'http', url: 'https://api.example.com/hook' }] }],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('https://api.example.com/hook')).toBeTruthy();
    });
  });

  it('prompt hook 顯示 prompt 欄位', async () => {
    renderSection({
      hooks: {
        Stop: [{ matcher: '', hooks: [{ type: 'prompt', prompt: 'Summarize session' }] }],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Summarize session')).toBeTruthy();
    });
  });

  it('matcher 缺失時顯示 *', async () => {
    renderSection({
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('*')).toBeTruthy();
    });
  });

  it('多個 event type 全部顯示', async () => {
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/pre.sh' }] }],
        PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: '/post.sh' }] }],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('PreToolUse')).toBeTruthy();
      expect(screen.getByText('PostToolUse')).toBeTruthy();
    });
  });

  it('hook 顯示 timeout', async () => {
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/g.sh', timeout: 5 }] }],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/timeout: 5s/)).toBeTruthy();
    });
  });

  it('60+ 字元的 command 被截斷顯示', async () => {
    const longCmd = '/usr/local/bin/very-long-script-name-that-exceeds-sixty-characters.sh';
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: longCmd }] }],
      },
    });

    await waitFor(() => {
      // 截斷後顯示 … 結尾
      const el = screen.getByText(/…$/);
      expect(el).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// disableAllHooks toggle
// ---------------------------------------------------------------------------

describe('HooksSection — disableAllHooks toggle', () => {
  it('disableAllHooks 未設定 → checkbox unchecked', async () => {
    renderSection({});

    await waitFor(() => {
      const cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  it('disableAllHooks: true → checkbox checked', async () => {
    renderSection({ disableAllHooks: true });

    await waitFor(() => {
      const cb = screen.getByRole('checkbox') as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('toggle off→on → 呼叫 onSave("disableAllHooks", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('disableAllHooks', true);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('toggle on→off → 呼叫 onDelete("disableAllHooks")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ disableAllHooks: true }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('disableAllHooks');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('toggle 期間 checkbox disabled', async () => {
    let resolveToggle!: () => void;
    const onSave = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveToggle = r; }));
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    });

    resolveToggle();
  });
});

// ---------------------------------------------------------------------------
// openInEditor button
// ---------------------------------------------------------------------------

describe('HooksSection — openInEditor button', () => {
  it('顯示「Open in JSON Editor」按鈕', async () => {
    renderSection({});

    await waitFor(() => {
      expect(screen.getAllByText('Open in JSON Editor').length).toBeGreaterThan(0);
    });
  });

  it('點擊 openInEditor → sendRequest({ type: "settings.openInEditor", scope })', async () => {
    renderSection({}, vi.fn(), vi.fn(), 'user');

    await waitFor(() => screen.getAllByText('Open in JSON Editor'));
    fireEvent.click(screen.getAllByText('Open in JSON Editor')[0]);

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledWith({ type: 'settings.openInEditor', scope: 'user' });
    });
  });

  it('scope 為 project 時 openInEditor 帶正確 scope', async () => {
    renderSection({}, vi.fn(), vi.fn(), 'project');

    await waitFor(() => screen.getAllByText('Open in JSON Editor'));
    fireEvent.click(screen.getAllByText('Open in JSON Editor')[0]);

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledWith({ type: 'settings.openInEditor', scope: 'project' });
    });
  });

  it('empty state 也有 openInEditor 按鈕可點', async () => {
    renderSection({});

    await waitFor(() => screen.getByText('Open JSON Editor to add hooks'));
    fireEvent.click(screen.getByText('Open JSON Editor to add hooks'));

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledWith({ type: 'settings.openInEditor', scope: 'user' });
    });
  });
});

// ---------------------------------------------------------------------------
// open file button
// ---------------------------------------------------------------------------

describe('HooksSection — open file button', () => {
  it('command = 絕對路徑且存在 → 顯示開啟按鈕', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; paths?: string[] }) => {
      if (msg.type === 'hooks.checkFilePaths') return Promise.resolve(['/guard.sh']);
      return Promise.resolve(undefined);
    });
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    });

    await waitFor(() => {
      expect(screen.getByTitle('Open file')).toBeTruthy();
    });
  });

  it('command = 非路徑 pattern → 不顯示按鈕，不送 checkFilePaths', async () => {
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hello' }] }],
      },
    });

    await waitFor(() => screen.getByText('echo hello'));
    expect(screen.queryByTitle('Open file')).toBeNull();
    expect(mockSendRequest).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'hooks.checkFilePaths' }));
  });

  it('command = 路徑但不存在 → 不顯示按鈕', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'hooks.checkFilePaths') return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/not/exist.sh' }] }],
      },
    });

    await waitFor(() => screen.getByText('/not/exist.sh'));
    expect(screen.queryByTitle('Open file')).toBeNull();
  });

  it('prompt type hook → 不顯示按鈕', async () => {
    renderSection({
      hooks: {
        Stop: [{ matcher: '', hooks: [{ type: 'prompt', prompt: '/some/prompt.md' }] }],
      },
    });

    await waitFor(() => screen.getByText('/some/prompt.md'));
    expect(screen.queryByTitle('Open file')).toBeNull();
  });

  it('http type hook → 不顯示按鈕', async () => {
    renderSection({
      hooks: {
        Stop: [{ matcher: '', hooks: [{ type: 'http', url: 'https://api.example.com' }] }],
      },
    });

    await waitFor(() => screen.getByText('https://api.example.com'));
    expect(screen.queryByTitle('Open file')).toBeNull();
  });

  it('agent type hook → 不顯示按鈕', async () => {
    renderSection({
      hooks: {
        Stop: [{ matcher: '', hooks: [{ type: 'agent', prompt: '/some/agent-prompt.md' }] }],
      },
    });

    await waitFor(() => screen.getByText('/some/agent-prompt.md'));
    expect(screen.queryByTitle('Open file')).toBeNull();
  });

  it('點擊開啟按鈕 → 送 hooks.openFile 請求', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; paths?: string[] }) => {
      if (msg.type === 'hooks.checkFilePaths') return Promise.resolve(['~/scripts/run.sh']);
      return Promise.resolve(undefined);
    });
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: '~/scripts/run.sh' }] }],
      },
    });

    await waitFor(() => screen.getByTitle('Open file'));
    fireEvent.click(screen.getByTitle('Open file'));

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledWith({ type: 'hooks.openFile', path: '~/scripts/run.sh' });
    });
  });

  it('hooks.openFile 失敗 → 顯示 error toast', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'hooks.checkFilePaths') return Promise.resolve(['/guard.sh']);
      if (msg.type === 'hooks.openFile') return Promise.reject(new Error('open failed'));
      return Promise.resolve(undefined);
    });
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    });

    await waitFor(() => screen.getByTitle('Open file'));
    fireEvent.click(screen.getByTitle('Open file'));

    await waitFor(() => {
      expect(screen.getByText('open failed')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// explain button
// ---------------------------------------------------------------------------

describe('HooksSection — explain button', () => {
  it('點擊解釋按鈕 → 送 hooks.explain → 顯示解釋文字', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'hooks.explain') return Promise.resolve({ explanation: '這是安全守衛腳本。', fromCache: false });
      return Promise.resolve(undefined);
    });
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    });

    await waitFor(() => screen.getByText('Explain'));
    fireEvent.click(screen.getByText('Explain'));

    await waitFor(() => {
      expect(screen.getByText('這是安全守衛腳本。')).toBeTruthy();
    });
    expect(mockSendRequest).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'hooks.explain', hookContent: '/guard.sh' }),
      120000,
    );
  });

  it('hooks.explain 呼叫時帶正確 locale', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'hooks.explain') return Promise.resolve({ explanation: 'ok', fromCache: false });
      return Promise.resolve(undefined);
    });
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    });

    await waitFor(() => screen.getByText('Explain'));
    fireEvent.click(screen.getByText('Explain'));

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'hooks.explain', locale: expect.any(String) }),
        120000,
      );
    });
  });

  it('解釋過的 hook → 再次點擊不重送 request（UI 快取）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'hooks.explain') return Promise.resolve({ explanation: '快取中的解釋。', fromCache: true });
      return Promise.resolve(undefined);
    });
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    });

    await waitFor(() => screen.getByText('Explain'));
    fireEvent.click(screen.getByText('Explain'));
    await waitFor(() => screen.getByText('快取中的解釋。'));

    // 再按一次
    fireEvent.click(screen.getByText('Explain'));
    await waitFor(() => expect(screen.getByText('快取中的解釋。')).toBeTruthy());

    // hooks.explain 只呼叫一次
    expect(
      mockSendRequest.mock.calls.filter((c: unknown[]) => (c[0] as { type: string }).type === 'hooks.explain'),
    ).toHaveLength(1);
  });

  it('hooks.explain 失敗 → 顯示 error toast', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'hooks.explain') return Promise.reject(new Error('AI unavailable'));
      return Promise.resolve(undefined);
    });
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    });

    await waitFor(() => screen.getByText('Explain'));
    fireEvent.click(screen.getByText('Explain'));

    await waitFor(() => {
      expect(screen.getByText('Failed to get explanation')).toBeTruthy();
    });
  });

  it('mount 時送 hooks.cleanExpiredExplanations', async () => {
    renderSection({
      hooks: {
        PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: '/guard.sh' }] }],
      },
    });

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'hooks.cleanExpiredExplanations' }),
      );
    });
  });
});
