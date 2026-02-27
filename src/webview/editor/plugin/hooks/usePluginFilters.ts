import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebounce';
import type { MergedPlugin } from '../../../../shared/types';
import { getViewState, setViewState } from '../../../vscode';
import {
  matchesContentType,
  matchesSearch,
  isPluginEnabled,
  getPluginComparator,
  PLUGIN_SEARCH_KEY,
  PLUGIN_FILTER_ENABLED_KEY,
  readContentTypeFilters,
  writeContentTypeFilters,
  readPluginSort,
  writePluginSort,
  readExpandedSections,
  writeExpandedSections,
  readSection2Marketplaces,
  writeSection2Marketplaces,
  type ContentTypeFilter,
  type PluginSortBy,
} from '../filterUtils';

/** 搜尋欄位 debounce 延遲（ms） */
const SEARCH_DEBOUNCE_MS = 300;

/** usePluginFilters 回傳值 */
export interface UsePluginFiltersReturn {
  /** 搜尋框即時值 */
  search: string;
  /** 設定搜尋框值 */
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  /** debounce 後的搜尋值（用於過濾） */
  debouncedSearch: string;
  /** 立即套用搜尋值（清除時用） */
  flushSearch: (val: string) => void;
  /** 是否只顯示已啟用 */
  filterEnabled: boolean;
  /** 切換 filterEnabled */
  setFilterEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  /** 選取中的 content type 過濾條件 */
  contentTypeFilters: Set<ContentTypeFilter>;
  /** 設定 content type 過濾條件 */
  setContentTypeFilters: React.Dispatch<React.SetStateAction<Set<ContentTypeFilter>>>;
  /** 當前排序方式 */
  sortBy: PluginSortBy;
  /** 設定排序方式 */
  setSortBy: React.Dispatch<React.SetStateAction<PluginSortBy>>;
  /** 手動展開的 marketplace set */
  expanded: Set<string>;
  /** 設定展開狀態 */
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Section 1：未釘選的 marketplace 分組 */
  grouped1: Map<string, MergedPlugin[]>;
  /** Section 2：已釘選的 marketplace 分組 */
  grouped2: Map<string, MergedPlugin[]>;
  /** 已釘選到 Section 2 的 marketplace 名稱集合 */
  section2Marketplaces: Set<string>;
  /** 將 marketplace 移到 Section 2 */
  moveToSection2: (marketplace: string) => void;
  /** 將 marketplace 移回 Section 1 */
  moveToSection1: (marketplace: string) => void;
}

/**
 * Plugin 過濾與分組 hook。
 * 管理搜尋、篩選、展開狀態，並產生分組後的 plugin 列表。
 *
 * @param plugins - 完整 plugin 列表
 */
export function usePluginFilters(plugins: MergedPlugin[]): UsePluginFiltersReturn {
  const [search, setSearch] = useState(() => getViewState(PLUGIN_SEARCH_KEY, ''));
  const [debouncedSearch, flushSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [filterEnabled, setFilterEnabled] = useState(
    () => getViewState(PLUGIN_FILTER_ENABLED_KEY, false),
  );
  const [contentTypeFilters, setContentTypeFilters] = useState<Set<ContentTypeFilter>>(readContentTypeFilters);
  const [sortBy, setSortBy] = useState<PluginSortBy>(readPluginSort);
  const [expanded, setExpanded] = useState<Set<string>>(readExpandedSections);
  const [section2Marketplaces, setSection2Marketplaces] = useState<Set<string>>(readSection2Marketplaces);

  // Filter 狀態持久化 → VSCode viewState（用 debouncedSearch 避免每次 keystroke 都寫入）
  useEffect(() => { setViewState(PLUGIN_SEARCH_KEY, debouncedSearch); }, [debouncedSearch]);
  useEffect(() => { setViewState(PLUGIN_FILTER_ENABLED_KEY, filterEnabled); }, [filterEnabled]);
  useEffect(() => { writeContentTypeFilters(contentTypeFilters); }, [contentTypeFilters]);
  useEffect(() => { writePluginSort(sortBy); }, [sortBy]);
  useEffect(() => { writeExpandedSections(expanded); }, [expanded]);
  useEffect(() => { writeSection2Marketplaces(section2Marketplaces); }, [section2Marketplaces]);

  /** 過濾 + 按 marketplace 分組成兩個 section */
  const { grouped1, grouped2 } = useMemo(() => {
    let filtered = debouncedSearch
      ? plugins.filter((p) => matchesSearch(p, debouncedSearch))
      : plugins;

    if (filterEnabled) {
      filtered = filtered.filter(isPluginEnabled);
    }

    // Content type filter（OR 邏輯）：未載入 contents 的 plugin 保守顯示
    if (contentTypeFilters.size > 0) {
      filtered = filtered.filter((p) => matchesContentType(p, contentTypeFilters));
    }

    const g1 = new Map<string, MergedPlugin[]>();
    const g2 = new Map<string, MergedPlugin[]>();
    for (const p of filtered) {
      const key = p.marketplaceName ?? 'other';
      const target = section2Marketplaces.has(key) ? g2 : g1;
      const arr = target.get(key);
      if (arr) {
        arr.push(p);
      } else {
        target.set(key, [p]);
      }
    }

    const comparator = getPluginComparator(sortBy);
    for (const items of g1.values()) items.sort(comparator);
    for (const items of g2.values()) items.sort(comparator);

    return { grouped1: g1, grouped2: g2 };
  }, [plugins, debouncedSearch, filterEnabled, contentTypeFilters, sortBy, section2Marketplaces]);

  const moveToSection2 = (marketplace: string) => {
    setSection2Marketplaces((prev) => new Set([...prev, marketplace]));
  };

  const moveToSection1 = (marketplace: string) => {
    setSection2Marketplaces((prev) => {
      const next = new Set(prev);
      next.delete(marketplace);
      return next;
    });
  };

  return {
    search,
    setSearch,
    debouncedSearch,
    flushSearch,
    filterEnabled,
    setFilterEnabled,
    contentTypeFilters,
    setContentTypeFilters,
    sortBy,
    setSortBy,
    expanded,
    setExpanded,
    grouped1,
    grouped2,
    section2Marketplaces,
    moveToSection2,
    moveToSection1,
  };
}
