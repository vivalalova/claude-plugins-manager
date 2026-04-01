import { type Dispatch, type SetStateAction, useCallback } from 'react';
import { sendRequest } from '../../../vscode';
import type {
  InstalledPlugin,
  AvailablePlugin,
  EnabledPluginsMap,
  Marketplace,
  MergedPlugin,
  OrphanedPlugin,
  PluginListResponse,
  PluginScope,
} from '../../../../shared/types';
import { usePushSyncedResource } from '../../../hooks/usePushSyncedResource';

/** workspace folder 資訊 */
export interface WorkspaceFolder {
  name: string;
  path: string;
}

/** usePluginData 回傳值 */
export interface UsePluginDataReturn {
  /** 合併後的 plugin 列表 */
  plugins: MergedPlugin[];
  /** installPath 不存在的孤立 entries */
  orphaned: OrphanedPlugin[];
  /** 初始載入中 */
  loading: boolean;
  /** 全域錯誤訊息 */
  error: string | null;
  /** 設定全域錯誤（供 handleUpdate 呼叫） */
  setError: Dispatch<SetStateAction<string | null>>;
  /** 目前開啟的 workspace folders */
  workspaceFolders: WorkspaceFolder[];
  /** marketplace name → source URL 對照表 */
  marketplaceSources: Record<string, string>;
  /** 完整 marketplace 列表（含 autoUpdate、lastUpdated 等） */
  marketplaces: Marketplace[];
  /** 重新拉取完整列表。showSpinner=false 靜默刷新 */
  fetchAll: (showSpinner?: boolean) => Promise<void>;
}

/**
 * 合併 installed + available 為統一列表，按名稱字母排序。
 * @param installed - 已安裝的 plugin 清單（可能同 id 多 scope）
 * @param available - marketplace 上可用的 plugin 清單
 * @param enabledByScope - 各 scope settings.json 的 enabledPlugins（source of truth）
 */
export function mergePlugins(
  installed: InstalledPlugin[],
  available: AvailablePlugin[],
  enabledByScope?: Record<PluginScope, EnabledPluginsMap>,
): MergedPlugin[] {
  const map = new Map<string, MergedPlugin>();

  // 先處理已安裝的
  for (const inst of installed) {
    const [name, marketplace] = inst.id.split('@');
    const existing = map.get(inst.id);

    if (existing) {
      if (inst.scope === 'user') {
        existing.userInstall = inst;
      } else if (inst.scope === 'project') {
        existing.projectInstalls.push(inst);
      } else if (inst.scope === 'local') {
        existing.localInstall = inst;
      }
      // 已安裝的 contents 優先（從 installPath 掃描，比 marketplace 更完整）
      if (inst.contents && !existing.contents) existing.contents = inst.contents;
    } else {
      map.set(inst.id, {
        id: inst.id,
        name,
        marketplaceName: marketplace,
        version: inst.version,
        description: inst.description,
        contents: inst.contents,
        userInstall: inst.scope === 'user' ? inst : null,
        projectInstalls: inst.scope === 'project' ? [inst] : [],
        localInstall: inst.scope === 'local' ? inst : null,
      });
    }
  }

  // 補充 available 的 description，加入未安裝的
  for (const avail of available) {
    const id = avail.pluginId ?? `${avail.name}@${avail.marketplaceName}`;
    const existing = map.get(id);

    if (existing) {
      if (avail.description) existing.description = avail.description;
      if (avail.contents && !existing.contents) existing.contents = avail.contents;
      if (avail.sourceDir) existing.sourceDir = avail.sourceDir;
      if (avail.sourceUrl) existing.sourceUrl = avail.sourceUrl;
      if (!existing.version && avail.version) {
        existing.version = avail.version;
      }
      if (avail.lastUpdated) existing.availableLastUpdated = avail.lastUpdated;
    } else {
      map.set(id, {
        id,
        name: avail.name,
        marketplaceName: avail.marketplaceName,
        description: avail.description,
        version: avail.version,
        contents: avail.contents,
        sourceDir: avail.sourceDir,
        sourceUrl: avail.sourceUrl,
        availableLastUpdated: avail.lastUpdated,
        userInstall: null,
        projectInstalls: [],
        localInstall: null,
      });
    }
  }

  // 預計算 lastUpdated（最新安裝日期），避免 PluginCard 每次 render 重算
  for (const p of map.values()) {
    const dates = [
      p.userInstall?.lastUpdated,
      ...p.projectInstalls.map((i) => i.lastUpdated),
      p.localInstall?.lastUpdated,
    ].filter(Boolean) as string[];
    if (dates.length > 0) {
      p.lastUpdated = dates.sort().pop();
    }
  }

  // 從 settings.json enabledPlugins 設定 settingsEnabledScopes（source of truth）
  // 涵蓋 installed_plugins.json 缺少 entry 的情況（如外部 repo plugin 由 CLI 直接啟用）
  if (enabledByScope) {
    const scopes: PluginScope[] = ['user', 'project', 'local'];
    for (const p of map.values()) {
      const enabled = scopes.filter((s) => enabledByScope[s]?.[p.id] === true);
      if (enabled.length > 0) {
        p.settingsEnabledScopes = enabled;
      }
    }
  }

  // 按名稱排序
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Plugin 資料層 hook。
 * 管理 plugins 列表、loading/error 狀態、workspace folders、marketplace sources。
 */
export function usePluginData(): UsePluginDataReturn {
  const loadPluginData = useCallback(async () => {
    const [pluginResult, workspaceResult, marketplaceResult] = await Promise.allSettled([
      sendRequest<PluginListResponse>(
        { type: 'plugin.listAvailable' },
      ),
      sendRequest<WorkspaceFolder[]>({ type: 'workspace.getFolders' }),
      sendRequest<Marketplace[]>({ type: 'marketplace.list' }),
    ]);

    if (pluginResult.status !== 'fulfilled') {
      throw pluginResult.reason;
    }

    return {
      plugins: mergePlugins(
        pluginResult.value.installed,
        pluginResult.value.available,
        pluginResult.value.enabledByScope,
      ),
      orphaned: pluginResult.value.orphaned ?? [],
      workspaceFolders: workspaceResult.status === 'fulfilled' ? workspaceResult.value : [],
      marketplaceSources: pluginResult.value.marketplaceSources ?? {},
      marketplaces: marketplaceResult.status === 'fulfilled' ? (marketplaceResult.value ?? []) : [],
    };
  }, []);
  const shouldRefreshPluginData = useCallback(
    (msg: { type?: string }) => msg.type === 'plugin.refresh' || msg.type === 'marketplace.refresh',
    [],
  );

  const {
    data,
    loading,
    error,
    setError,
    refresh: fetchAll,
  } = usePushSyncedResource<{
    plugins: MergedPlugin[];
    orphaned: OrphanedPlugin[];
    workspaceFolders: WorkspaceFolder[];
    marketplaceSources: Record<string, string>;
    marketplaces: Marketplace[];
  }>({
    initialData: {
      plugins: [],
      orphaned: [],
      workspaceFolders: [],
      marketplaceSources: {},
      marketplaces: [],
    },
    load: loadPluginData,
    pushFilter: shouldRefreshPluginData,
  });

  return {
    plugins: data.plugins,
    orphaned: data.orphaned,
    loading,
    error,
    setError,
    workspaceFolders: data.workspaceFolders,
    marketplaceSources: data.marketplaceSources,
    marketplaces: data.marketplaces,
    fetchAll,
  };
}
