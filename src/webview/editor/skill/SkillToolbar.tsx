import React from 'react';
import type { RegistrySort, SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

export type PageTab = 'installed' | 'online' | 'registry';

interface SkillToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  pageTab: PageTab;
  onPageTabChange: (tab: PageTab) => void;
  scopeFilter: SkillScope | null;
  onScopeFilterChange: (scope: SkillScope | null) => void;
  registrySort: RegistrySort;
  onRegistrySortChange: (sort: RegistrySort) => void;
}

const SCOPE_OPTIONS: Array<{ value: SkillScope | null; labelKey: string }> = [
  { value: null, labelKey: 'skill.page.scopeAll' },
  { value: 'global', labelKey: 'skill.add.scopeGlobal' },
  { value: 'project', labelKey: 'skill.add.scopeProject' },
];

const TAB_OPTIONS: Array<{ value: PageTab; labelKey: string }> = [
  { value: 'installed', labelKey: 'skill.tab.installed' },
  { value: 'online', labelKey: 'skill.search.modeOnline' },
  { value: 'registry', labelKey: 'skill.tab.registry' },
];

const SORT_OPTIONS: Array<{ value: RegistrySort; labelKey: string }> = [
  { value: 'all-time', labelKey: 'skill.registry.allTime' },
  { value: 'trending', labelKey: 'skill.registry.trending' },
  { value: 'hot', labelKey: 'skill.registry.hot' },
];

/** Skills toolbar — two-row layout matching PluginToolbar */
export function SkillToolbar({
  search,
  onSearchChange,
  pageTab,
  onPageTabChange,
  scopeFilter,
  onScopeFilterChange,
  registrySort,
  onRegistrySortChange,
}: SkillToolbarProps): React.ReactElement {
  const { t } = useI18n();

  const placeholder = pageTab === 'online'
    ? t('skill.search.placeholder')
    : pageTab === 'registry'
      ? t('skill.registry.searchPlaceholder')
      : t('skill.page.searchPlaceholder');

  return (
    <>
      <div className="search-row">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-bar"
            placeholder={placeholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <button
              className="search-clear-btn"
              onClick={() => onSearchChange('')}
              title={t('skill.page.clearSearch')}
              aria-label={t('skill.page.clearSearch')}
            >
              &#x2715;
            </button>
          )}
        </div>
      </div>

      <div className="filter-chips">
        {TAB_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`filter-chip${pageTab === opt.value ? ' filter-chip--active' : ''}`}
            onClick={() => onPageTabChange(opt.value)}
          >
            {t(opt.labelKey as 'skill.tab.installed')}
          </button>
        ))}
        {pageTab === 'installed' && (
          <>
            <span className="filter-separator" aria-hidden="true" />
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value ?? 'all'}
                className={`filter-chip${scopeFilter === opt.value ? ' filter-chip--active' : ''}`}
                onClick={() => onScopeFilterChange(opt.value)}
              >
                {t(opt.labelKey as 'skill.page.scopeAll')}
              </button>
            ))}
          </>
        )}
        {pageTab === 'registry' && (
          <>
            <span className="filter-separator" aria-hidden="true" />
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`filter-chip${registrySort === opt.value ? ' filter-chip--active' : ''}`}
                onClick={() => onRegistrySortChange(opt.value)}
              >
                {t(opt.labelKey as 'skill.registry.allTime')}
              </button>
            ))}
          </>
        )}
      </div>
    </>
  );
}
