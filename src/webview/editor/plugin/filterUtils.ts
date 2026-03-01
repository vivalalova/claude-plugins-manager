import type { MergedPlugin, PluginScope } from '../../../shared/types';
import { getViewState, setViewState, setGlobalState } from '../../vscode';

/** Plugin 是否已安裝（任一 scope） */
export function isPluginInstalled(p: MergedPlugin): boolean {
  return !!(p.userInstall || p.projectInstalls.length > 0 || p.localInstall);
}

/** Plugin 是否在任一 scope 啟用（checkbox 已勾） */
export function isPluginEnabled(p: MergedPlugin): boolean {
  return !!(
    p.userInstall?.enabled
    || p.projectInstalls.some((i) => i.enabled)
    || p.localInstall?.enabled
  );
}

/** 取得 plugin 已安裝的 scope 列表 */
export function getInstalledScopes(p: MergedPlugin): PluginScope[] {
  const scopes: PluginScope[] = [];
  if (p.userInstall) scopes.push('user');
  if (p.projectInstalls.length > 0) scopes.push('project');
  if (p.localInstall) scopes.push('local');
  return scopes;
}

/** 取得 plugin 已啟用的 scope 列表 */
export function getEnabledScopes(p: MergedPlugin): PluginScope[] {
  const scopes: PluginScope[] = [];
  if (p.userInstall?.enabled) scopes.push('user');
  if (p.projectInstalls.some((i) => i.enabled)) scopes.push('project');
  if (p.localInstall?.enabled) scopes.push('local');
  return scopes;
}

/** Plugin 是否在指定 scope 啟用 */
export function isEnabledInScope(p: MergedPlugin, scope: PluginScope): boolean {
  switch (scope) {
    case 'user': return !!p.userInstall?.enabled;
    case 'project': return p.projectInstalls.some((i) => i.enabled);
    case 'local': return !!p.localInstall?.enabled;
  }
}

/** Plugin 是否在指定 scope 已安裝 */
export function isInstalledInScope(p: MergedPlugin, scope: PluginScope): boolean {
  switch (scope) {
    case 'user': return !!p.userInstall;
    case 'project': return p.projectInstalls.length > 0;
    case 'local': return !!p.localInstall;
  }
}

/**
 * 判斷 plugin 是否有可用更新。
 * 比較 availableLastUpdated 與所有已安裝 scope 的最新 lastUpdated。
 * 未安裝或無 availableLastUpdated 時回傳 false。
 */
export function hasPluginUpdate(p: MergedPlugin): boolean {
  if (!p.availableLastUpdated) return false;
  const installedDates = [
    p.userInstall?.lastUpdated,
    ...p.projectInstalls.map((i) => i.lastUpdated),
    p.localInstall?.lastUpdated,
  ].filter(Boolean) as string[];
  if (installedDates.length === 0) return false;
  const latestInstalledMs = installedDates
    .map((d) => new Date(d).getTime())
    .reduce((a, b) => Math.max(a, b));
  return new Date(p.availableLastUpdated).getTime() > latestInstalledMs;
}

/** 所有可用的 content type filter chips */
export const CONTENT_TYPE_FILTERS = ['commands', 'skills', 'agents', 'mcp'] as const;

/** Content type filter 可選值（從常數推導） */
export type ContentTypeFilter = typeof CONTENT_TYPE_FILTERS[number];


/**
 * 判斷 plugin 是否符合 content type filter（OR 邏輯）。
 * 無 contents 的 plugin 保守顯示（回傳 true）。
 * filters 為空時回傳 true（不篩選）。
 * hooks 不列入 filter（spec 僅定義 4 種 chip）。
 */
export function matchesContentType(
  plugin: MergedPlugin,
  filters: ReadonlySet<ContentTypeFilter>,
): boolean {
  if (filters.size === 0) return true;
  if (!plugin.contents) return true;

  for (const type of filters) {
    if (type === 'commands' && plugin.contents.commands.length > 0) return true;
    if (type === 'skills' && plugin.contents.skills.length > 0) return true;
    if (type === 'agents' && plugin.contents.agents.length > 0) return true;
    if (type === 'mcp' && plugin.contents.mcpServers.length > 0) return true;
  }
  return false;
}

/**
 * 搜尋 plugin name/description 以及 contents 內 commands/skills/agents 的 name/description。
 * mcpServers（純 string ID）不列入搜尋。
 * case-insensitive substring match。空 query 回傳 true。
 */
export function matchesSearch(plugin: MergedPlugin, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  if (plugin.name.toLowerCase().includes(q)) return true;
  if (plugin.description?.toLowerCase().includes(q)) return true;

  if (plugin.contents) {
    for (const arr of [plugin.contents.commands, plugin.contents.skills, plugin.contents.agents]) {
      for (const item of arr) {
        if (item.name.toLowerCase().includes(q)) return true;
        if (item.description.toLowerCase().includes(q)) return true;
      }
    }
  }

  return false;
}

/** Plugin 排序方式 */
export type PluginSortBy = 'name' | 'lastUpdated';

/** 按名稱升序（case-insensitive） */
export function compareByName(a: MergedPlugin, b: MergedPlugin): number {
  return a.name.localeCompare(b.name);
}

/** 按最後更新時間降序（新的在前）。無日期或 invalid date 排最後，日期相同 fallback 名稱排序。 */
export function compareByLastUpdated(a: MergedPlugin, b: MergedPlugin): number {
  const aRaw = a.availableLastUpdated ?? a.lastUpdated;
  const bRaw = b.availableLastUpdated ?? b.lastUpdated;
  const aMs = aRaw ? new Date(aRaw).getTime() : NaN;
  const bMs = bRaw ? new Date(bRaw).getTime() : NaN;
  const aValid = !Number.isNaN(aMs);
  const bValid = !Number.isNaN(bMs);
  if (!aValid && !bValid) return a.name.localeCompare(b.name);
  if (!aValid) return 1;
  if (!bValid) return -1;
  const diff = bMs - aMs;
  return diff !== 0 ? diff : a.name.localeCompare(b.name);
}

/** 取得排序比較函數 */
export function getPluginComparator(sortBy: PluginSortBy): (a: MergedPlugin, b: MergedPlugin) => number {
  return sortBy === 'lastUpdated' ? compareByLastUpdated : compareByName;
}

/** VSCode viewState keys for plugin filter persistence */
export const PLUGIN_SEARCH_KEY = 'plugin.search';
export const PLUGIN_FILTER_ENABLED_KEY = 'plugin.filter.enabled';
export const CONTENT_TYPE_STORAGE_KEY = 'plugin.filter.contentTypes';
export const PLUGIN_SORT_KEY = 'plugin.sort';
export const PLUGIN_EXPANDED_KEY = 'plugin.expanded';
export const PLUGIN_HIDDEN_KEY = 'plugin.hidden';
export const PLUGIN_SHOW_HIDDEN_KEY = 'plugin.filter.showHidden';

/**
 * viewState → Set<ContentTypeFilter>。
 * 格式不相容時回傳空 Set。
 */
export function readContentTypeFilters(): Set<ContentTypeFilter> {
  const arr = getViewState<unknown[]>(CONTENT_TYPE_STORAGE_KEY, []);
  if (!Array.isArray(arr)) return new Set();
  const valid = new Set<string>(CONTENT_TYPE_FILTERS);
  return new Set(arr.filter((v): v is ContentTypeFilter => valid.has(v as string)));
}

/** Set<ContentTypeFilter> → viewState + globalState */
export function writeContentTypeFilters(filters: ReadonlySet<ContentTypeFilter>): void {
  const value = [...filters];
  setViewState(CONTENT_TYPE_STORAGE_KEY, value);
  void setGlobalState(CONTENT_TYPE_STORAGE_KEY, value);
}

/** viewState → PluginSortBy。無效值 fallback 'name'。 */
export function readPluginSort(): PluginSortBy {
  const raw = getViewState<string>(PLUGIN_SORT_KEY, 'name');
  return raw === 'lastUpdated' ? 'lastUpdated' : 'name';
}

/** PluginSortBy → viewState + globalState */
export function writePluginSort(sort: PluginSortBy): void {
  setViewState(PLUGIN_SORT_KEY, sort);
  void setGlobalState(PLUGIN_SORT_KEY, sort);
}

/** viewState → Set<string>（展開的 marketplace section） */
export function readExpandedSections(): Set<string> {
  const arr = getViewState<string[]>(PLUGIN_EXPANDED_KEY, []);
  return new Set(Array.isArray(arr) ? arr : []);
}

/** Set<string> → viewState + globalState */
export function writeExpandedSections(expanded: ReadonlySet<string>): void {
  const value = [...expanded];
  setViewState(PLUGIN_EXPANDED_KEY, value);
  void setGlobalState(PLUGIN_EXPANDED_KEY, value);
}

/** marketplace name → section ID（0 = 預設 section） */
export interface SectionAssignments {
  assignments: Record<string, number>;
  nextId: number;
  /** 非零 section 的顯示順序（不含 section 0）；未定義時 fallback ID 升序 */
  sectionOrder?: number[];
  /** section ID → 自訂名稱；未定義時 fallback 預設名稱 */
  sectionNames?: Record<number, string>;
}

/**
 * 取得 section 顯示名稱。
 * 自訂名稱優先；無自訂或空字串時回傳 fallback。
 */
export function getSectionName(
  id: number,
  names: Record<number, string> | undefined,
  fallback: string,
): string {
  const custom = names?.[id];
  return custom && custom.trim() ? custom : fallback;
}

/** viewState key for N-section assignments */
export const PLUGIN_SECTIONS_KEY = 'plugin.sections';
/** old viewState key（migration 用） */
const PLUGIN_SECTION2_KEY = 'plugin.section2';

/**
 * viewState → SectionAssignments。
 * 自動 migrate 舊 plugin.section2 格式（Set → assignments[mp]=1）。
 * 同時修正 nextId 確保大於所有現有 sectionId。
 */
export function readSectionAssignments(): SectionAssignments {
  const data = getViewState<unknown>(PLUGIN_SECTIONS_KEY, null);
  if (
    data !== null
    && typeof data === 'object'
    && !Array.isArray(data)
    && 'assignments' in (data as object)
    && 'nextId' in (data as object)
    && typeof (data as Record<string, unknown>)['nextId'] === 'number'
    && typeof (data as Record<string, unknown>)['assignments'] === 'object'
    && !Array.isArray((data as Record<string, unknown>)['assignments'])
  ) {
    const raw = data as SectionAssignments;
    // 過濾非數字 value，確保 nextId > max existing id
    const validAssignments: Record<string, number> = {};
    let maxId = 0;
    for (const [k, v] of Object.entries(raw.assignments)) {
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
        validAssignments[k] = v;
        if (v > maxId) maxId = v;
      }
    }
    const rawData = raw as unknown as Record<string, unknown>;
    // 驗證 sectionOrder：array of positive integers
    const rawOrder = rawData['sectionOrder'];
    const sectionOrder = Array.isArray(rawOrder)
      ? rawOrder.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0)
      : undefined;
    // 驗證 sectionNames：object，key 為數字字串，value 為 string
    const rawNames = rawData['sectionNames'];
    let sectionNames: Record<number, string> | undefined;
    if (rawNames !== null && typeof rawNames === 'object' && !Array.isArray(rawNames)) {
      const valid: Record<number, string> = {};
      for (const [k, v] of Object.entries(rawNames as Record<string, unknown>)) {
        const id = Number(k);
        if (Number.isInteger(id) && id > 0 && typeof v === 'string') {
          valid[id] = v;
        }
      }
      sectionNames = valid;
    }
    return {
      assignments: validAssignments,
      nextId: Math.max(raw.nextId, maxId + 1),
      ...(sectionOrder !== undefined ? { sectionOrder } : {}),
      ...(sectionNames !== undefined ? { sectionNames } : {}),
    };
  }
  // migration: 讀舊 plugin.section2
  const old = getViewState<unknown[]>(PLUGIN_SECTION2_KEY, []);
  if (Array.isArray(old) && old.length > 0) {
    const assignments: Record<string, number> = {};
    for (const mp of old) {
      if (typeof mp === 'string') assignments[mp] = 1;
    }
    return { assignments, nextId: 2 };
  }
  return { assignments: {}, nextId: 1 };
}

/** SectionAssignments → viewState + globalState */
export function writeSectionAssignments(data: SectionAssignments): void {
  setViewState(PLUGIN_SECTIONS_KEY, data);
  void setGlobalState(PLUGIN_SECTIONS_KEY, data);
}

/** viewState → Set<string>（隱藏的 plugin ID） */
export function readHiddenPlugins(): Set<string> {
  const arr = getViewState<string[]>(PLUGIN_HIDDEN_KEY, []);
  return new Set(Array.isArray(arr) ? arr : []);
}

/** Set<string> → viewState 快取 + 檔案持久化 */
export function writeHiddenPlugins(hidden: ReadonlySet<string>): void {
  const value = [...hidden];
  setViewState(PLUGIN_HIDDEN_KEY, value);
  void setGlobalState(PLUGIN_HIDDEN_KEY, value);
}
