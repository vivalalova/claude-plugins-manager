import type { MergedPlugin } from '../../../shared/types';

/** 所有可用的 content type filter chips */
export const CONTENT_TYPE_FILTERS = ['commands', 'skills', 'agents', 'mcp'] as const;

/** Content type filter 可選值（從常數推導） */
export type ContentTypeFilter = typeof CONTENT_TYPE_FILTERS[number];

/** Filter chip 顯示名稱 */
export const CONTENT_TYPE_LABELS: Record<ContentTypeFilter, string> = {
  commands: 'Commands',
  skills: 'Skills',
  agents: 'Agents',
  mcp: 'MCP',
};

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
