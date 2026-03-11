/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { DisplaySection } from '../DisplaySection';
import { ToastProvider } from '../../../components/Toast';

vi.mock('../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
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
) =>
  renderWithI18n(
    <ToastProvider>
      <DisplaySection
        scope="user"
        settings={settings as any}
        onSave={onSave}
        onDelete={onDelete}
      />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('DisplaySection — 渲染', () => {
  it('顯示 Display section title', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Display' })).toBeTruthy());
  });

  it('顯示 4 個 checkbox toggle', async () => {
    renderSection();
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(4);
    });
  });

  it('顯示 showTurnDuration toggle label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Show Turn Duration')).toBeTruthy());
  });

  it('顯示 spinnerTipsEnabled toggle label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Spinner Tips')).toBeTruthy());
  });

  it('顯示 terminalProgressBarEnabled toggle label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Terminal Progress Bar')).toBeTruthy());
  });

  it('顯示 prefersReducedMotion toggle label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Reduce Motion')).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// 驗收條件
// ---------------------------------------------------------------------------

describe('DisplaySection — 驗收條件', () => {
  it('showTurnDuration 未設定 → checkbox unchecked', async () => {
    renderSection({});
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Show Turn Duration' }) as HTMLInputElement;
      expect(cb.checked).toBe(false);
    });
  });

  it('showTurnDuration 未設定, 點擊 → onSave("showTurnDuration", true)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Show Turn Duration' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Turn Duration' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('showTurnDuration', true);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  it('prefersReducedMotion=true → checkbox checked', async () => {
    renderSection({ prefersReducedMotion: true });
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: 'Reduce Motion' }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('prefersReducedMotion=true, 點擊 → onDelete("prefersReducedMotion")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ prefersReducedMotion: true }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Reduce Motion' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reduce Motion' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('prefersReducedMotion');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// teammateMode EnumDropdown
// ---------------------------------------------------------------------------

describe('DisplaySection — teammateMode dropdown', () => {
  it('顯示 Teammate Mode dropdown', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Teammate Mode')).toBeTruthy());
  });

  it('teammateMode 未設定 → select value 為空', async () => {
    renderSection({});
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Teammate Mode' }) as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });

  it('teammateMode 未設定, 選擇 tmux → onSave("teammateMode", "tmux")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({}, onSave);

    await waitFor(() => screen.getByRole('combobox', { name: 'Teammate Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Teammate Mode' }), { target: { value: 'tmux' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('teammateMode', 'tmux');
    });
  });

  it('teammateMode="inline", 選擇空值 → onDelete("teammateMode")', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ teammateMode: 'inline' }, vi.fn(), onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Teammate Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Teammate Mode' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('teammateMode');
    });
  });

  it('teammateMode="iterm2" → select 顯示 iterm2', async () => {
    renderSection({ teammateMode: 'iterm2' });
    await waitFor(() => {
      const select = screen.getByRole('combobox', { name: 'Teammate Mode' }) as HTMLSelectElement;
      expect(select.value).toBe('iterm2');
    });
  });
});
