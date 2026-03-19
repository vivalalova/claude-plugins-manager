import React from 'react';
import type { SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

type SearchMode = 'local' | 'online';

interface SkillToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
  scopeFilter: SkillScope | null;
  onScopeFilterChange: (scope: SkillScope | null) => void;
  onAddClick: () => void;
}

const SCOPE_OPTIONS: Array<{ value: SkillScope | null; labelKey: string }> = [
  { value: null, labelKey: 'skill.page.scopeAll' },
  { value: 'global', labelKey: 'skill.add.scopeGlobal' },
  { value: 'project', labelKey: 'skill.add.scopeProject' },
];

const MODE_OPTIONS: Array<{ value: SearchMode; labelKey: string }> = [
  { value: 'local', labelKey: 'skill.search.modeLocal' },
  { value: 'online', labelKey: 'skill.search.modeOnline' },
];

/** Skills toolbar — search mode toggle + search + scope filter / add button */
export function SkillToolbar({
  search,
  onSearchChange,
  searchMode,
  onSearchModeChange,
  scopeFilter,
  onScopeFilterChange,
  onAddClick,
}: SkillToolbarProps): React.ReactElement {
  const { t } = useI18n();

  const placeholder = searchMode === 'online'
    ? t('skill.search.placeholder')
    : t('skill.page.searchPlaceholder');

  return (
    <div className="search-row">
      <div className="filter-chips">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`filter-chip${searchMode === opt.value ? ' filter-chip--active' : ''}`}
            onClick={() => onSearchModeChange(opt.value)}
          >
            {t(opt.labelKey as 'skill.search.modeLocal')}
          </button>
        ))}
      </div>
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
            ×
          </button>
        )}
      </div>
      {searchMode === 'local' && (
        <>
          <div className="filter-chips">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value ?? 'all'}
                className={`filter-chip${scopeFilter === opt.value ? ' filter-chip--active' : ''}`}
                onClick={() => onScopeFilterChange(opt.value)}
              >
                {t(opt.labelKey as 'skill.page.scopeAll')}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={onAddClick}>
            {t('skill.page.add')}
          </button>
        </>
      )}
    </div>
  );
}
