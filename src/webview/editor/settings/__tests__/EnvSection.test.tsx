/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { I18nProvider } from '../../../i18n/I18nContext';
import { isSensitiveKey, EnvSection } from '../EnvSection';
import { ToastProvider } from '../../../components/Toast';

vi.mock('../../../vscode', () => ({
  sendRequest: vi.fn(),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

const renderEnvSection = (
  settings: Record<string, unknown> = {},
  onSave = vi.fn().mockResolvedValue(undefined),
  scope: 'user' | 'project' | 'local' = 'user',
) =>
  renderWithI18n(
    <ToastProvider>
      <EnvSection scope={scope} settings={settings} onSave={onSave} />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// isSensitiveKey
// ---------------------------------------------------------------------------

describe('isSensitiveKey', () => {
  it.each([
    // 敏感 → true
    ['API_KEY', true],
    ['MY_KEY', true],
    ['GITHUB_TOKEN', true],
    ['DB_PASSWORD', true],
    ['AWS_SECRET', true],
    ['CLIENT_CREDENTIAL', true],
    ['SECRET', true],
    ['TOKEN', true],
    ['PASSWORD', true],
    // 非敏感 → false
    ['MY_KEYCHAIN', false],   // KEYCHAIN 不是 _KEY 結尾
    ['MONKEY', false],         // 含 KEY 但非結尾 suffix
    ['SECRET_SAUCE', false],   // SECRET 不在結尾
    ['API_URL', false],
    ['DATABASE_HOST', false],
  ])('%s → %s', (key, expected) => {
    expect(isSensitiveKey(key)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('EnvSection — 渲染', () => {
  it('無 env vars 顯示 empty state', async () => {
    renderEnvSection({});

    await waitFor(() => {
      expect(screen.getByText('No environment variables defined')).toBeTruthy();
    });
  });

  it('EnvSection 不顯示 settings key hint', async () => {
    const { container } = renderEnvSection({});

    await waitFor(() => {
      expect(screen.getByText('No environment variables defined')).toBeTruthy();
      expect(container.querySelector('.settings-key-hint')).toBeNull();
    });
  });

  it('有 env vars 顯示 key/value rows', async () => {
    renderEnvSection({ env: { MY_VAR: 'hello', ANOTHER: 'world' } });

    await waitFor(() => {
      expect(screen.getByText('MY_VAR')).toBeTruthy();
      expect(screen.getByText('hello')).toBeTruthy();
      expect(screen.getByText('ANOTHER')).toBeTruthy();
      expect(screen.getByText('world')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// 敏感 key 遮罩
// ---------------------------------------------------------------------------

describe('EnvSection — 敏感 key 遮罩', () => {
  it('敏感 key 顯示 ••••••••', async () => {
    renderEnvSection({ env: { API_KEY: 'secret123' } });

    await waitFor(() => {
      expect(screen.getByText('••••••••')).toBeTruthy();
      expect(screen.queryByText('secret123')).toBeNull();
    });
  });

  it('非敏感 key 顯示明文值', async () => {
    renderEnvSection({ env: { MY_URL: 'https://example.com' } });

    await waitFor(() => {
      expect(screen.getByText('https://example.com')).toBeTruthy();
    });
  });

  it('敏感 key 有 toggle 按鈕，點擊後顯示明文', async () => {
    renderEnvSection({ env: { API_KEY: 'secret123' } });

    await waitFor(() => screen.getByText('••••••••'));

    const toggleBtn = screen.getByTitle('Toggle visibility');
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText('secret123')).toBeTruthy();
    });

    // 再次點擊 → 重新遮罩
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(screen.getByText('••••••••')).toBeTruthy();
    });
  });

  it('非敏感 key 無 toggle 按鈕', async () => {
    renderEnvSection({ env: { MY_VAR: 'hello' } });

    await waitFor(() => screen.getByText('hello'));
    expect(screen.queryByTitle('Toggle visibility')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 編輯
// ---------------------------------------------------------------------------

describe('EnvSection — 編輯', () => {
  it('點擊 Edit → 顯示 inline 輸入框', async () => {
    renderEnvSection({ env: { MY_VAR: 'hello' } });

    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('hello')).toBeTruthy();
    });
  });

  it('非敏感 key edit → 輸入框預填當前值', async () => {
    renderEnvSection({ env: { MY_VAR: 'hello' } });

    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));

    await waitFor(() => {
      const input = screen.getByDisplayValue('hello');
      expect(input).toBeTruthy();
    });
  });

  it('敏感 key edit → 輸入框為空', async () => {
    renderEnvSection({ env: { API_KEY: 'secret123' } });

    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));

    await waitFor(() => {
      // 敏感 key 的 input 應為空（placeholder 顯示，value 為空）
      const inputs = screen.getAllByRole('textbox');
      const editInput = inputs.find((el) => (el as HTMLInputElement).value === '');
      expect(editInput).toBeTruthy();
    });
  });

  it('edit → 輸入新值 → confirm → 呼叫 onSave 含新值', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({ env: { MY_VAR: 'hello' } }, onSave);

    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));

    await waitFor(() => screen.getByDisplayValue('hello'));
    const input = screen.getByDisplayValue('hello');
    fireEvent.change(input, { target: { value: 'world' } });

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', { MY_VAR: 'world' });
    });
  });

  it('edit → cancel → 不呼叫 onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({ env: { MY_VAR: 'hello' } }, onSave);

    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));

    await waitFor(() => screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('confirm 按鈕在 editValue 為空時 disabled', async () => {
    renderEnvSection({ env: { MY_VAR: 'hello' } });

    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));

    await waitFor(() => screen.getByDisplayValue('hello'));
    const input = screen.getByDisplayValue('hello');
    fireEvent.change(input, { target: { value: '' } });

    const confirmBtn = screen.getByText('Confirm').closest('button')!;
    expect(confirmBtn.disabled).toBe(true);
  });

  it('一次只能 edit 一個 row，編輯中其他 row buttons disabled', async () => {
    renderEnvSection({ env: { VAR_A: 'a', VAR_B: 'b' } });

    await waitFor(() => {
      const editBtns = screen.getAllByText('Edit');
      expect(editBtns.length).toBe(2);
    });

    const editBtns = screen.getAllByText('Edit');
    fireEvent.click(editBtns[0]);

    await waitFor(() => {
      // 第二個 row 的 Edit/Delete 應為 disabled
      const allEditBtns = screen.getAllByText('Edit');
      // 第一個 row 進入 edit 模式後，第二個 row 的 Edit button 應 disabled
      expect(allEditBtns[0].closest('button')?.disabled).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// scope 切換重置 editingKey
// ---------------------------------------------------------------------------

describe('EnvSection — scope 切換', () => {
  it('scope prop 改變 → 離開 edit 模式', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const settings = { env: { MY_VAR: 'hello' } };

    const { rerender } = renderWithI18n(
      <ToastProvider>
        <EnvSection scope="user" settings={settings} onSave={onSave} />
      </ToastProvider>,
    );

    await waitFor(() => screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => screen.getByText('Cancel'));

    // 切換 scope → editingKey 重置
    rerender(
      <I18nProvider locale="en">
        <ToastProvider>
          <EnvSection scope="project" settings={settings} onSave={onSave} />
        </ToastProvider>
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Cancel')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 新增
// ---------------------------------------------------------------------------

describe('EnvSection — 新增', () => {
  it('新增 key/value → onSave 被呼叫含新 entry', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({ env: { EXISTING: 'val' } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('VARIABLE_NAME'));

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');
    const valueInput = screen.getByPlaceholderText('value');

    fireEvent.change(keyInput, { target: { value: 'NEW_VAR' } });
    fireEvent.change(valueInput, { target: { value: 'new_value' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', { EXISTING: 'val', NEW_VAR: 'new_value' });
    });
  });

  it('新增後 inputs 清空', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('VARIABLE_NAME'));

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');
    const valueInput = screen.getByPlaceholderText('value');

    fireEvent.change(keyInput, { target: { value: 'MY_VAR' } });
    fireEvent.change(valueInput, { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect((keyInput as HTMLInputElement).value).toBe('');
      expect((valueInput as HTMLInputElement).value).toBe('');
    });
  });

  it('Add 按鈕在 key 或 value 為空時 disabled', async () => {
    renderEnvSection({});

    await waitFor(() => screen.getByText('Add'));
    const addBtn = screen.getByText('Add').closest('button')!;

    // 初始都空 → disabled
    expect(addBtn.disabled).toBe(true);

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');

    // 只填 key，value 空 → still disabled
    fireEvent.change(keyInput, { target: { value: 'MY_VAR' } });
    expect(addBtn.disabled).toBe(true);
  });

  it('duplicate key → 顯示錯誤，不呼叫 onSave', async () => {
    const onSave = vi.fn();
    renderEnvSection({ env: { EXISTING: 'val' } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('VARIABLE_NAME'));

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');
    const valueInput = screen.getByPlaceholderText('value');

    fireEvent.change(keyInput, { target: { value: 'EXISTING' } });
    fireEvent.change(valueInput, { target: { value: 'new' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText('Key already exists')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('invalid key（含空白）→ 顯示錯誤', async () => {
    const onSave = vi.fn();
    renderEnvSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('VARIABLE_NAME'));

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');
    const valueInput = screen.getByPlaceholderText('value');

    fireEvent.change(keyInput, { target: { value: 'INVALID KEY' } });
    fireEvent.change(valueInput, { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText('Key must contain only A-Z, 0-9, _')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('value input 按 Enter → 觸發 Add', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('VARIABLE_NAME'));

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');
    const valueInput = screen.getByPlaceholderText('value');

    fireEvent.change(keyInput, { target: { value: 'MY_VAR' } });
    fireEvent.change(valueInput, { target: { value: 'hello' } });
    fireEvent.keyDown(valueInput, { key: 'Enter' });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', { MY_VAR: 'hello' });
    });
  });
});

// ---------------------------------------------------------------------------
// 刪除
// ---------------------------------------------------------------------------

describe('EnvSection — 刪除', () => {
  it('點擊 Delete → onSave 被呼叫不含該 key', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({ env: { KEEP: 'yes', REMOVE: 'bye' } }, onSave);

    await waitFor(() => {
      const deleteBtns = screen.getAllByText('Delete');
      expect(deleteBtns.length).toBe(2);
    });

    // entries 按 Object.entries 順序：KEEP first
    const deleteBtns = screen.getAllByText('Delete');
    // 找到 REMOVE 的 row 的 Delete btn - it's the second one
    fireEvent.click(deleteBtns[1]);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', { KEEP: 'yes' });
    });
  });

  it('刪除最後一個 key → onSave 傳 env: {}', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({ env: { ONLY: 'one' } }, onSave);

    await waitFor(() => screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', {});
    });
  });
});
