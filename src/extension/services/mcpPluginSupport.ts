import type { McpServerConfig, McpScope } from '../../shared/types';

export interface InstalledPluginEntry {
  scope: string;
  installPath: string;
  projectPath?: string;
  installedAt?: string;
  lastUpdated?: string;
}

export type EnabledPluginsByScope = Record<McpScope, Record<string, boolean>>;

interface ResolvedPluginInstall<T extends InstalledPluginEntry> {
  preferredEntry: T;
  enabled: boolean;
}

export function resolvePluginInstall<T extends InstalledPluginEntry>(
  entries: T[],
  pluginId: string,
  enabledByScope: EnabledPluginsByScope,
  workspacePath?: string,
): ResolvedPluginInstall<T> {
  const relevantEntries = getRelevantPluginEntries(entries, workspacePath);
  if (relevantEntries.length === 0) {
    throw new Error(`Plugin "${pluginId}" not available in current workspace`);
  }

  const enabled = isPluginEnabledInEntries(relevantEntries, pluginId, enabledByScope);
  const pool = enabled
    ? relevantEntries.filter((entry) => enabledByScope[entry.scope as McpScope]?.[pluginId] === true)
    : relevantEntries;
  const preferredEntry = [...pool].sort(
    (a, b) => getPluginEntryPriority(b.scope) - getPluginEntryPriority(a.scope),
  )[0];

  return { preferredEntry, enabled };
}

export function extractPluginServerConfigs(
  rawConfig: Record<string, unknown>,
): Record<string, McpServerConfig> {
  return (rawConfig.mcpServers ?? rawConfig) as Record<string, McpServerConfig>;
}

export function extractPluginDetailConfig(
  rawConfig: Record<string, unknown>,
  mcpServerName: string,
): unknown {
  return rawConfig[mcpServerName] ?? rawConfig;
}

function getRelevantPluginEntries<T extends InstalledPluginEntry>(
  entries: T[],
  workspacePath?: string,
): T[] {
  return entries.filter((entry) => {
    if (entry.scope === 'user') {
      return true;
    }
    if (!workspacePath) {
      return false;
    }
    return entry.projectPath === workspacePath;
  });
}

function isPluginEnabledInEntries(
  entries: InstalledPluginEntry[],
  pluginId: string,
  enabledByScope: EnabledPluginsByScope,
): boolean {
  return entries.some((entry) => enabledByScope[entry.scope as McpScope]?.[pluginId] === true);
}

function getPluginEntryPriority(scope: string): number {
  switch (scope) {
    case 'local':
      return 3;
    case 'project':
      return 2;
    case 'user':
      return 1;
    default:
      return 0;
  }
}
