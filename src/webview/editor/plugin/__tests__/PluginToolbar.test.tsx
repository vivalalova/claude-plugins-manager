/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';

vi.mock('../../../vscode', () => ({ vscode: { postMessage: vi.fn() } }));

import { PluginToolbar } from '../PluginToolbar';
import type { PluginToolbarProps } from '../PluginToolbar';
import type { ContentTypeFilter } from '../filterUtils';
import { CONTENT_TYPE_FILTERS } from '../filterUtils';

function buildProps(overrides: Partial<PluginToolbarProps> = {}): PluginToolbarProps {
  return {
    searchInputRef: React.createRef<HTMLInputElement>(),
    search: '',
    onSearchChange: vi.fn(),
    onSearchClear: vi.fn(),
    translateLang: null,
    queuedTextsSize: 0,
    activeTextsSize: 0,
    onTranslateOpen: vi.fn(),
    filterEnabled: false,
    onFilterEnabledToggle: vi.fn(),
    showHidden: false,
    onShowHiddenToggle: vi.fn(),
    contentTypeFilters: new Set<ContentTypeFilter>(),
    onContentTypeFilterToggle: vi.fn(),
    sortBy: 'name',
    onSortByChange: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('PluginToolbar', () => {
  describe('搜尋列', () => {
    it('渲染搜尋列與翻譯按鈕', () => {
      renderWithI18n(<PluginToolbar {...buildProps()} />);
      expect(screen.getByPlaceholderText('Search plugins...')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Translate' })).toBeTruthy();
    });

    it('輸入搜尋文字觸發 onSearchChange', () => {
      const onSearchChange = vi.fn();
      renderWithI18n(<PluginToolbar {...buildProps({ onSearchChange })} />);
      fireEvent.change(screen.getByPlaceholderText('Search plugins...'), { target: { value: 'hello' } });
      expect(onSearchChange).toHaveBeenCalledWith('hello');
    });

    it('有搜尋文字時顯示清除按鈕', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ search: 'abc' })} />);
      expect(screen.getByLabelText('Clear search')).toBeTruthy();
    });

    it('無搜尋文字時不顯示清除按鈕', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ search: '' })} />);
      expect(screen.queryByLabelText('Clear search')).toBeNull();
    });

    it('點擊清除按鈕觸發 onSearchClear', () => {
      const onSearchClear = vi.fn();
      renderWithI18n(<PluginToolbar {...buildProps({ search: 'abc', onSearchClear })} />);
      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(onSearchClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('翻譯按鈕', () => {
    it('翻譯進行中（queued > 0）時翻譯按鈕 disabled', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ queuedTextsSize: 3 })} />);
      const btn = screen.getByRole('button', { name: 'Translate' }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('翻譯進行中（active > 0）時翻譯按鈕 disabled', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ activeTextsSize: 1 })} />);
      const btn = screen.getByRole('button', { name: 'Translate' }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('有 translateLang 時顯示語言名稱', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ translateLang: 'zh-TW' })} />);
      expect(screen.getByRole('button', { name: '繁體中文' })).toBeTruthy();
    });

    it('無 translateLang 時顯示預設翻譯文字', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ translateLang: null })} />);
      expect(screen.getByRole('button', { name: 'Translate' })).toBeTruthy();
    });

    it('翻譯空閒時按鈕可用，點擊觸發 onTranslateOpen', () => {
      const onTranslateOpen = vi.fn();
      renderWithI18n(<PluginToolbar {...buildProps({ onTranslateOpen })} />);
      const btn = screen.getByRole('button', { name: 'Translate' }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      fireEvent.click(btn);
      expect(onTranslateOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('filter chip', () => {
    it('點擊 Enabled filter chip 觸發 onFilterEnabledToggle', () => {
      const onFilterEnabledToggle = vi.fn();
      renderWithI18n(<PluginToolbar {...buildProps({ onFilterEnabledToggle })} />);
      fireEvent.click(screen.getByText('Enabled'));
      expect(onFilterEnabledToggle).toHaveBeenCalledTimes(1);
    });

    it('點擊 Show Hidden filter chip 觸發 onShowHiddenToggle', () => {
      const onShowHiddenToggle = vi.fn();
      renderWithI18n(<PluginToolbar {...buildProps({ onShowHiddenToggle })} />);
      fireEvent.click(screen.getByText('Show hidden'));
      expect(onShowHiddenToggle).toHaveBeenCalledTimes(1);
    });

    it('active filter chip 有 filter-chip--active class', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ filterEnabled: true, showHidden: true })} />);
      expect(screen.getByText('Enabled').className).toContain('filter-chip--active');
      expect(screen.getByText('Show hidden').className).toContain('filter-chip--active');
    });

    it('inactive filter chip 無 filter-chip--active class', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ filterEnabled: false, showHidden: false })} />);
      expect(screen.getByText('Enabled').className).not.toContain('filter-chip--active');
      expect(screen.getByText('Show hidden').className).not.toContain('filter-chip--active');
    });
  });

  describe('content type filter chips', () => {
    it('點擊 content type filter chip 觸發 onContentTypeFilterToggle 帶對應 type', () => {
      const onContentTypeFilterToggle = vi.fn();
      renderWithI18n(<PluginToolbar {...buildProps({ onContentTypeFilterToggle })} />);

      fireEvent.click(screen.getByText('Commands'));
      expect(onContentTypeFilterToggle).toHaveBeenCalledWith('commands');

      fireEvent.click(screen.getByText('Skills'));
      expect(onContentTypeFilterToggle).toHaveBeenCalledWith('skills');

      fireEvent.click(screen.getByText('Agents'));
      expect(onContentTypeFilterToggle).toHaveBeenCalledWith('agents');

      fireEvent.click(screen.getByText('MCP'));
      expect(onContentTypeFilterToggle).toHaveBeenCalledWith('mcp');
    });

    it('active content type chip 有 filter-chip--active class', () => {
      const active = new Set<ContentTypeFilter>(CONTENT_TYPE_FILTERS);
      renderWithI18n(<PluginToolbar {...buildProps({ contentTypeFilters: active })} />);

      expect(screen.getByText('Commands').className).toContain('filter-chip--active');
      expect(screen.getByText('Skills').className).toContain('filter-chip--active');
      expect(screen.getByText('Agents').className).toContain('filter-chip--active');
      expect(screen.getByText('MCP').className).toContain('filter-chip--active');
    });

    it('inactive content type chip 無 filter-chip--active class', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ contentTypeFilters: new Set() })} />);

      expect(screen.getByText('Commands').className).not.toContain('filter-chip--active');
      expect(screen.getByText('Skills').className).not.toContain('filter-chip--active');
    });
  });

  describe('排序 chip', () => {
    it('點擊 sort chip 觸發 onSortByChange 帶對應值', () => {
      const onSortByChange = vi.fn();
      renderWithI18n(<PluginToolbar {...buildProps({ sortBy: 'name', onSortByChange })} />);

      fireEvent.click(screen.getByText('Last Updated'));
      expect(onSortByChange).toHaveBeenCalledWith('lastUpdated');

      fireEvent.click(screen.getByText('Name'));
      expect(onSortByChange).toHaveBeenCalledWith('name');
    });

    it('active sort chip 有 aria-pressed="true"', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ sortBy: 'name' })} />);
      const nameChip = screen.getByText('Name');
      const lastUpdatedChip = screen.getByText('Last Updated');
      expect(nameChip.getAttribute('aria-pressed')).toBe('true');
      expect(lastUpdatedChip.getAttribute('aria-pressed')).toBe('false');
    });

    it('sortBy=lastUpdated 時 Last Updated chip aria-pressed="true"', () => {
      renderWithI18n(<PluginToolbar {...buildProps({ sortBy: 'lastUpdated' })} />);
      expect(screen.getByText('Last Updated').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByText('Name').getAttribute('aria-pressed')).toBe('false');
    });
  });
});
