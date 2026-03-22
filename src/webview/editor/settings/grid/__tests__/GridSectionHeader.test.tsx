/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { GridSectionHeader } from '../GridSectionHeader';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GridSectionHeader — 渲染', () => {
  it('顯示 section label', () => {
    renderWithI18n(
      <GridSectionHeader
        label="General"
        expanded={true}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('General')).toBeTruthy();
  });

  it('expanded=true 時 aria-expanded="true"', () => {
    const { container } = renderWithI18n(
      <GridSectionHeader
        label="General"
        expanded={true}
        onToggle={vi.fn()}
      />,
    );

    expect(container.querySelector('[aria-expanded="true"]')).toBeTruthy();
    expect(container.querySelector('[aria-expanded="false"]')).toBeNull();
  });

  it('expanded=false 時 aria-expanded="false"', () => {
    const { container } = renderWithI18n(
      <GridSectionHeader
        label="General"
        expanded={false}
        onToggle={vi.fn()}
      />,
    );

    expect(container.querySelector('[aria-expanded="false"]')).toBeTruthy();
    expect(container.querySelector('[aria-expanded="true"]')).toBeNull();
  });
});

describe('GridSectionHeader — 互動', () => {
  it('點擊 header 呼叫 onToggle', () => {
    const onToggle = vi.fn();

    renderWithI18n(
      <GridSectionHeader
        label="General"
        expanded={true}
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByText('General'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('點擊 collapsed header 同樣呼叫 onToggle', () => {
    const onToggle = vi.fn();

    renderWithI18n(
      <GridSectionHeader
        label="Display"
        expanded={false}
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByText('Display'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
