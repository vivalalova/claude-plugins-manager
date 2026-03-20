import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { CONTENT_TYPE_FILTERS } from './filterUtils';
import type { ContentTypeFilter } from './filterUtils';
import { TRANSLATE_LANGS } from '../../../shared/types';

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
      <div className="search-row">
        <div className="search-input-wrapper">
          <input
            ref={searchInputRef}
            className="input search-bar"
            type="text"
            placeholder={t('plugin.page.searchPlaceholder')}
            aria-label={t('plugin.page.searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              aria-label={t('plugin.page.clearSearch')}
              onClick={onSearchClear}
            >
              &#x2715;
            </button>
          )}
        </div>
        <button
          className="btn btn-secondary translate-btn"
          onClick={onTranslateOpen}
          disabled={queuedTextsSize > 0 || activeTextsSize > 0}
        >
          {translateLang ? TRANSLATE_LANGS[translateLang] ?? translateLang : t('plugin.page.translate')}
        </button>
      </div>

      <div className="filter-chips">
        <button
          className={`filter-chip${filterEnabled ? ' filter-chip--active' : ''}`}
          onClick={onFilterEnabledToggle}
        >
          {t('plugin.page.filterEnabled')}
        </button>
        <button
          className={`filter-chip${showHidden ? ' filter-chip--active' : ''}`}
          onClick={onShowHiddenToggle}
        >
          {t('plugin.page.showHidden')}
        </button>
        {CONTENT_TYPE_FILTERS.map((type) => (
          <button
            key={type}
            className={`filter-chip${contentTypeFilters.has(type) ? ' filter-chip--active' : ''}`}
            onClick={() => onContentTypeFilterToggle(type)}
          >
            {CONTENT_TYPE_LABELS[type]}
          </button>
        ))}
        <span className="filter-separator" aria-hidden="true" />
        {PLUGIN_SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`filter-chip${sortBy === opt.value ? ' filter-chip--active' : ''}`}
            aria-pressed={sortBy === opt.value}
            onClick={() => onSortByChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
