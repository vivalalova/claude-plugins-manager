/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderWithI18n } from '../../__test-utils__/renderWithProviders';
import { MultiSelectDropdown } from '../MultiSelectDropdown';

vi.mock('../../vscode', () => ({ vscode: { postMessage: vi.fn() } }));

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

afterEach(() => cleanup());

describe('MultiSelectDropdown', () => {
  it('預設關閉，不顯示選項', () => {
    renderWithI18n(
      <MultiSelectDropdown label="Test" options={OPTIONS} selected={new Set()} onToggle={vi.fn()} />,
    );
    expect(screen.queryByText('Option A')).toBeNull();
  });

  it('點擊 trigger 開啟 panel', () => {
    renderWithI18n(
      <MultiSelectDropdown label="Test" options={OPTIONS} selected={new Set()} onToggle={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));
    expect(screen.getByText('Option A')).toBeTruthy();
    expect(screen.getByText('Option B')).toBeTruthy();
    expect(screen.getByText('Option C')).toBeTruthy();
  });

  it('點擊選項觸發 onToggle 帶對應值', () => {
    const onToggle = vi.fn();
    renderWithI18n(
      <MultiSelectDropdown label="Test" options={OPTIONS} selected={new Set()} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));
    fireEvent.click(screen.getByText('Option A'));
    expect(onToggle).toHaveBeenCalledWith('a');
  });

  it('selected.size > 0 時 trigger label 顯示 (N)', () => {
    renderWithI18n(
      <MultiSelectDropdown label="Test" options={OPTIONS} selected={new Set(['a', 'b'])} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Test (2)' })).toBeTruthy();
  });

  it('selected.size > 0 時 trigger 有 filter-chip--active class', () => {
    renderWithI18n(
      <MultiSelectDropdown label="Test" options={OPTIONS} selected={new Set(['a'])} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Test (1)' }).className).toContain('filter-chip--active');
  });

  it('selected.size === 0 時 trigger 無 filter-chip--active class', () => {
    renderWithI18n(
      <MultiSelectDropdown label="Test" options={OPTIONS} selected={new Set()} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Test' }).className).not.toContain('filter-chip--active');
  });

  it('panel 開啟後 Escape 關閉 panel', () => {
    renderWithI18n(
      <MultiSelectDropdown label="Test" options={OPTIONS} selected={new Set()} onToggle={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));
    expect(screen.getByText('Option A')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Option A')).toBeNull();
  });

  it('點擊 panel 外部關閉 panel', () => {
    renderWithI18n(
      <MultiSelectDropdown label="Test" options={OPTIONS} selected={new Set()} onToggle={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));
    expect(screen.getByText('Option A')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Option A')).toBeNull();
  });
});
