import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ContentTypeFilter, SourceFormatFilter } from './filterUtils';
import { TRANSLATE_LANGS } from '../../../shared/types';
import { SearchInput } from '../../components/SearchInput';
import { FilterChips } from '../../components/FilterChips';
import { ContentTypeDropdown } from './ContentTypeDropdown';
import { SourceFormatDropdown } from './SourceFormatDropdown';

type SortBy = 'name' | 'lastUpdated';

export interface PluginToolbarProps {
  // Search
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;

  // Translate button
  translateLang: string | null;
  queuedTextsSize: number;
  activeTextsSize: number;
  onTranslateOpen: () => void;

  // Filter chips
  filterEnabled: boolean;
  onFilterEnabledToggle: () => void;
  showHidden: boolean;
  onShowHiddenToggle: () => void;
  contentTypeFilters: Set<ContentTypeFilter>;
  onContentTypeFilterToggle: (type: ContentTypeFilter) => void;
  sourceFormatFilters: Set<SourceFormatFilter>;
  onSourceFormatFilterToggle: (type: SourceFormatFilter) => void;

  // Sort
  sortBy: SortBy;
  onSortByChange: (value: SortBy) => void;
}

export function PluginToolbar({
  searchInputRef,
  search,
  onSearchChange,
  onSearchClear,
  translateLang,
  queuedTextsSize,
  activeTextsSize,
  onTranslateOpen,
  filterEnabled,
  onFilterEnabledToggle,
  showHidden,
  onShowHiddenToggle,
  contentTypeFilters,
  onContentTypeFilterToggle,
  sourceFormatFilters,
  onSourceFormatFilterToggle,
  sortBy,
  onSortByChange,
}: PluginToolbarProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <>
      <SearchInput
        inputRef={searchInputRef}
        value={search}
        onChange={onSearchChange}
        onClear={onSearchClear}
        placeholder={t('plugin.page.searchPlaceholder')}
        ariaLabel={t('plugin.page.searchPlaceholder')}
        clearAriaLabel={t('plugin.page.clearSearch')}
      >
        <button
          className="btn btn-secondary translate-btn"
          onClick={onTranslateOpen}
          disabled={queuedTextsSize > 0 || activeTextsSize > 0}
        >
          {translateLang ? TRANSLATE_LANGS[translateLang] ?? translateLang : t('plugin.page.translate')}
        </button>
      </SearchInput>

      <div className="filter-toolbar">
        <FilterChips
          groups={[
            [
              { key: 'enabled', label: t('plugin.page.filterEnabled'), active: filterEnabled, onSelect: onFilterEnabledToggle },
              { key: 'hidden', label: t('plugin.page.showHidden'), active: showHidden, onSelect: onShowHiddenToggle },
            ],
          ]}
        />
        <ContentTypeDropdown
          contentTypeFilters={contentTypeFilters}
          onToggle={onContentTypeFilterToggle}
        />
        <SourceFormatDropdown
          sourceFormatFilters={sourceFormatFilters}
          onToggle={onSourceFormatFilterToggle}
        />
        <div className="sort-select-wrapper">
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortBy)}
            aria-label={t('filter.sortBy')}
          >
            <option value="name">{t('filter.sortName')}</option>
            <option value="lastUpdated">{t('filter.sortLastUpdated')}</option>
          </select>
        </div>
      </div>
    </>
  );
}
