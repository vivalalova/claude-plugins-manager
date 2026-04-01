import React from 'react';
import { CONTENT_TYPE_FILTERS } from './filterUtils';
import type { ContentTypeFilter } from './filterUtils';
import { useI18n } from '../../i18n/I18nContext';
import { MultiSelectDropdown } from '../../components/MultiSelectDropdown';

interface ContentTypeDropdownProps {
  contentTypeFilters: ReadonlySet<ContentTypeFilter>;
  onToggle: (type: ContentTypeFilter) => void;
}

export function ContentTypeDropdown({
  contentTypeFilters,
  onToggle,
}: ContentTypeDropdownProps): React.ReactElement {
  const { t } = useI18n();

  const CONTENT_TYPE_LABELS: Record<ContentTypeFilter, string> = {
    commands: t('filter.commands'),
    skills: t('filter.skills'),
    agents: t('filter.agents'),
    mcp: t('filter.mcp'),
  };

  const options = CONTENT_TYPE_FILTERS.map((type) => ({
    value: type,
    label: CONTENT_TYPE_LABELS[type],
  }));

  return (
    <MultiSelectDropdown
      label={t('filter.contentType.label')}
      options={options}
      selected={contentTypeFilters}
      onToggle={(value) => onToggle(value as ContentTypeFilter)}
    />
  );
}
