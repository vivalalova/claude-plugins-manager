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
