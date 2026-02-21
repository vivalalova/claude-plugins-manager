import type { MergedPlugin } from '../../../shared/types';

export type ResourceType = 'mcp' | 'command' | 'skill' | 'agent';

export interface ResourceEntry {
  type: ResourceType;
  name: string;
  pluginId: string;
}

export interface ResourceConflict {
  type: ResourceType;
  name: string;
  pluginIds: string[];
}

/**
 * 建立 resource key → providers 的映射。
 * key 格式：`type:name`（例：`mcp:web-search`、`command:deploy`）
 */
export function buildResourceMap(plugins: MergedPlugin[]): Map<string, ResourceEntry[]> {
  const map = new Map<string, ResourceEntry[]>();

  for (const p of plugins) {
    if (!p.contents) continue;

    for (const srv of p.contents.mcpServers) {
      addEntry(map, 'mcp', srv, p.id);
    }
    for (const cmd of p.contents.commands) {
      addEntry(map, 'command', cmd.name, p.id);
    }
    for (const skill of p.contents.skills) {
      addEntry(map, 'skill', skill.name, p.id);
    }
    for (const agent of p.contents.agents) {
      addEntry(map, 'agent', agent.name, p.id);
    }
  }

  return map;
}

/**
 * 找出被多個 plugin 提供的 resource（衝突）。
 */
export function findConflicts(plugins: MergedPlugin[]): ResourceConflict[] {
  const map = buildResourceMap(plugins);
  const conflicts: ResourceConflict[] = [];

  for (const entries of map.values()) {
    if (entries.length > 1) {
      conflicts.push({
        type: entries[0].type,
        name: entries[0].name,
        pluginIds: entries.map((e) => e.pluginId),
      });
    }
  }

  return conflicts;
}

function addEntry(
  map: Map<string, ResourceEntry[]>,
  type: ResourceType,
  name: string,
  pluginId: string,
): void {
  const key = `${type}:${name}`;
  const existing = map.get(key);
  if (existing) {
    existing.push({ type, name, pluginId });
  } else {
    map.set(key, [{ type, name, pluginId }]);
  }
}
