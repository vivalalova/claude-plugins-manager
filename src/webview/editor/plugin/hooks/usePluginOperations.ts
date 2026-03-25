import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react';
import { sendRequest } from '../../../vscode';
import type { MergedPlugin, PluginScope } from '../../../../shared/types';
import { toErrorMessage } from '../../../../shared/errorUtils';
import {
  isPluginInstalled,
  isPluginEnabled,
  isInstalledInScope,
  getEnabledScopes,
  hasPluginUpdate,
} from '../filterUtils';
import { useToast } from '../../../components/Toast';

/** 安裝失敗可重試的錯誤資訊 */
interface InstallError {
  message: string;
  pluginId: string;
  scope: PluginScope;
  enable: boolean;
}

/** Update All 單一失敗項目 */
interface UpdateAllError {
  pluginId: string;
  scope: PluginScope;
  message: string;
}

/** usePluginOperations 回傳值 */
export interface UsePluginOperationsReturn {
  /** per-plugin per-scope 安裝中狀態 */
  loadingPlugins: Map<string, Set<PluginScope>>;
  /** 安裝失敗可重試的錯誤 */
  installError: InstallError | null;
  /** 清除 installError */
  setInstallError: Dispatch<SetStateAction<InstallError | null>>;
  /** Update All 進度（null = 未執行） */
  updateAllProgress: { current: number; total: number } | null;
  /** Update All 完成後的失敗摘要 */
  updateAllErrors: UpdateAllError[];
  /** 清除 updateAllErrors */
  setUpdateAllErrors: Dispatch<SetStateAction<UpdateAllError[]>>;
  /** Toggle = 勾 → install + enable，取消勾 → disable */
  handleToggle: (pluginId: string, scope: PluginScope, enable: boolean) => Promise<void>;
  /** 更新指定 plugin 的指定 scopes */
  handleUpdate: (pluginId: string, scopes: PluginScope[]) => Promise<void>;
  /** 批次更新所有已安裝 plugin（傳入可見列表則只更新可見的） */
  handleUpdateAll: (visiblePlugins?: MergedPlugin[]) => Promise<void>;
  /** 匯出 enabled plugins 為 shell script */
  handleExport: () => Promise<void>;
  /** 匯入 shell script 中的 plugin install 指令 */
  handleImport: () => Promise<void>;
  /** 是否正在執行 Update All */
  isUpdatingAll: boolean;
  /** 是否有任何已安裝的 plugin */
  hasInstalledPlugins: boolean;
}

/**
 * Plugin 操作 hook。
 * 管理 toggle、update、bulk enable/disable 等操作的狀態與邏輯。
 *
 * @param plugins - 完整 plugin 列表
 * @param fetchAll - 重新拉取列表的函數
 * @param setError - 全域錯誤 setter（handleUpdate 使用）
 */
export function usePluginOperations(
  plugins: MergedPlugin[],
  fetchAll: (showSpinner?: boolean) => Promise<void>,
  setError: Dispatch<SetStateAction<string | null>>,
): UsePluginOperationsReturn {
  const { addToast } = useToast();
  const [loadingPlugins, setLoadingPlugins] = useState<Map<string, Set<PluginScope>>>(new Map());
  const [installError, setInstallError] = useState<InstallError | null>(null);
  const [updateAllProgress, setUpdateAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [updateAllErrors, setUpdateAllErrors] = useState<UpdateAllError[]>([]);
  // Refs — 讓 useCallback 內部讀取最新值，避免 stale closure
  const pluginsRef = useRef(plugins);
  pluginsRef.current = plugins;
  const loadingPluginsRef = useRef(loadingPlugins);
  loadingPluginsRef.current = loadingPlugins;

  /**
   * 設定 per-plugin per-scope loading 狀態。
   * 用 functional update 存取 prev state，不需外部依賴。
   */
  const setPluginLoading = useCallback((pluginId: string, scope: PluginScope, on: boolean): void => {
    setLoadingPlugins((prev) => {
      const next = new Map(prev);
      const scopes = new Set(prev.get(pluginId));
      if (on) scopes.add(scope); else scopes.delete(scope);
      if (scopes.size === 0) next.delete(pluginId); else next.set(pluginId, scopes);
      return next;
    });
  }, []);

  /** Toggle = 勾 → install + enable，取消勾 → disable */
  const handleToggle = useCallback(async (
    pluginId: string,
    scope: PluginScope,
    enable: boolean,
  ): Promise<void> => {
    // 同 scope 下任何 plugin 正在操作 → 擋住（防 CLI concurrent writes 到同一個 settings.json）
    const anyLoadingInScope = [...loadingPluginsRef.current.values()].some((s) => s.has(scope));
    if (anyLoadingInScope) return;
    setInstallError(null);
    setPluginLoading(pluginId, scope, true);
    try {
      if (enable) {
        const pluginData = pluginsRef.current.find((p) => p.id === pluginId);
        if (pluginData && isInstalledInScope(pluginData, scope)) {
          // 已安裝但停用 → 只需 enable
          await sendRequest({ type: 'plugin.enable', plugin: pluginId, scope });
        } else {
          // 未安裝 → install（已含 enable）
          await sendRequest(
            { type: 'plugin.install', plugin: pluginId, scope },
            120_000,
          );
        }
      } else {
        await sendRequest({ type: 'plugin.disable', plugin: pluginId, scope });
      }
      await fetchAll(false);
      addToast(`${enable ? 'Enabled' : 'Disabled'} ${pluginId}`);
    } catch (e) {
      setInstallError({
        message: toErrorMessage(e),
        pluginId,
        scope,
        enable,
      });
    } finally {
      setPluginLoading(pluginId, scope, false);
    }
  }, [fetchAll, addToast, setPluginLoading]);

  /** 更新指定 plugin 的指定 scopes */
  const handleUpdate = useCallback(async (pluginId: string, scopes: PluginScope[]): Promise<void> => {
    setError(null);
    try {
      for (const scope of scopes) {
        await sendRequest({ type: 'plugin.update', plugin: pluginId, scope });
      }
      await fetchAll(false);
      addToast(`Updated ${pluginId}`);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }, [setError, fetchAll, addToast]);

  /** 批次更新有可用更新的 plugin（傳入可見列表則只更新可見的） */
  const handleUpdateAll = async (visiblePlugins?: MergedPlugin[]): Promise<void> => {
    if (updateAllProgress) return; // guard concurrent invocation
    const source = visiblePlugins ?? pluginsRef.current;
    const updatable = source.filter((p) => isPluginEnabled(p) && hasPluginUpdate(p));
    if (updatable.length === 0) {
      addToast('All plugins are up to date');
      return;
    }

    setUpdateAllErrors([]);
    setUpdateAllProgress({ current: 0, total: updatable.length });
    const errors: UpdateAllError[] = [];

    for (let i = 0; i < updatable.length; i++) {
      setUpdateAllProgress({ current: i + 1, total: updatable.length });
      const p = updatable[i];
      for (const scope of getEnabledScopes(p)) {
        try {
          await sendRequest({ type: 'plugin.update', plugin: p.id, scope });
        } catch (e) {
          errors.push({ pluginId: p.id, scope, message: toErrorMessage(e) });
        }
      }
    }

    setUpdateAllProgress(null);
    if (errors.length > 0) {
      setUpdateAllErrors(errors);
    } else {
      addToast('All plugins updated');
    }
    try { await fetchAll(false); } catch { /* refresh failure non-blocking */ }
  };

  const handleExport = async (): Promise<void> => {
    setError(null);
    try {
      await sendRequest({ type: 'plugin.export' });
    } catch (e) {
      setError(toErrorMessage(e));
    }
  };

  const handleImport = async (): Promise<void> => {
    setError(null);
    try {
      const results = await sendRequest<string[]>({ type: 'plugin.import' });
      let failMsg: string | null = null;
      if (results.length > 0) {
        const installed = results.filter((r) => r.startsWith('Installed'));
        const failed = results.filter((r) => r.startsWith('Failed'));
        if (installed.length > 0) {
          addToast(`Imported ${installed.length} plugin(s)`);
        }
        if (failed.length > 0) {
          failMsg = `Import: ${failed.length} failed — ${failed.map((f) => f.replace(/^Failed:\s*/, '')).join('; ')}`;
        }
      }
      await fetchAll(false);
      if (failMsg) setError(failMsg);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  };

  const isUpdatingAll = updateAllProgress !== null;
  const hasInstalledPlugins = plugins.some(isPluginInstalled);

  return {
    loadingPlugins,
    installError,
    setInstallError,
    updateAllProgress,
    updateAllErrors,
    setUpdateAllErrors,
    handleToggle,
    handleUpdate,
    handleUpdateAll,
    handleExport,
    handleImport,
    isUpdatingAll,
    hasInstalledPlugins,
  };
}
