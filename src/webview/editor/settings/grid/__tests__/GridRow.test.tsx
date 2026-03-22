/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { GridRow } from '../GridRow';
import type { SettingFieldSchema } from '../../../../../shared/claude-settings-schema';

const booleanSchema: SettingFieldSchema = {
  type: 'boolean',
  default: false,
  description: 'Test boolean description',
  section: 'general',
  controlType: 'boolean',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GridRow — 渲染 key cell', () => {
  it('顯示 setting label', () => {
    renderWithI18n(
      <GridRow
        settingKey="fastMode"
        schema={booleanSchema}
        label="Fast Mode"
        userValue={undefined}
        projectValue={undefined}
        localValue={undefined}
        hasWorkspace={true}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Fast Mode')).toBeTruthy();
  });

  it('description 透過 data-tooltip 或 title 屬性顯示', () => {
    const { container } = renderWithI18n(
      <GridRow
        settingKey="fastMode"
        schema={booleanSchema}
        label="Fast Mode"
        userValue={undefined}
        projectValue={undefined}
        localValue={undefined}
        hasWorkspace={true}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const tooltipEl = container.querySelector('[data-tooltip]') ??
      container.querySelector('[title]');
    expect(tooltipEl).toBeTruthy();
    const tooltipText = tooltipEl!.getAttribute('data-tooltip') ?? tooltipEl!.getAttribute('title') ?? '';
    expect(tooltipText).toContain('Test boolean description');
  });

  it('顯示 default value cell', () => {
    const { container } = renderWithI18n(
      <GridRow
        settingKey="fastMode"
        schema={booleanSchema}
        label="Fast Mode"
        userValue={undefined}
        projectValue={undefined}
        localValue={undefined}
        hasWorkspace={true}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Should render a default value cell (sg-cell--default or similar)
    const defaultCell = container.querySelector('.sg-cell--default') ??
      container.querySelector('[data-scope="default"]');
    expect(defaultCell).toBeTruthy();
  });
});

describe('GridRow — scope cells', () => {
  it('渲染 user、project、local scope 的 cell editor', () => {
    const { container } = renderWithI18n(
      <GridRow
        settingKey="fastMode"
        schema={booleanSchema}
        label="Fast Mode"
        userValue={undefined}
        projectValue={undefined}
        localValue={undefined}
        hasWorkspace={true}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const userCell = container.querySelector('[data-scope="user"]') ??
      container.querySelector('.sg-cell--user');
    const projectCell = container.querySelector('[data-scope="project"]') ??
      container.querySelector('.sg-cell--project');
    const localCell = container.querySelector('[data-scope="local"]') ??
      container.querySelector('.sg-cell--local');

    expect(userCell).toBeTruthy();
    expect(projectCell).toBeTruthy();
    expect(localCell).toBeTruthy();
  });

  it('有明確值的 cell 加 sg-cell--set class', () => {
    const { container } = renderWithI18n(
      <GridRow
        settingKey="fastMode"
        schema={booleanSchema}
        label="Fast Mode"
        userValue={true}
        projectValue={undefined}
        localValue={undefined}
        hasWorkspace={true}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const setCell = container.querySelector('.sg-cell--set');
    expect(setCell).toBeTruthy();
  });

  it('無明確值的 cell 不加 sg-cell--set class', () => {
    const { container } = renderWithI18n(
      <GridRow
        settingKey="fastMode"
        schema={booleanSchema}
        label="Fast Mode"
        userValue={undefined}
        projectValue={undefined}
        localValue={undefined}
        hasWorkspace={true}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const setCells = container.querySelectorAll('.sg-cell--set');
    expect(setCells.length).toBe(0);
  });

  it('hasWorkspace=false 時 project/local cell 加 sg-cell--disabled class', () => {
    const { container } = renderWithI18n(
      <GridRow
        settingKey="fastMode"
        schema={booleanSchema}
        label="Fast Mode"
        userValue={undefined}
        projectValue={undefined}
        localValue={undefined}
        hasWorkspace={false}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const disabledCells = container.querySelectorAll('.sg-cell--disabled');
    expect(disabledCells.length).toBeGreaterThanOrEqual(2);
  });

  it('hasWorkspace=true 時 project/local cell 不加 sg-cell--disabled class', () => {
    const { container } = renderWithI18n(
      <GridRow
        settingKey="fastMode"
        schema={booleanSchema}
        label="Fast Mode"
        userValue={undefined}
        projectValue={undefined}
        localValue={undefined}
        hasWorkspace={true}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const disabledCells = container.querySelectorAll('.sg-cell--disabled');
    expect(disabledCells.length).toBe(0);
  });
});

describe('GridRow — onSave 呼叫', () => {
  it('user scope cell 編輯時 onSave 傳 scope="user"', async () => {
    const onSave = vi.fn();

    renderWithI18n(
      <GridRow
        settingKey="fastMode"
        schema={booleanSchema}
        label="Fast Mode"
        userValue={false}
        projectValue={undefined}
        localValue={undefined}
        hasWorkspace={true}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'user' }),
      );
    });
  });
});
