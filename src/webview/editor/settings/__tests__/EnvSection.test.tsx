/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { isSensitiveKey, EnvSection } from '../EnvSection';
import { ToastProvider } from '../../../components/Toast';
import { KNOWN_ENV_VARS } from '../../../../shared/known-env-vars';

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
    ['API_KEY', true],
    ['MY_KEY', true],
    ['GITHUB_TOKEN', true],
    ['DB_PASSWORD', true],
    ['AWS_SECRET', true],
    ['CLIENT_CREDENTIAL', true],
    ['SECRET', true],
    ['TOKEN', true],
    ['PASSWORD', true],
    ['MY_KEYCHAIN', false],
    ['MONKEY', false],
    ['SECRET_SAUCE', false],
    ['API_URL', false],
    ['DATABASE_HOST', false],
  ])('%s → %s', (key, expected) => {
    expect(isSensitiveKey(key)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 全列表渲染
// ---------------------------------------------------------------------------

describe('EnvSection — 全列表渲染', () => {
  it('即使 env 為空，也顯示所有已知 env vars', async () => {
    renderEnvSection({});

    await waitFor(() => {
      expect(screen.getByText('ANTHROPIC_MODEL')).toBeTruthy();
      expect(screen.getByText('ANTHROPIC_API_KEY')).toBeTruthy();
      expect(screen.getByText('ENABLE_LSP_TOOL')).toBeTruthy();
      expect(screen.getByText('DISABLE_TELEMETRY')).toBeTruthy();
    });
  });

  it('顯示 category headers', async () => {
    renderEnvSection({});

    await waitFor(() => {
      expect(screen.getByText('Model')).toBeTruthy();
      expect(screen.getByText('Auth')).toBeTruthy();
      expect(screen.getByText('Effort')).toBeTruthy();
      expect(screen.getByText('Timeout')).toBeTruthy();
      expect(screen.getByText('Feature')).toBeTruthy();
      expect(screen.getByText('Telemetry')).toBeTruthy();
      expect(screen.getByText('Custom')).toBeTruthy();
    });
  });

  it('已知 env var 顯示 description', async () => {
    renderEnvSection({});

    await waitFor(() => {
      expect(screen.getByText('Override the default Claude model (alias or full model ID)')).toBeTruthy();
    });
  });

  it('boolean env var 渲染為 checkbox', async () => {
    renderEnvSection({});

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      // 至少有 boolean 類型的 known vars
      const booleanVarCount = Object.values(KNOWN_ENV_VARS).filter(v => v.valueType === 'boolean').length;
      expect(checkboxes.length).toBeGreaterThanOrEqual(booleanVarCount);
    });
  });

  it('number env var 渲染為 number input', async () => {
    const { container } = renderEnvSection({});

    await waitFor(() => {
      const numberInputs = container.querySelectorAll('input[type="number"]');
      const numberVarCount = Object.values(KNOWN_ENV_VARS).filter(v => v.valueType === 'number').length;
      expect(numberInputs.length).toBe(numberVarCount);
    });
  });

  it('已設定的 known var 顯示其值', async () => {
    renderEnvSection({ env: { ANTHROPIC_MODEL: 'claude-opus-4-6' } });

    await waitFor(() => {
      const input = screen.getByDisplayValue('claude-opus-4-6');
      expect(input).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Boolean field 互動
// ---------------------------------------------------------------------------

describe('EnvSection — Boolean field', () => {
  it('toggle checkbox → onSave 被呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({}, onSave);

    await waitFor(() => screen.getByText('ENABLE_LSP_TOOL'));

    // ENABLE_LSP_TOOL default '0', so checkbox is unchecked
    const label = screen.getByText('ENABLE_LSP_TOOL');
    const checkbox = label.closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', { ENABLE_LSP_TOOL: '1' });
    });
  });

  it('已設定為 1 的 boolean → checkbox checked', async () => {
    renderEnvSection({ env: { ENABLE_LSP_TOOL: '1' } });

    await waitFor(() => {
      const label = screen.getByText('ENABLE_LSP_TOOL');
      const checkbox = label.closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  it('boolean 值與 default 不同 → 顯示 Reset 按鈕', async () => {
    renderEnvSection({ env: { ENABLE_LSP_TOOL: '1' } });

    await waitFor(() => {
      // ENABLE_LSP_TOOL default is '0', set to '1' → should show Reset
      const resetButtons = screen.getAllByText('Reset');
      expect(resetButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// String field 互動
// ---------------------------------------------------------------------------

describe('EnvSection — String field', () => {
  it('輸入值 → 點 Save → onSave 被呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderEnvSection({}, onSave);

    await waitFor(() => screen.getByText('ANTHROPIC_MODEL'));

    // Find ANTHROPIC_MODEL input by id
    const input = container.querySelector('#env-ANTHROPIC_MODEL') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'claude-opus-4-6' } });

    // Find Save button in same settings-field
    const field = input.closest('.settings-field')!;
    const saveBtn = field.querySelector('.btn-primary') as HTMLButtonElement;
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', { ANTHROPIC_MODEL: 'claude-opus-4-6' });
    });
  });

  it('已有值 → 顯示 Clear 按鈕', async () => {
    const { container } = renderEnvSection({ env: { ANTHROPIC_MODEL: 'claude-opus-4-6' } });

    await waitFor(() => {
      const input = container.querySelector('#env-ANTHROPIC_MODEL') as HTMLInputElement;
      const field = input.closest('.settings-field')!;
      const clearBtn = field.querySelector('.btn-secondary') as HTMLButtonElement;
      expect(clearBtn.textContent).toBe('Clear');
    });
  });

  it('Clear → 移除 key', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderEnvSection({ env: { ANTHROPIC_MODEL: 'test' } }, onSave);

    await waitFor(() => {
      const input = container.querySelector('#env-ANTHROPIC_MODEL') as HTMLInputElement;
      expect(input).toBeTruthy();
    });

    const input = container.querySelector('#env-ANTHROPIC_MODEL') as HTMLInputElement;
    const field = input.closest('.settings-field')!;
    const clearBtn = field.querySelector('.btn-secondary') as HTMLButtonElement;
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', {});
    });
  });
});

// ---------------------------------------------------------------------------
// Sensitive string field
// ---------------------------------------------------------------------------

describe('EnvSection — Sensitive field', () => {
  it('sensitive field 使用 password input', async () => {
    const { container } = renderEnvSection({});

    await waitFor(() => {
      const input = container.querySelector('#env-ANTHROPIC_API_KEY') as HTMLInputElement;
      expect(input.type).toBe('password');
    });
  });

  it('reveal toggle 切換 password/text', async () => {
    const { container } = renderEnvSection({});

    await waitFor(() => {
      const input = container.querySelector('#env-ANTHROPIC_API_KEY') as HTMLInputElement;
      expect(input.type).toBe('password');
    });

    const input = container.querySelector('#env-ANTHROPIC_API_KEY') as HTMLInputElement;
    const field = input.closest('.settings-field')!;
    const revealBtn = field.querySelector('.env-sensitive-row .btn-secondary') as HTMLButtonElement;
    fireEvent.click(revealBtn);

    expect(input.type).toBe('text');

    fireEvent.click(revealBtn);
    expect(input.type).toBe('password');
  });

  it('已設定 sensitive var → placeholder 顯示 ••••••••', async () => {
    const { container } = renderEnvSection({ env: { ANTHROPIC_API_KEY: 'sk-123' } });

    await waitFor(() => {
      const input = container.querySelector('#env-ANTHROPIC_API_KEY') as HTMLInputElement;
      expect(input.placeholder).toBe('••••••••');
    });
  });
});

// ---------------------------------------------------------------------------
// Custom env vars
// ---------------------------------------------------------------------------

describe('EnvSection — Custom vars', () => {
  it('不在 registry 的 env var 出現在 Custom section', async () => {
    renderEnvSection({ env: { MY_CUSTOM_VAR: 'hello' } });

    await waitFor(() => {
      expect(screen.getByText('MY_CUSTOM_VAR')).toBeTruthy();
      expect(screen.getByDisplayValue('hello')).toBeTruthy();
    });
  });

  it('AddEnvForm: 新增 custom var', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('VARIABLE_NAME'));

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');
    const valueInputs = screen.getAllByPlaceholderText('value');
    // The last 'value' placeholder is the add form's value input
    const valueInput = valueInputs[valueInputs.length - 1];

    fireEvent.change(keyInput, { target: { value: 'NEW_VAR' } });
    fireEvent.change(valueInput, { target: { value: 'new_value' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', { NEW_VAR: 'new_value' });
    });
  });

  it('duplicate key → 顯示錯誤', async () => {
    const onSave = vi.fn();
    renderEnvSection({ env: { EXISTING: 'val' } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('VARIABLE_NAME'));

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');
    const valueInputs = screen.getAllByPlaceholderText('value');
    const valueInput = valueInputs[valueInputs.length - 1];

    fireEvent.change(keyInput, { target: { value: 'EXISTING' } });
    fireEvent.change(valueInput, { target: { value: 'new' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText('Key already exists')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('invalid key → 顯示錯誤', async () => {
    const onSave = vi.fn();
    renderEnvSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('VARIABLE_NAME'));

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');
    const valueInputs = screen.getAllByPlaceholderText('value');
    const valueInput = valueInputs[valueInputs.length - 1];

    fireEvent.change(keyInput, { target: { value: 'INVALID KEY' } });
    fireEvent.change(valueInput, { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText('Key must contain only A-Z, 0-9, _')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('Add 按鈕在 key 或 value 為空時 disabled', async () => {
    renderEnvSection({});

    await waitFor(() => screen.getByText('Add'));
    const addBtn = screen.getByText('Add').closest('button')!;
    expect(addBtn.disabled).toBe(true);
  });

  it('value input 按 Enter → 觸發 Add', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('VARIABLE_NAME'));

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');
    const valueInputs = screen.getAllByPlaceholderText('value');
    const valueInput = valueInputs[valueInputs.length - 1];

    fireEvent.change(keyInput, { target: { value: 'MY_VAR' } });
    fireEvent.change(valueInput, { target: { value: 'hello' } });
    fireEvent.keyDown(valueInput, { key: 'Enter' });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', { MY_VAR: 'hello' });
    });
  });
});

// ---------------------------------------------------------------------------
// Number field
// ---------------------------------------------------------------------------

describe('EnvSection — Number field', () => {
  it('number field Save → onSave 含值', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderEnvSection({}, onSave);

    await waitFor(() => {
      expect(container.querySelector('#env-MAX_THINKING_TOKENS')).toBeTruthy();
    });

    const input = container.querySelector('#env-MAX_THINKING_TOKENS') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8000' } });

    const field = input.closest('.settings-field')!;
    const saveBtn = field.querySelector('.btn-primary') as HTMLButtonElement;
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', { MAX_THINKING_TOKENS: '8000' });
    });
  });
});
