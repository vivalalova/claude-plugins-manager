import React from 'react';
import { useI18n } from '../../../i18n/I18nContext';

export interface GridFilterProps {
  filterText: string;
  onFilterChange: (text: string) => void;
  showMode: 'all' | 'customized';
  onShowModeChange: (mode: 'all' | 'customized') => void;
}

export function GridFilter({
  filterText,
  onFilterChange,
  showMode,
  onShowModeChange,
}: GridFilterProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="sg-filter-bar">
      <div className="sg-filter-search-wrap">
        <input
          className="sg-filter-input"
          type="text"
          placeholder={t('settings.grid.filter.placeholder')}
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
          aria-label={t('settings.grid.filter.placeholder')}
        />
        {filterText && (
          <button
            className="sg-filter-clear-btn"
            onClick={() => onFilterChange('')}
            aria-label="Clear filter"
          >
            ×
          </button>
        )}
      </div>
      <div className="sg-filter-chips">
        <button
          className={`sg-filter-chip${showMode === 'all' ? ' sg-filter-chip--active' : ''}`}
          onClick={() => onShowModeChange('all')}
        >
          {t('settings.grid.filter.all')}
        </button>
        <button
          className={`sg-filter-chip${showMode === 'customized' ? ' sg-filter-chip--active' : ''}`}
          onClick={() => onShowModeChange('customized')}
        >
          {t('settings.grid.filter.customized')}
        </button>
      </div>
    </div>
  );
}
