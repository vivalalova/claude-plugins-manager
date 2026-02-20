import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebounce';
import type { MergedPlugin } from '../../../../shared/types';
import {
  matchesContentType,
  matchesSearch,
  isPluginEnabled,
  PLUGIN_SEARCH_KEY,
  PLUGIN_FILTER_ENABLED_KEY,
  readContentTypeFilters,
  writeContentTypeFilters,
  type ContentTypeFilter,
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
  /** 手動展開的 marketplace set */
  expanded: Set<string>;
  /** 設定展開狀態 */
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** 過濾後按 marketplace 分組的 plugin 列表 */
  grouped: Map<string, MergedPlugin[]>;
}

/**
 * Plugin 過濾與分組 hook。
 * 管理搜尋、篩選、展開狀態，並產生分組後的 plugin 列表。
 *
 * @param plugins - 完整 plugin 列表
 */
export function usePluginFilters(plugins: MergedPlugin[]): UsePluginFiltersReturn {
  const [search, setSearch] = useState(() => localStorage.getItem(PLUGIN_SEARCH_KEY) ?? '');
  const [debouncedSearch, flushSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [filterEnabled, setFilterEnabled] = useState(
    () => localStorage.getItem(PLUGIN_FILTER_ENABLED_KEY) === 'true',
  );
  const [contentTypeFilters, setContentTypeFilters] = useState<Set<ContentTypeFilter>>(readContentTypeFilters);
  // 預設收合，使用者手動展開的 marketplace 加入此 set
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filter 狀態持久化 → localStorage（用 debouncedSearch 避免每次 keystroke 都寫入）
  useEffect(() => { localStorage.setItem(PLUGIN_SEARCH_KEY, debouncedSearch); }, [debouncedSearch]);
  useEffect(() => { localStorage.setItem(PLUGIN_FILTER_ENABLED_KEY, String(filterEnabled)); }, [filterEnabled]);
  useEffect(() => { writeContentTypeFilters(contentTypeFilters); }, [contentTypeFilters]);

  /** 過濾 + 按 marketplace 分組 */
  const grouped = useMemo(() => {
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

    const groups = new Map<string, MergedPlugin[]>();
    for (const p of filtered) {
      const key = p.marketplaceName ?? 'other';
      const arr = groups.get(key);
      if (arr) {
        arr.push(p);
      } else {
        groups.set(key, [p]);
      }
    }
    return groups;
  }, [plugins, debouncedSearch, filterEnabled, contentTypeFilters]);

  return {
    search,
    setSearch,
    debouncedSearch,
    flushSearch,
    filterEnabled,
    setFilterEnabled,
    contentTypeFilters,
    setContentTypeFilters,
    expanded,
    setExpanded,
    grouped,
  };
}
