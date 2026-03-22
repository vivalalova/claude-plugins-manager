/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { SchemaFieldRenderer } from '../SchemaFieldRenderer';
import { ToastProvider } from '../../../../components/Toast';
import type { SettingFieldSchema } from '../../../../../shared/claude-settings-schema';

vi.mock('../../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

const renderField = (
  settingKey: string,
  schema: SettingFieldSchema,
  value: unknown = undefined,
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
) =>
  renderWithI18n(
    <ToastProvider>
      <SchemaFieldRenderer
        settingKey={settingKey}
        schema={schema}
        value={value}
        scope="user"
        onSave={onSave}
        onDelete={onDelete}
      />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SchemaFieldRenderer', () => {
  it('boolean → renders BooleanToggle with label', async () => {
    renderField('fastMode', {
      default: false,
      section: 'general',
      controlType: 'boolean',
    });
    await waitFor(() => {
      expect(screen.getByText('Fast Mode')).toBeTruthy();
      expect(screen.getByRole('checkbox')).toBeTruthy();
    });
  });

  it('enum → renders EnumDropdown with options and notSet label', async () => {
    renderField('effortLevel', {
      default: 'high',
      section: 'general',
      controlType: 'enum',
      options: ['high', 'medium', 'low'] as const,
    });
    await waitFor(() => {
      expect(screen.getByText('Effort Level')).toBeTruthy();
      const select = screen.getByRole('combobox');
      expect(select).toBeTruthy();
      expect(screen.getByText('High')).toBeTruthy();
      expect(screen.getByText('Medium')).toBeTruthy();
      expect(screen.getByText('Low')).toBeTruthy();
      // notSet option rendered from i18n convention
      expect(screen.getByText('— not set —')).toBeTruthy();
    });
  });

  it('text → renders TextSetting with placeholder and save/clear buttons', async () => {
    renderField('language', {
      section: 'general',
      controlType: 'text',
    }, 'zh-TW');
    await waitFor(() => {
      expect(screen.getByText('Language')).toBeTruthy();
      const input = screen.getByRole('textbox');
      expect(input).toBeTruthy();
      expect(input.getAttribute('placeholder')).toBe('e.g. zh-TW');
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
    });
  });

  it('number → renders NumberSetting with min/max/step', async () => {
    renderField('cleanupPeriodDays', {
      default: 30,
      section: 'general',
      controlType: 'number',
      min: 0,
      max: 365,
      step: 1,
    });
    await waitFor(() => {
      expect(screen.getByText('Cleanup Period Days')).toBeTruthy();
      const input = screen.getByRole('spinbutton');
      expect(input).toBeTruthy();
      expect(input.getAttribute('min')).toBe('0');
      expect(input.getAttribute('max')).toBe('365');
      expect(input.getAttribute('step')).toBe('1');
    });
  });

  it('tagInput → renders TagInput with add button', async () => {
    renderField('availableModels', {
      section: 'general',
      controlType: 'tagInput',
    }, []);
    await waitFor(() => {
      expect(screen.getByText('Available Models Whitelist')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
    });
  });

  it('custom → returns null', () => {
    const { container } = renderField('hooks', {
      section: 'hooks',
      controlType: 'custom',
    });
    expect(container.querySelector('.settings-field')).toBeNull();
  });

  it('boolean → onSave called on checkbox change', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderField('fastMode', {
      default: false,
      section: 'general',
      controlType: 'boolean',
    }, undefined, onSave);
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('fastMode', true));
  });

  it('i18n key convention: settings.{section}.{key}.label', async () => {
    renderField('includeGitInstructions', {
      default: true,
      section: 'general',
      controlType: 'boolean',
    });
    await waitFor(() => {
      expect(screen.getByText('Include Git Instructions')).toBeTruthy();
    });
  });

  it('boolean → onDelete called on reset', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderField('fastMode', {
      default: false,
      section: 'general',
      controlType: 'boolean',
    }, true, vi.fn().mockResolvedValue(undefined), onDelete);
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('fastMode'));
  });
});

describe('SchemaFieldRenderer — override indicator', () => {
  const renderFieldWithOverride = (
    settingKey: string,
    schema: SettingFieldSchema,
    value: unknown,
    overriddenScope?: 'user' | 'project' | 'local',
  ) =>
    renderWithI18n(
      <ToastProvider>
        <SchemaFieldRenderer
          settingKey={settingKey}
          schema={schema}
          value={value}
          scope="project"
          overriddenScope={overriddenScope}
          onSave={vi.fn().mockResolvedValue(undefined)}
          onDelete={vi.fn().mockResolvedValue(undefined)}
        />
      </ToastProvider>,
    );

  it('overriddenScope=user → override badge 顯示', async () => {
    renderFieldWithOverride('fastMode', {
      default: false,
      section: 'general',
      controlType: 'boolean',
    }, true, 'user');
    await waitFor(() => {
      expect(screen.getByText(/Overrides/i)).toBeTruthy();
      expect(screen.getByText(/Overrides/i).classList.contains('settings-override-badge')).toBe(true);
    });
  });

  it('overriddenScope=undefined → 無 override badge', async () => {
    renderFieldWithOverride('fastMode', {
      default: false,
      section: 'general',
      controlType: 'boolean',
    }, true, undefined);
    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toBeTruthy();
      expect(screen.queryByText(/Overrides/i)).toBeNull();
    });
  });

  it('enum + overriddenScope=user → override badge 顯示', async () => {
    renderFieldWithOverride('effortLevel', {
      default: 'high',
      section: 'general',
      controlType: 'enum',
      options: ['high', 'medium', 'low'] as const,
    }, 'low', 'user');
    await waitFor(() => {
      expect(screen.getByText(/Overrides/i)).toBeTruthy();
    });
  });
});

describe('SchemaFieldRenderer — Reset 按鈕', () => {
  it('enum：value 與 default 不同 → Reset 按鈕顯示', async () => {
    renderField('effortLevel', {
      default: 'high',
      section: 'general',
      controlType: 'enum',
      options: ['high', 'medium', 'low'] as const,
    }, 'low');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reset/ })).toBeTruthy();
    });
  });

  it('enum：value 未設定 → 無 Reset', async () => {
    renderField('effortLevel', {
      default: 'high',
      section: 'general',
      controlType: 'enum',
      options: ['high', 'medium', 'low'] as const,
    }, undefined);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Reset/ })).toBeNull();
    });
  });

  it('enum：value 等於 default → 無 Reset', async () => {
    renderField('effortLevel', {
      default: 'high',
      section: 'general',
      controlType: 'enum',
      options: ['high', 'medium', 'low'] as const,
    }, 'high');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Reset/ })).toBeNull();
    });
  });

  it('enum：點擊 Reset → onDelete 被呼叫', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderField('effortLevel', {
      default: 'high',
      section: 'general',
      controlType: 'enum',
      options: ['high', 'medium', 'low'] as const,
    }, 'low', vi.fn().mockResolvedValue(undefined), onDelete);
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('effortLevel'));
  });

  it('text：無 default → 無 Reset', async () => {
    renderField('language', {
      section: 'general',
      controlType: 'text',
    }, 'zh-TW');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Reset/ })).toBeNull();
    });
  });

  it('number：value 與 default 不同 → Reset 顯示', async () => {
    renderField('cleanupPeriodDays', {
      default: 30,
      section: 'general',
      controlType: 'number',
      min: 0,
      step: 1,
    }, 60);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reset/ })).toBeTruthy();
    });
  });

  it('boolean：value=false default=false → 無 Reset', async () => {
    renderField('fastMode', {
      default: false,
      section: 'general',
      controlType: 'boolean',
    }, false);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Reset/ })).toBeNull();
    });
  });
});
