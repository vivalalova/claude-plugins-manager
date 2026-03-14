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
      type: 'boolean',
      default: false,
      description: '啟用快速模式',
      section: 'general',
      controlType: 'boolean',
    });
    await waitFor(() => {
      expect(screen.getByText('Fast Mode')).toBeTruthy();
      expect(screen.getByRole('checkbox')).toBeTruthy();
    });
  });

  it('enum → renders EnumDropdown with options', async () => {
    renderField('effortLevel', {
      type: "'high' | 'medium' | 'low'",
      default: 'high',
      description: '思考深度',
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
    });
  });

  it('text → renders TextSetting with placeholder', async () => {
    renderField('language', {
      type: 'string',
      description: 'Claude 回應語言',
      section: 'general',
      controlType: 'text',
    });
    await waitFor(() => {
      expect(screen.getByText('Language')).toBeTruthy();
      expect(screen.getByRole('textbox')).toBeTruthy();
    });
  });

  it('number → renders NumberSetting with min/step', async () => {
    renderField('cleanupPeriodDays', {
      type: 'number',
      default: 30,
      description: '自動清理週期',
      section: 'general',
      controlType: 'number',
      min: 1,
      step: 1,
    });
    await waitFor(() => {
      expect(screen.getByText('Cleanup Period Days')).toBeTruthy();
      const input = screen.getByRole('spinbutton');
      expect(input).toBeTruthy();
      expect(input.getAttribute('min')).toBe('1');
      expect(input.getAttribute('step')).toBe('1');
    });
  });

  it('tagInput → renders TagInput', async () => {
    renderField('availableModels', {
      type: 'string[]',
      description: '可選模型清單',
      section: 'general',
      controlType: 'tagInput',
    }, []);
    await waitFor(() => {
      expect(screen.getByText('Available Models Whitelist')).toBeTruthy();
    });
  });

  it('custom → returns null', () => {
    const { container } = renderField('hooks', {
      type: 'object',
      description: 'lifecycle hooks',
      section: 'hooks',
      controlType: 'custom',
    });
    expect(container.querySelector('.settings-field')).toBeNull();
  });

  it('boolean → onSave called on checkbox change', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderField('fastMode', {
      type: 'boolean',
      default: false,
      description: '啟用快速模式',
      section: 'general',
      controlType: 'boolean',
    }, undefined, onSave);
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('fastMode', true));
  });

  it('i18n key convention: settings.{section}.{key}.label', async () => {
    renderField('includeGitInstructions', {
      type: 'boolean',
      default: true,
      description: 'git context',
      section: 'general',
      controlType: 'boolean',
    });
    await waitFor(() => {
      expect(screen.getByText('Include Git Instructions')).toBeTruthy();
    });
  });
});
