/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { GridCellEditor } from '../GridCellEditor';
import type { SettingFieldSchema } from '../../../../../shared/claude-settings-schema';

const booleanSchema: SettingFieldSchema = {
  type: 'boolean',
  default: false,
  description: 'Test boolean setting',
  section: 'general',
  controlType: 'boolean',
};

const enumSchema: SettingFieldSchema = {
  type: "'high' | 'medium' | 'low'",
  default: 'high',
  description: 'Test enum setting',
  section: 'general',
  controlType: 'enum',
  options: ['high', 'medium', 'low'] as const,
};

const textSchema: SettingFieldSchema = {
  type: 'string',
  description: 'Test text setting',
  section: 'general',
  controlType: 'text',
};

const numberSchema: SettingFieldSchema = {
  type: 'number',
  default: 30,
  description: 'Test number setting',
  section: 'general',
  controlType: 'number',
  min: 0,
  max: 365,
  step: 1,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GridCellEditor — boolean', () => {
  it('renders checkbox', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="fastMode"
        schema={booleanSchema}
        value={false}
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('checkbox checked=false 反映 value=false', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="fastMode"
        schema={booleanSchema}
        value={false}
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('checkbox checked=true 反映 value=true', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="fastMode"
        schema={booleanSchema}
        value={true}
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('change checkbox 呼叫 onSave with toggled value', async () => {
    const onSave = vi.fn();

    renderWithI18n(
      <GridCellEditor
        settingKey="fastMode"
        schema={booleanSchema}
        value={false}
        scope="user"
        onSave={onSave}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(true));
  });

  it('disabled=true 時 checkbox disabled', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="fastMode"
        schema={booleanSchema}
        value={false}
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={true}
      />,
    );

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
  });
});

describe('GridCellEditor — enum', () => {
  it('renders select element', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="effortLevel"
        schema={enumSchema}
        value="high"
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('顯示 enum options', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="effortLevel"
        schema={enumSchema}
        value="high"
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByRole('option', { name: /high/i })).toBeTruthy();
    expect(screen.getByRole('option', { name: /medium/i })).toBeTruthy();
    expect(screen.getByRole('option', { name: /low/i })).toBeTruthy();
  });

  it('select change 呼叫 onSave with new value', async () => {
    const onSave = vi.fn();

    renderWithI18n(
      <GridCellEditor
        settingKey="effortLevel"
        schema={enumSchema}
        value="high"
        scope="user"
        onSave={onSave}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'low' } });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('low'));
  });

  it('select empty value 呼叫 onDelete', async () => {
    const onDelete = vi.fn();

    renderWithI18n(
      <GridCellEditor
        settingKey="effortLevel"
        schema={enumSchema}
        value="high"
        scope="user"
        onSave={vi.fn()}
        onDelete={onDelete}
        disabled={false}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    await waitFor(() => expect(onDelete).toHaveBeenCalled());
  });

  it('disabled=true 時 select disabled', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="effortLevel"
        schema={enumSchema}
        value="high"
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={true}
      />,
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});

describe('GridCellEditor — text', () => {
  it('顯示 value 文字', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="language"
        schema={textSchema}
        value="zh-TW"
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText('zh-TW')).toBeTruthy();
  });

  it('點擊顯示 input', async () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="language"
        schema={textSchema}
        value="zh-TW"
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByText('zh-TW'));
    await waitFor(() => expect(screen.getByRole('textbox')).toBeTruthy());
  });

  it('Enter 鍵儲存值並呼叫 onSave', async () => {
    const onSave = vi.fn();

    renderWithI18n(
      <GridCellEditor
        settingKey="language"
        schema={textSchema}
        value="zh-TW"
        scope="user"
        onSave={onSave}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByText('zh-TW'));
    const input = await waitFor(() => screen.getByRole('textbox'));
    fireEvent.change(input, { target: { value: 'en' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('en'));
  });

  it('Esc 鍵取消編輯不呼叫 onSave', async () => {
    const onSave = vi.fn();

    renderWithI18n(
      <GridCellEditor
        settingKey="language"
        schema={textSchema}
        value="zh-TW"
        scope="user"
        onSave={onSave}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByText('zh-TW'));
    const input = await waitFor(() => screen.getByRole('textbox'));
    fireEvent.change(input, { target: { value: 'ja' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('儲存空字串呼叫 onDelete', async () => {
    const onDelete = vi.fn();

    renderWithI18n(
      <GridCellEditor
        settingKey="language"
        schema={textSchema}
        value="zh-TW"
        scope="user"
        onSave={vi.fn()}
        onDelete={onDelete}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByText('zh-TW'));
    const input = await waitFor(() => screen.getByRole('textbox'));
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
  });

  it('disabled=true 時點擊不啟動 input', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="language"
        schema={textSchema}
        value="zh-TW"
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={true}
      />,
    );

    fireEvent.click(screen.getByText('zh-TW'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('GridCellEditor — number', () => {
  it('顯示數字值', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="cleanupPeriodDays"
        schema={numberSchema}
        value={30}
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByText('30')).toBeTruthy();
  });

  it('點擊顯示 number input', async () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="cleanupPeriodDays"
        schema={numberSchema}
        value={30}
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByText('30'));
    await waitFor(() => {
      const input = screen.getByRole('spinbutton');
      expect(input).toBeTruthy();
    });
  });

  it('Enter 鍵儲存有效數字', async () => {
    const onSave = vi.fn();

    renderWithI18n(
      <GridCellEditor
        settingKey="cleanupPeriodDays"
        schema={numberSchema}
        value={30}
        scope="user"
        onSave={onSave}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByText('30'));
    const input = await waitFor(() => screen.getByRole('spinbutton'));
    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // TextCell saves draft.trim() as a string; caller (GridRow) is responsible for type conversion
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('60'));
  });

  it('min/max 屬性設置正確', async () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="cleanupPeriodDays"
        schema={numberSchema}
        value={30}
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByText('30'));
    const input = await waitFor(() => screen.getByRole('spinbutton')) as HTMLInputElement;
    expect(input.min).toBe('0');
    expect(input.max).toBe('365');
  });

  it('disabled=true 時 number input 不啟動', () => {
    renderWithI18n(
      <GridCellEditor
        settingKey="cleanupPeriodDays"
        schema={numberSchema}
        value={30}
        scope="user"
        onSave={vi.fn()}
        onDelete={vi.fn()}
        disabled={true}
      />,
    );

    fireEvent.click(screen.getByText('30'));
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });
});
