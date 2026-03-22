/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { GridFilter } from '../GridFilter';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GridFilter — 渲染', () => {
  it('顯示 search input', () => {
    renderWithI18n(
      <GridFilter
        filterText=""
        onFilterChange={vi.fn()}
        showMode="all"
        onShowModeChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('searchbox') ?? screen.getByRole('textbox')).toBeTruthy();
  });

  it('顯示 All 與 Customized mode chips', () => {
    renderWithI18n(
      <GridFilter
        filterText=""
        onFilterChange={vi.fn()}
        showMode="all"
        onShowModeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /All/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Customized/i })).toBeTruthy();
  });

  it('filterText 非空時顯示 clear button', () => {
    renderWithI18n(
      <GridFilter
        filterText="fast"
        onFilterChange={vi.fn()}
        showMode="all"
        onShowModeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /clear/i })).toBeTruthy();
  });

  it('filterText 為空時不顯示 clear button', () => {
    renderWithI18n(
      <GridFilter
        filterText=""
        onFilterChange={vi.fn()}
        showMode="all"
        onShowModeChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });
});

describe('GridFilter — 互動', () => {
  it('輸入文字呼叫 onFilterChange', () => {
    const onFilterChange = vi.fn();

    renderWithI18n(
      <GridFilter
        filterText=""
        onFilterChange={onFilterChange}
        showMode="all"
        onShowModeChange={vi.fn()}
      />,
    );

    const input = screen.queryByRole('searchbox') ?? screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'fast' } });

    expect(onFilterChange).toHaveBeenCalledWith('fast');
  });

  it('點擊 Customized chip 呼叫 onShowModeChange("customized")', () => {
    const onShowModeChange = vi.fn();

    renderWithI18n(
      <GridFilter
        filterText=""
        onFilterChange={vi.fn()}
        showMode="all"
        onShowModeChange={onShowModeChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Customized/i }));
    expect(onShowModeChange).toHaveBeenCalledWith('customized');
  });

  it('點擊 All chip 呼叫 onShowModeChange("all")', () => {
    const onShowModeChange = vi.fn();

    renderWithI18n(
      <GridFilter
        filterText=""
        onFilterChange={vi.fn()}
        showMode="customized"
        onShowModeChange={onShowModeChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^All$/i }));
    expect(onShowModeChange).toHaveBeenCalledWith('all');
  });

  it('點擊 clear button 呼叫 onFilterChange("")', () => {
    const onFilterChange = vi.fn();

    renderWithI18n(
      <GridFilter
        filterText="fast"
        onFilterChange={onFilterChange}
        showMode="all"
        onShowModeChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onFilterChange).toHaveBeenCalledWith('');
  });
});
