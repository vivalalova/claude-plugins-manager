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
// 全列表渲染 — 依 valueType 分組
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

  it('顯示 valueType group headers', async () => {
    renderEnvSection({});

    await waitFor(() => {
      expect(screen.getByText('Toggle')).toBeTruthy();
      expect(screen.getByText('Number')).toBeTruthy();
      expect(screen.getByText('Text')).toBeTruthy();
      expect(screen.getByText('Custom')).toBeTruthy();
    });
  });

  it('已知 env var 顯示 description', async () => {
    renderEnvSection({});

    await waitFor(() => {
      expect(screen.getByText('Override the default Claude model (alias or full model ID)')).toBeTruthy();
    });
  });

  it('boolean env var 渲染為 checkbox（重用 BooleanToggle）', async () => {
    renderEnvSection({});

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      const booleanVarCount = Object.values(KNOWN_ENV_VARS).filter(v => v.valueType === Boolean).length;
      expect(checkboxes.length).toBeGreaterThanOrEqual(booleanVarCount);
    });
  });

  it('number env var 渲染為 number input（重用 NumberSetting）', async () => {
    const { container } = renderEnvSection({});

    await waitFor(() => {
      const numberInputs = container.querySelectorAll('input[type="number"]');
      const numberVarCount = Object.values(KNOWN_ENV_VARS).filter(v => v.valueType === Number).length;
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
// Adapter 橋接 — boolean toggle via BooleanToggle
// ---------------------------------------------------------------------------

describe('EnvSection — Boolean adapter', () => {
  it('toggle checkbox → onSave 把 boolean 轉為 "1"/"0"', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({}, onSave);

    await waitFor(() => screen.getByText('ENABLE_LSP_TOOL'));

    const label = screen.getByText('ENABLE_LSP_TOOL');
    const checkbox = label.closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', expect.objectContaining({ ENABLE_LSP_TOOL: '1' }));
    });
  });

  it('已設定為 "1" 的 boolean → checkbox checked', async () => {
    renderEnvSection({ env: { ENABLE_LSP_TOOL: '1' } });

    await waitFor(() => {
      const label = screen.getByText('ENABLE_LSP_TOOL');
      const checkbox = label.closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Adapter 橋接 — string via TextSetting
// ---------------------------------------------------------------------------

describe('EnvSection — String adapter', () => {
  it('TextSetting Save → onSave 包含正確的 env object', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderEnvSection({}, onSave);

    await waitFor(() => screen.getByText('ANTHROPIC_MODEL'));

    const input = container.querySelector(`#ANTHROPIC_MODEL`) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'claude-opus-4-6' } });

    const field = input.closest('.settings-field')!;
    const saveBtn = field.querySelector('.btn-primary') as HTMLButtonElement;
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', expect.objectContaining({ ANTHROPIC_MODEL: 'claude-opus-4-6' }));
    });
  });

  it('Clear → 從 env 移除 key', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderEnvSection({ env: { ANTHROPIC_MODEL: 'test' } }, onSave);

    await waitFor(() => {
      expect(container.querySelector('#ANTHROPIC_MODEL')).toBeTruthy();
    });

    const input = container.querySelector('#ANTHROPIC_MODEL') as HTMLInputElement;
    const field = input.closest('.settings-field')!;
    const clearBtn = field.querySelector('.btn-secondary') as HTMLButtonElement;
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', expect.not.objectContaining({ ANTHROPIC_MODEL: expect.anything() }));
    });
  });
});

// ---------------------------------------------------------------------------
// Sensitive field
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
      expect(container.querySelector('#env-ANTHROPIC_API_KEY')).toBeTruthy();
    });

    const input = container.querySelector('#env-ANTHROPIC_API_KEY') as HTMLInputElement;
    expect(input.type).toBe('password');

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
      expect(screen.getByDisplayValue('MY_CUSTOM_VAR')).toBeTruthy();
      expect(screen.getByDisplayValue('hello')).toBeTruthy();
    });
  });

  it('AddEnvForm: 新增 custom var', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEnvSection({}, onSave);

    await waitFor(() => screen.getByPlaceholderText('VARIABLE_NAME'));

    const keyInput = screen.getByPlaceholderText('VARIABLE_NAME');
    const valueInputs = screen.getAllByPlaceholderText('value');
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

  it('Add 按鈕在 key 或 value 為空時 disabled', async () => {
    renderEnvSection({});

    await waitFor(() => screen.getByText('Add'));
    const addBtn = screen.getByText('Add').closest('button')!;
    expect(addBtn.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Number field via NumberSetting
// ---------------------------------------------------------------------------

describe('EnvSection — Number adapter', () => {
  it('NumberSetting Save → onSave 含 string 值', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = renderEnvSection({}, onSave);

    await waitFor(() => {
      expect(container.querySelector('#MAX_THINKING_TOKENS')).toBeTruthy();
    });

    const input = container.querySelector('#MAX_THINKING_TOKENS') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8000' } });

    const field = input.closest('.settings-field')!;
    const saveBtn = field.querySelector('.btn-primary') as HTMLButtonElement;
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('env', expect.objectContaining({ MAX_THINKING_TOKENS: '8000' }));
    });
  });
});
