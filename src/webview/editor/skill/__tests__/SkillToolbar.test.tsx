/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { SkillToolbar } from '../SkillToolbar';

describe('SkillToolbar', () => {
  const onSearchChange = vi.fn();
  const onPageTabChange = vi.fn();
  const onScopeFilterChange = vi.fn();
  const onRegistrySortChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('installed tab 顯示本地搜尋 placeholder、clear button 與 scope filter', () => {
    renderWithI18n(
      <SkillToolbar
        search="lint"
        onSearchChange={onSearchChange}
        pageTab="installed"
        onPageTabChange={onPageTabChange}
        scopeFilter={null}
        onScopeFilterChange={onScopeFilterChange}
        registrySort="all-time"
        onRegistrySortChange={onRegistrySortChange}
      />,
    );

    expect((screen.getByPlaceholderText('Search skills...') as HTMLInputElement).value).toBe('lint');

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Project' }));

    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(onScopeFilterChange).toHaveBeenCalledWith('project');
    expect(screen.getByText('All')).toBeTruthy();
  });

  it('online tab 顯示線上搜尋 placeholder，切 tab 會通知上層', () => {
    renderWithI18n(
      <SkillToolbar
        search=""
        onSearchChange={onSearchChange}
        pageTab="online"
        onPageTabChange={onPageTabChange}
        scopeFilter={null}
        onScopeFilterChange={onScopeFilterChange}
        registrySort="all-time"
        onRegistrySortChange={onRegistrySortChange}
      />,
    );

    expect(screen.getByPlaceholderText('Search skills online...')).toBeTruthy();
    expect(screen.queryByText('All')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Registry' }));
    expect(onPageTabChange).toHaveBeenCalledWith('registry');
  });

  it('registry tab 顯示 sort chips 與 registry placeholder', () => {
    renderWithI18n(
      <SkillToolbar
        search=""
        onSearchChange={onSearchChange}
        pageTab="registry"
        onPageTabChange={onPageTabChange}
        scopeFilter={null}
        onScopeFilterChange={onScopeFilterChange}
        registrySort="all-time"
        onRegistrySortChange={onRegistrySortChange}
      />,
    );

    expect(screen.getByPlaceholderText('Search registry...')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Trending' }));
    expect(onRegistrySortChange).toHaveBeenCalledWith('trending');
  });
});
