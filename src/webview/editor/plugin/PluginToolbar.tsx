import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { CONTENT_TYPE_FILTERS } from './filterUtils';
import type { ContentTypeFilter } from './filterUtils';
import { TRANSLATE_LANGS } from '../../../shared/types';
import { SearchInput } from '../../components/SearchInput';
import { FilterChips } from '../../components/FilterChips';

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
  sortBy,
  onSortByChange,
}: PluginToolbarProps): React.ReactElement {
  const { t } = useI18n();

  const CONTENT_TYPE_LABELS: Record<ContentTypeFilter, string> = {
    commands: t('filter.commands'),
    skills: t('filter.skills'),
    agents: t('filter.agents'),
    mcp: t('filter.mcp'),
  };

  const PLUGIN_SORT_OPTIONS = [
    { value: 'name' as const, label: t('filter.sortName') },
    { value: 'lastUpdated' as const, label: t('filter.sortLastUpdated') },
  ];

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

      <FilterChips
        groups={[
          [
            { key: 'enabled', label: t('plugin.page.filterEnabled'), active: filterEnabled, onSelect: onFilterEnabledToggle },
            { key: 'hidden', label: t('plugin.page.showHidden'), active: showHidden, onSelect: onShowHiddenToggle },
            ...CONTENT_TYPE_FILTERS.map((type) => ({
              key: type,
              label: CONTENT_TYPE_LABELS[type],
              active: contentTypeFilters.has(type),
              onSelect: () => onContentTypeFilterToggle(type),
            })),
          ],
          PLUGIN_SORT_OPTIONS.map((opt) => ({
            key: opt.value,
            label: opt.label,
            active: sortBy === opt.value,
            ariaPressed: sortBy === opt.value,
            onSelect: () => onSortByChange(opt.value),
          })),
        ]}
      />
    </>
  );
}
