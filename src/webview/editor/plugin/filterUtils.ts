import type { MergedPlugin, PluginScope } from '../../../shared/types';
import { getViewState, setViewState } from '../../vscode';

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

/** Set<ContentTypeFilter> → viewState */
export function writeContentTypeFilters(filters: ReadonlySet<ContentTypeFilter>): void {
  setViewState(CONTENT_TYPE_STORAGE_KEY, [...filters]);
}

/** viewState → PluginSortBy。無效值 fallback 'name'。 */
export function readPluginSort(): PluginSortBy {
  const raw = getViewState<string>(PLUGIN_SORT_KEY, 'name');
  return raw === 'lastUpdated' ? 'lastUpdated' : 'name';
}

/** PluginSortBy → viewState */
export function writePluginSort(sort: PluginSortBy): void {
  setViewState(PLUGIN_SORT_KEY, sort);
}

/** viewState → Set<string>（展開的 marketplace section） */
export function readExpandedSections(): Set<string> {
  const arr = getViewState<string[]>(PLUGIN_EXPANDED_KEY, []);
  return new Set(Array.isArray(arr) ? arr : []);
}

/** Set<string> → viewState */
export function writeExpandedSections(expanded: ReadonlySet<string>): void {
  setViewState(PLUGIN_EXPANDED_KEY, [...expanded]);
}

/** viewState key for section 2 pinned marketplaces */
export const PLUGIN_SECTION2_KEY = 'plugin.section2';

/** viewState → Set<string>（已釘選到 Section 2 的 marketplace） */
export function readSection2Marketplaces(): Set<string> {
  const arr = getViewState<string[]>(PLUGIN_SECTION2_KEY, []);
  return new Set(Array.isArray(arr) ? arr : []);
}

/** Set<string> → viewState */
export function writeSection2Marketplaces(section2: ReadonlySet<string>): void {
  setViewState(PLUGIN_SECTION2_KEY, [...section2]);
}
