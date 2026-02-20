import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';
import { sendRequest, onPushMessage } from '../../../vscode';
import type {
  InstalledPlugin,
  AvailablePlugin,
  MergedPlugin,
  PluginListResponse,
} from '../../../../shared/types';

/** workspace folder 資訊 */
export interface WorkspaceFolder {
  name: string;
  path: string;
}

/** usePluginData 回傳值 */
export interface UsePluginDataReturn {
  /** 合併後的 plugin 列表 */
  plugins: MergedPlugin[];
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
  /** 重新拉取完整列表。showSpinner=false 靜默刷新 */
  fetchAll: (showSpinner?: boolean) => Promise<void>;
}

/**
 * 合併 installed + available 為統一列表，按名稱字母排序。
 * @param installed - 已安裝的 plugin 清單（可能同 id 多 scope）
 * @param available - marketplace 上可用的 plugin 清單
 */
function mergePlugins(
  installed: InstalledPlugin[],
  available: AvailablePlugin[],
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
    } else {
      map.set(inst.id, {
        id: inst.id,
        name,
        marketplaceName: marketplace,
        version: inst.version,
        description: inst.description,
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
      if (avail.contents) existing.contents = avail.contents;
      if (avail.sourceDir) existing.sourceDir = avail.sourceDir;
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
        availableLastUpdated: avail.lastUpdated,
        userInstall: null,
        projectInstalls: [],
        localInstall: null,
      });
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
  const [plugins, setPlugins] = useState<MergedPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceFolders, setWorkspaceFolders] = useState<WorkspaceFolder[]>([]);
  const [marketplaceSources, setMarketplaceSources] = useState<Record<string, string>>({});

  /** 拉取完整列表。showSpinner=false 時靜默刷新，避免畫面閃爍 */
  const fetchAll = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const data = await sendRequest<PluginListResponse>(
        { type: 'plugin.listAvailable' },
      );
      setPlugins(mergePlugins(data.installed, data.available));
      setMarketplaceSources(data.marketplaceSources ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 訂閱檔案變更推送，自動靜默刷新
  useEffect(() => {
    const unsubscribe = onPushMessage((msg) => {
      if (msg.type === 'plugin.refresh') {
        fetchAll(false);
      }
    });
    return unsubscribe;
  }, [fetchAll]);

  // 取得 workspace folders
  useEffect(() => {
    sendRequest<WorkspaceFolder[]>({ type: 'workspace.getFolders' })
      .then(setWorkspaceFolders)
      .catch(() => {});
  }, []);

  return {
    plugins,
    loading,
    error,
    setError,
    workspaceFolders,
    marketplaceSources,
    fetchAll,
  };
}
