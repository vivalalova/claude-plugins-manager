import React from 'react';
import type { SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

interface SkillToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  scopeFilter: SkillScope | null;
  onScopeFilterChange: (scope: SkillScope | null) => void;
  onAddClick: () => void;
}

const SCOPE_OPTIONS: Array<{ value: SkillScope | null; labelKey: string }> = [
  { value: null, labelKey: 'skill.page.scopeAll' },
  { value: 'global', labelKey: 'skill.add.scopeGlobal' },
  { value: 'project', labelKey: 'skill.add.scopeProject' },
];

/** Skills toolbar — search + scope filter + add button */
export function SkillToolbar({
  search,
  onSearchChange,
  scopeFilter,
  onScopeFilterChange,
  onAddClick,
}: SkillToolbarProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="search-row">
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-bar"
          placeholder={t('skill.page.searchPlaceholder')}
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
    </div>
  );
}
