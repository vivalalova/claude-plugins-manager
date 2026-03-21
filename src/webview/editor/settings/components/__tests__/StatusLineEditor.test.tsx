/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import { StatusLineEditor } from '../StatusLineEditor';
import type { ClaudeSettings } from '../../../../../shared/types';

vi.mock('../../../../vscode', () => ({ vscode: { postMessage: vi.fn() } }));

const mockAddToast = vi.fn();
vi.mock('../../../../components/Toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../components/Toast')>();
  return {
    ...actual,
    useToast: () => ({ addToast: mockAddToast }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderEditor = (
  statusLine: ClaudeSettings['statusLine'] = undefined,
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
) =>
  renderWithI18n(
    <ToastProvider>
      <StatusLineEditor statusLine={statusLine} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('StatusLineEditor — 初始渲染', () => {
  it('顯示 statusLine 的 command 與 padding', async () => {
    renderEditor({ type: 'command', command: 'date +%H:%M', padding: 2 });
    await waitFor(() => {
      const commandInput = screen.getByLabelText('Command') as HTMLInputElement;
      const paddingInput = screen.getByLabelText('Padding') as HTMLInputElement;
      expect(commandInput.value).toBe('date +%H:%M');
      expect(paddingInput.value).toBe('2');
    });
  });

  it('statusLine 為 undefined 時欄位為空且不顯示 Clear 按鈕', async () => {
    renderEditor(undefined);
    await waitFor(() => {
      const commandInput = screen.getByLabelText('Command') as HTMLInputElement;
      const paddingInput = screen.getByLabelText('Padding') as HTMLInputElement;
      expect(commandInput.value).toBe('');
      expect(paddingInput.value).toBe('');
    });
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('有 statusLine 時顯示 Clear 按鈕', async () => {
    renderEditor({ type: 'command', command: 'date', padding: 0 });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// 儲存行為
// ---------------------------------------------------------------------------

describe('StatusLineEditor — 儲存', () => {
  it('儲存時呼叫 onSave（含 type: command、command、padding）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ type: 'command', command: 'date +%H:%M', padding: 1 }, onSave);
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('statusLine', {
        type: 'command',
        command: 'date +%H:%M',
        padding: 1,
      });
    });
  });

  it('command 為空白 → 呼叫 onDelete', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave, onDelete);
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('statusLine');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('padding 為非數字 → onSave 不含 padding', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);
    await waitFor(() => screen.getByLabelText('Command'));
    fireEvent.change(screen.getByLabelText('Command'), { target: { value: 'echo hi' } });
    fireEvent.change(screen.getByLabelText('Padding'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('statusLine', {
        type: 'command',
        command: 'echo hi',
      });
    });
  });

  it('點擊 Clear 呼叫 onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderEditor({ type: 'command', command: 'date' }, vi.fn(), onDelete);
    await waitFor(() => screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('statusLine');
    });
  });
});
