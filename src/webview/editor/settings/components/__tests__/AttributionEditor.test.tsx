/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import { AttributionEditor } from '../AttributionEditor';
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
  attribution: ClaudeSettings['attribution'] = undefined,
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
) =>
  renderWithI18n(
    <ToastProvider>
      <AttributionEditor attribution={attribution} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('AttributionEditor — 初始渲染', () => {
  it('顯示 attribution 的 commit 與 pr 值', async () => {
    renderEditor({ commit: 'Co-Authored-By: Claude', pr: '🤖 Claude' });
    await waitFor(() => {
      const commitInput = screen.getByLabelText('Commit Signature') as HTMLInputElement;
      const prInput = screen.getByLabelText('PR Signature') as HTMLInputElement;
      expect(commitInput.value).toBe('Co-Authored-By: Claude');
      expect(prInput.value).toBe('🤖 Claude');
    });
  });

  it('attribution 為 undefined 時欄位為空', async () => {
    renderEditor(undefined);
    await waitFor(() => {
      const commitInput = screen.getByLabelText('Commit Signature') as HTMLInputElement;
      const prInput = screen.getByLabelText('PR Signature') as HTMLInputElement;
      expect(commitInput.value).toBe('');
      expect(prInput.value).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// 欄位互動
// ---------------------------------------------------------------------------

describe('AttributionEditor — 欄位互動', () => {
  it('修改 commit 欄位', async () => {
    renderEditor(undefined);
    await waitFor(() => screen.getByLabelText('Commit Signature'));
    const commitInput = screen.getByLabelText('Commit Signature') as HTMLInputElement;
    fireEvent.change(commitInput, { target: { value: 'New Commit Sig' } });
    expect(commitInput.value).toBe('New Commit Sig');
  });

  it('修改 pr 欄位', async () => {
    renderEditor(undefined);
    await waitFor(() => screen.getByLabelText('PR Signature'));
    const prInput = screen.getByLabelText('PR Signature') as HTMLInputElement;
    fireEvent.change(prInput, { target: { value: 'New PR Sig' } });
    expect(prInput.value).toBe('New PR Sig');
  });
});

// ---------------------------------------------------------------------------
// 儲存行為
// ---------------------------------------------------------------------------

describe('AttributionEditor — 儲存', () => {
  it('儲存時呼叫 onSave（含 commit 和 pr）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ commit: 'Co-Authored-By: Claude', pr: '🤖 Claude' }, onSave);
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('attribution', {
        commit: 'Co-Authored-By: Claude',
        pr: '🤖 Claude',
      });
    });
  });

  it('只填 commit 不填 pr → onSave 只含 commit', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);
    await waitFor(() => screen.getByLabelText('Commit Signature'));
    fireEvent.change(screen.getByLabelText('Commit Signature'), { target: { value: 'Only Commit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('attribution', { commit: 'Only Commit' });
    });
  });

  it('兩欄都空白 → 呼叫 onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave, onDelete);
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('attribution');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('儲存失敗時顯示 toast 錯誤', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('save failed'));
    renderEditor({ commit: 'test' }, onSave);
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('save failed', 'error');
    });
  });
});
