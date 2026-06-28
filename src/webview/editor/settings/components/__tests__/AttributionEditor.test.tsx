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

// ---------------------------------------------------------------------------
// 批次 C：attribution.sessionUrl（先紅）
// ---------------------------------------------------------------------------
// sessionUrl default = true：未設等同 true，設 false 才是「隱藏 session URL」。
// 因此：
//   - attribution=undefined → checkbox 顯示且預設已勾（default true）
//   - 取消勾選 → onSave('attribution', { sessionUrl: false })
//   - 再勾選（設回 true）→ 因 true 即預設值，呼叫 onDelete 或 onSave({sessionUrl:true})
//     （執行者決定語意；測試斷言 onDelete('attribution') 或 onSave 含 sessionUrl:true）
// ---------------------------------------------------------------------------

describe('AttributionEditor — sessionUrl checkbox（先紅，批次 C）', () => {
  it('渲染 sessionUrl checkbox（label 出現在 DOM 中）', async () => {
    renderEditor(undefined);
    // 先紅：label 尚未加入，getByLabelText 或 getByText 找不到
    await waitFor(() => {
      // label i18n key: settings.advanced.attribution.sessionUrl.label
      // 預期 fallback 顯示 key 本身或 'Session URL'
      expect(
        screen.queryByRole('checkbox', { name: /session.url/i }) ??
        screen.queryByRole('checkbox', { name: /sessionUrl/i }),
      ).not.toBeNull();
    });
  });

  it('attribution=undefined → sessionUrl checkbox 預設為勾選（default true）', async () => {
    renderEditor(undefined);
    await waitFor(() => {
      const cb =
        (screen.queryByRole('checkbox', { name: /session.url/i }) ??
         screen.queryByRole('checkbox', { name: /sessionUrl/i })) as HTMLInputElement | null;
      expect(cb).not.toBeNull();
      expect(cb!.checked).toBe(true);
    });
  });

  it('attribution={sessionUrl:false} → sessionUrl checkbox 為未勾選', async () => {
    renderEditor({ sessionUrl: false } as ClaudeSettings['attribution']);
    await waitFor(() => {
      const cb =
        (screen.queryByRole('checkbox', { name: /session.url/i }) ??
         screen.queryByRole('checkbox', { name: /sessionUrl/i })) as HTMLInputElement | null;
      expect(cb).not.toBeNull();
      expect(cb!.checked).toBe(false);
    });
  });

  it('取消勾選 sessionUrl → onSave("attribution", { sessionUrl: false })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(undefined, onSave);
    await waitFor(() =>
      expect(
        screen.queryByRole('checkbox', { name: /session.url/i }) ??
        screen.queryByRole('checkbox', { name: /sessionUrl/i }),
      ).not.toBeNull(),
    );
    const cb =
      (screen.queryByRole('checkbox', { name: /session.url/i }) ??
       screen.queryByRole('checkbox', { name: /sessionUrl/i })) as HTMLElement;
    fireEvent.click(cb);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'attribution',
        expect.objectContaining({ sessionUrl: false }),
      );
    });
  });

  it('attribution={commit:"X",sessionUrl:false} 儲存含 commit+sessionUrl:false', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ commit: 'X', sessionUrl: false } as ClaudeSettings['attribution'], onSave);
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'attribution',
        expect.objectContaining({ commit: 'X', sessionUrl: false }),
      );
    });
  });

  it('sessionUrl=false，勾回 → 不應儲存 false（onSave 不含 sessionUrl:false）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor({ sessionUrl: false } as ClaudeSettings['attribution'], onSave);
    await waitFor(() =>
      expect(
        screen.queryByRole('checkbox', { name: /session.url/i }) ??
        screen.queryByRole('checkbox', { name: /sessionUrl/i }),
      ).not.toBeNull(),
    );
    const cb =
      (screen.queryByRole('checkbox', { name: /session.url/i }) ??
       screen.queryByRole('checkbox', { name: /sessionUrl/i })) as HTMLElement;
    fireEvent.click(cb); // 勾回 true
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      // 當所有欄位等同空/預設 → onDelete；否則 onSave 不含 sessionUrl:false
      const savedArg = onSave.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
      if (savedArg) {
        expect(savedArg.sessionUrl).not.toBe(false);
      } else {
        // onDelete called instead
        expect(onSave).not.toHaveBeenCalled();
      }
    });
  });
});
