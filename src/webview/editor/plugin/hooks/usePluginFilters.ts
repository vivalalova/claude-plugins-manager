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
  readSectionAssignments,
  writeSectionAssignments,
  type ContentTypeFilter,
  type PluginSortBy,
  type SectionAssignments,
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
  /** N 個 section，section 0 永遠存在；其他 section 依 assignments 動態產生 */
  groupedSections: { id: number; groups: Map<string, MergedPlugin[]> }[];
  /** 將 marketplace 移到指定 section（0 = 回預設） */
  moveToSection: (marketplace: string, sectionId: number) => void;
  /** 新增 section 並將 marketplace 放入 */
  createSection: (marketplace: string) => void;
}

/**
 * Plugin 過濾與分組 hook。
 * 管理搜尋、篩選、展開狀態，並產生動態 N-section 分組列表。
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
  const [sectionAssignments, setSectionAssignments] = useState<SectionAssignments>(readSectionAssignments);

  // Filter 狀態持久化 → VSCode viewState（用 debouncedSearch 避免每次 keystroke 都寫入）
  useEffect(() => { setViewState(PLUGIN_SEARCH_KEY, debouncedSearch); }, [debouncedSearch]);
  useEffect(() => { setViewState(PLUGIN_FILTER_ENABLED_KEY, filterEnabled); }, [filterEnabled]);
  useEffect(() => { writeContentTypeFilters(contentTypeFilters); }, [contentTypeFilters]);
  useEffect(() => { writePluginSort(sortBy); }, [sortBy]);
  useEffect(() => { writeExpandedSections(expanded); }, [expanded]);
  useEffect(() => { writeSectionAssignments(sectionAssignments); }, [sectionAssignments]);

  /** 過濾 + 按 marketplace 分組成 N 個 section */
  const groupedSections = useMemo(() => {
    let filtered = debouncedSearch
      ? plugins.filter((p) => matchesSearch(p, debouncedSearch))
      : plugins;

    if (filterEnabled) {
      filtered = filtered.filter(isPluginEnabled);
    }

    if (contentTypeFilters.size > 0) {
      filtered = filtered.filter((p) => matchesContentType(p, contentTypeFilters));
    }

    const comparator = getPluginComparator(sortBy);
    const { assignments } = sectionAssignments;

    // 收集所有非零 section ID（已有 assignment 的）
    const extraSectionIds = [...new Set(Object.values(assignments))]
      .filter((id) => id !== 0)
      .sort((a, b) => a - b);

    // 為每個 section 建立空 Map
    const sectionMaps = new Map<number, Map<string, MergedPlugin[]>>();
    for (const id of [0, ...extraSectionIds]) {
      sectionMaps.set(id, new Map());
    }

    // 將過濾後的 plugin 分配到對應 section
    for (const p of filtered) {
      const key = p.marketplaceName ?? 'other';
      const sectionId = assignments[key] ?? 0;
      const groups = sectionMaps.get(sectionId) ?? sectionMaps.get(0)!;
      const arr = groups.get(key);
      if (arr) {
        arr.push(p);
      } else {
        groups.set(key, [p]);
      }
    }

    // 非零 section：為已 assigned 但過濾掉的 marketplace 補空陣列
    // 使 section 即使無可見 plugin 仍能渲染 drop zone
    for (const [marketplace, sectionId] of Object.entries(assignments)) {
      if (sectionId === 0) continue;
      const groups = sectionMaps.get(sectionId);
      if (groups && !groups.has(marketplace)) {
        groups.set(marketplace, []);
      }
    }

    // 對每個 section 的 plugin 排序
    for (const groups of sectionMaps.values()) {
      for (const items of groups.values()) {
        if (items.length > 0) items.sort(comparator);
      }
    }

    return [0, ...extraSectionIds].map((id) => ({
      id,
      groups: sectionMaps.get(id)!,
    }));
  }, [plugins, debouncedSearch, filterEnabled, contentTypeFilters, sortBy, sectionAssignments]);

  const moveToSection = (marketplace: string, sectionId: number) => {
    setSectionAssignments((prev) => {
      if (sectionId === 0) {
        // 移回預設：從 assignments 中刪除
        const { [marketplace]: _, ...rest } = prev.assignments;
        return { ...prev, assignments: rest };
      }
      return { ...prev, assignments: { ...prev.assignments, [marketplace]: sectionId } };
    });
  };

  const createSection = (marketplace: string) => {
    setSectionAssignments((prev) => {
      const newId = prev.nextId;
      return {
        assignments: { ...prev.assignments, [marketplace]: newId },
        nextId: newId + 1,
      };
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
    groupedSections,
    moveToSection,
    createSection,
  };
}
