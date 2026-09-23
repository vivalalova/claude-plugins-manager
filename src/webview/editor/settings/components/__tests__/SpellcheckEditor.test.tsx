/**
 * @vitest-environment jsdom
 *
 * spellcheck（display, object）
 *
 * shape: { enabled?: boolean; checker?: 'aspell'|'hunspell'|'ispell'; language?: string; color?: string }
 *
 * 兩層契約：
 *   1. ObjectFieldEditor dispatcher 必須有 case 'spellcheck'（漏加會掉進
 *      console.error + return null 的 silent 路徑，UI 完全空白）。
 *   2. editor 本身的 save / delete 行為。
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import { ObjectFieldEditor, OBJECT_EDITOR_KEYS } from '../ObjectFieldEditor';
import type { ClaudeSettings } from '../../../../../shared/types';

vi.mock('../../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderDispatcher = (
  settings: ClaudeSettings,
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
) =>
  renderWithI18n(
    <ToastProvider>
      <ObjectFieldEditor
        settingKey="spellcheck"
        scope="user"
        settings={settings}
        onSave={onSave}
        onDelete={onDelete}
      />
    </ToastProvider>,
  );

describe('spellcheck — ObjectFieldEditor dispatcher', () => {
  it('spellcheck 屬於 OBJECT_EDITOR_KEYS（schema 派生，display section 會自動接上）', () => {
    expect(OBJECT_EDITOR_KEYS.has('spellcheck')).toBe(true);
  });

  it('dispatcher 回傳非 null（不掉進 console.error 的 default 分支）', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderDispatcher({} as ClaudeSettings);
    expect(container.querySelector('.settings-field')).not.toBeNull();
    // 只鎖 dispatcher 的 default 分支訊息，不做「零 console.error」的環境潔癖斷言
    // （React 的無關警告也走 console.error，會造成假紅）。
    const dispatcherMisses = errorSpy.mock.calls.filter(
      (args) => args.some((a) => typeof a === 'string' && a.includes('no case for object key')),
    );
    expect(dispatcherMisses).toEqual([]);
    errorSpy.mockRestore();
  });
});

describe('spellcheck — editor 行為', () => {
  it('render 出 enabled / checker / language / color 四個控件', async () => {
    renderDispatcher({} as ClaudeSettings);
    await waitFor(() => {
      expect(document.getElementById('spellcheck-enabled')).not.toBeNull();
      expect(document.getElementById('spellcheck-checker')).not.toBeNull();
      expect(document.getElementById('spellcheck-language')).not.toBeNull();
      expect(document.getElementById('spellcheck-color')).not.toBeNull();
    });
  });

  it('既有值回填到各控件', async () => {
    renderDispatcher({
      spellcheck: { enabled: true, checker: 'hunspell', language: 'en_GB', color: '#ff0000' },
    } as ClaudeSettings);
    await waitFor(() => {
      expect((document.getElementById('spellcheck-enabled') as HTMLInputElement).checked).toBe(true);
      expect((document.getElementById('spellcheck-checker') as HTMLSelectElement).value).toBe('hunspell');
      expect((document.getElementById('spellcheck-language') as HTMLInputElement).value).toBe('en_GB');
      expect((document.getElementById('spellcheck-color') as HTMLInputElement).value).toBe('#ff0000');
    });
  });

  it('checker 下拉含空值＋auto／aspell／hunspell／ispell 四個選項', async () => {
    renderDispatcher({} as ClaudeSettings);
    const select = document.getElementById('spellcheck-checker') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values[0]).toBe('');
    expect(values.slice(1).sort()).toEqual(['aspell', 'auto', 'hunspell', 'ispell']);
  });

  it('空值選項文案沿用原「自動偵測」文字；auto 選項文案為 "auto"；兩者不同', async () => {
    renderDispatcher({} as ClaudeSettings);
    const select = document.getElementById('spellcheck-checker') as HTMLSelectElement;
    const options = Array.from(select.options);
    const unsetOption = options.find((o) => o.value === '')!;
    const autoOption = options.find((o) => o.value === 'auto');
    expect(autoOption).toBeTruthy();
    expect(autoOption!.textContent).toBe('auto');
    expect(unsetOption.textContent).toBe('Auto (detect installed checker)');
    expect(unsetOption.textContent).not.toBe(autoOption!.textContent);
  });

  it('填入欄位並 Save → onSave("spellcheck", 只含已填欄位的物件)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderDispatcher({} as ClaudeSettings, onSave);

    fireEvent.click(document.getElementById('spellcheck-enabled')!);
    fireEvent.change(document.getElementById('spellcheck-checker')!, { target: { value: 'aspell' } });
    fireEvent.change(document.getElementById('spellcheck-language')!, { target: { value: ' en_GB ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('spellcheck', {
        enabled: true,
        checker: 'aspell',
        language: 'en_GB',
      });
    });
  });

  it('全部清空後 Save → onDelete("spellcheck")（不留空物件）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderDispatcher({ spellcheck: { language: 'en_GB' } } as ClaudeSettings, onSave, onDelete);

    fireEvent.change(document.getElementById('spellcheck-language')!, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('spellcheck');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('已有值 → Clear 鈕呼叫 onDelete("spellcheck")；未設定時不顯示 Clear', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderDispatcher({} as ClaudeSettings, vi.fn(), onDelete);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    unmount();

    renderDispatcher({ spellcheck: { enabled: true } } as ClaudeSettings, vi.fn(), onDelete);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('spellcheck'));
  });
});
