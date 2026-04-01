import React from 'react';
import { SOURCE_FORMAT_FILTERS } from './filterUtils';
import type { SourceFormatFilter } from './filterUtils';
import { useI18n } from '../../i18n/I18nContext';
import { MultiSelectDropdown } from '../../components/MultiSelectDropdown';

interface SourceFormatDropdownProps {
  sourceFormatFilters: ReadonlySet<SourceFormatFilter>;
  onToggle: (type: SourceFormatFilter) => void;
}

export function SourceFormatDropdown({
  sourceFormatFilters,
  onToggle,
}: SourceFormatDropdownProps): React.ReactElement {
  const { t } = useI18n();

  const SOURCE_FORMAT_LABELS: Record<SourceFormatFilter, string> = {
    'local-internal': t('filter.source.localInternal'),
    'local-external': t('filter.source.localExternal'),
    'url': t('filter.source.url'),
    'url-subdir': t('filter.source.urlSubdir'),
    'git-subdir': t('filter.source.gitSubdir'),
    'github': t('filter.source.github'),
  };

  const options = SOURCE_FORMAT_FILTERS.map((type) => ({
    value: type,
    label: SOURCE_FORMAT_LABELS[type],
  }));

  return (
    <MultiSelectDropdown
      label={t('filter.source.label')}
      options={options}
      selected={sourceFormatFilters}
      onToggle={(value) => onToggle(value as SourceFormatFilter)}
    />
  );
}
