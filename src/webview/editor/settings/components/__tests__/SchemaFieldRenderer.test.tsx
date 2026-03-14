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

  it('enum → renders EnumDropdown with options and notSet label', async () => {
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
      // notSet option rendered from i18n convention
      expect(screen.getByText('— not set —')).toBeTruthy();
    });
  });

  it('text → renders TextSetting with placeholder and save/clear buttons', async () => {
    renderField('language', {
      type: 'string',
      description: 'Claude 回應語言',
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
      type: 'number',
      default: 30,
      description: '自動清理週期',
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
      type: 'string[]',
      description: '可選模型清單',
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

  it('boolean → onDelete called on reset', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderField('fastMode', {
      type: 'boolean',
      default: false,
      description: '啟用快速模式',
      section: 'general',
      controlType: 'boolean',
    }, true, vi.fn().mockResolvedValue(undefined), onDelete);
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('fastMode'));
  });
});
