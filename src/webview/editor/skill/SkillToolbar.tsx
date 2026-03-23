import React from 'react';
import type { RegistrySort, SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';
import { SearchInput } from '../../components/SearchInput';
import { FilterChips, type ChipDescriptor } from '../../components/FilterChips';

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

  const chipGroups: ChipDescriptor[][] = [
    TAB_OPTIONS.map((opt) => ({
      key: opt.value,
      label: t(opt.labelKey as 'skill.tab.installed'),
      active: pageTab === opt.value,
      onSelect: () => onPageTabChange(opt.value),
    })),
  ];
  if (pageTab === 'installed') {
    chipGroups.push(
      SCOPE_OPTIONS.map((opt) => ({
        key: opt.value ?? 'all',
        label: t(opt.labelKey as 'skill.page.scopeAll'),
        active: scopeFilter === opt.value,
        onSelect: () => onScopeFilterChange(opt.value),
      })),
    );
  }
  if (pageTab === 'registry') {
    chipGroups.push(
      SORT_OPTIONS.map((opt) => ({
        key: opt.value,
        label: t(opt.labelKey as 'skill.registry.allTime'),
        active: registrySort === opt.value,
        onSelect: () => onRegistrySortChange(opt.value),
      })),
    );
  }

  return (
    <>
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={placeholder}
        clearAriaLabel={t('skill.page.clearSearch')}
      />

      <FilterChips groups={chipGroups} />
    </>
  );
}
