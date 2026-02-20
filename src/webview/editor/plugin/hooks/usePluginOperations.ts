import { type Dispatch, type SetStateAction, useState } from 'react';
import { sendRequest } from '../../../vscode';
import type { MergedPlugin, PluginScope } from '../../../../shared/types';
import {
  isPluginInstalled,
  isEnabledInScope,
  isInstalledInScope,
  getInstalledScopes,
  getEnabledScopes,
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

/** Bulk toggle 單一失敗項目 */
interface BulkError {
  marketplace: string;
  pluginId: string;
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
  /** Marketplace 層級 bulk toggle 進度（key = marketplace name） */
  bulkProgress: Map<string, { action: 'enable' | 'disable'; current: number; total: number }>;
  /** Bulk toggle 完成後的失敗摘要 */
  bulkErrors: BulkError[];
  /** 清除 bulkErrors */
  setBulkErrors: Dispatch<SetStateAction<BulkError[]>>;
  /** Bulk enable scope dialog 等待確認的狀態 */
  pendingBulkEnable: { marketplace: string; items: MergedPlugin[] } | null;
  /** 設定 pendingBulkEnable */
  setPendingBulkEnable: Dispatch<SetStateAction<{ marketplace: string; items: MergedPlugin[] } | null>>;
  /** Bulk enable dialog 選取的 scope */
  bulkDialogScope: PluginScope;
  /** 設定 bulkDialogScope */
  setBulkDialogScope: Dispatch<SetStateAction<PluginScope>>;
  /** Toggle = 勾 → install + enable，取消勾 → disable */
  handleToggle: (pluginId: string, scope: PluginScope, enable: boolean) => Promise<void>;
  /** 更新指定 plugin 的指定 scopes */
  handleUpdate: (pluginId: string, scopes: PluginScope[]) => Promise<void>;
  /** 批次更新所有已安裝 plugin */
  handleUpdateAll: () => Promise<void>;
  /** Marketplace 層級 bulk enable（指定 scope） */
  handleBulkEnable: (marketplace: string, items: MergedPlugin[], scope: PluginScope) => Promise<void>;
  /** Marketplace 層級 bulk disable（全部 scope） */
  handleBulkDisable: (marketplace: string, items: MergedPlugin[]) => Promise<void>;
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
  const [bulkProgress, setBulkProgress] = useState<Map<string, { action: 'enable' | 'disable'; current: number; total: number }>>(new Map());
  const [bulkErrors, setBulkErrors] = useState<BulkError[]>([]);
  const [pendingBulkEnable, setPendingBulkEnable] = useState<{ marketplace: string; items: MergedPlugin[] } | null>(null);
  const [bulkDialogScope, setBulkDialogScope] = useState<PluginScope>('user');

  /**
   * 設定 per-plugin per-scope loading 狀態。
   * @param pluginId - plugin 識別碼
   * @param scope - 操作的 scope
   * @param on - true=加入 loading，false=移除
   */
  const setPluginLoading = (pluginId: string, scope: PluginScope, on: boolean): void => {
    setLoadingPlugins((prev) => {
      const next = new Map(prev);
      const scopes = new Set(prev.get(pluginId));
      if (on) scopes.add(scope); else scopes.delete(scope);
      if (scopes.size === 0) next.delete(pluginId); else next.set(pluginId, scopes);
      return next;
    });
  };

  /** Toggle = 勾 → install + enable，取消勾 → disable */
  const handleToggle = async (
    pluginId: string,
    scope: PluginScope,
    enable: boolean,
  ): Promise<void> => {
    if (loadingPlugins.get(pluginId)?.has(scope)) return;
    setInstallError(null);
    setPluginLoading(pluginId, scope, true);
    try {
      if (enable) {
        await sendRequest(
          { type: 'plugin.install', plugin: pluginId, scope },
          120_000,
        );
        const plugin = plugins.find((p) => p.id === pluginId);
        const lastUpdated = plugin?.userInstall?.lastUpdated
          ?? plugin?.projectInstalls[0]?.lastUpdated
          ?? plugin?.localInstall?.lastUpdated;
        const recentlyUpdated = lastUpdated
          && (Date.now() - new Date(lastUpdated).getTime()) < 60_000;
        if (!recentlyUpdated) {
          try {
            await sendRequest({ type: 'plugin.update', plugin: pluginId, scope }, 120_000);
          } catch {
            // 剛安裝的 plugin 可能無需 update → 靜默
          }
        }
        try {
          await sendRequest({ type: 'plugin.enable', plugin: pluginId, scope });
        } catch {
          // install 已自動 enable → 靜默
        }
      } else {
        await sendRequest({ type: 'plugin.disable', plugin: pluginId, scope });
      }
      await fetchAll(false);
      addToast(`${enable ? 'Enabled' : 'Disabled'} ${pluginId}`);
    } catch (e) {
      setInstallError({
        message: e instanceof Error ? e.message : String(e),
        pluginId,
        scope,
        enable,
      });
    } finally {
      setPluginLoading(pluginId, scope, false);
    }
  };

  /** 更新指定 plugin 的指定 scopes */
  const handleUpdate = async (pluginId: string, scopes: PluginScope[]): Promise<void> => {
    setError(null);
    try {
      for (const scope of scopes) {
        await sendRequest({ type: 'plugin.update', plugin: pluginId, scope });
      }
      await fetchAll(false);
      addToast(`Updated ${pluginId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** 批次更新所有已安裝 plugin */
  const handleUpdateAll = async (): Promise<void> => {
    if (updateAllProgress) return; // guard concurrent invocation
    const installed = plugins.filter(isPluginInstalled);
    if (installed.length === 0) return;

    setUpdateAllErrors([]);
    setUpdateAllProgress({ current: 0, total: installed.length });
    const errors: UpdateAllError[] = [];

    for (let i = 0; i < installed.length; i++) {
      setUpdateAllProgress({ current: i + 1, total: installed.length });
      const p = installed[i];
      for (const scope of getInstalledScopes(p)) {
        try {
          await sendRequest({ type: 'plugin.update', plugin: p.id, scope });
        } catch (e) {
          errors.push({ pluginId: p.id, scope, message: e instanceof Error ? e.message : String(e) });
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

  /** Marketplace 層級 bulk enable（指定 scope） */
  const handleBulkEnable = async (marketplace: string, items: MergedPlugin[], scope: PluginScope): Promise<void> => {
    if (bulkProgress.has(marketplace)) return;
    const toProcess = items.filter((p) => !isEnabledInScope(p, scope));
    if (toProcess.length === 0) return;

    setBulkErrors((prev) => prev.filter((e) => e.marketplace !== marketplace));
    setBulkProgress((prev) => {
      const next = new Map(prev);
      next.set(marketplace, { action: 'enable', current: 0, total: toProcess.length });
      return next;
    });
    for (const p of toProcess) setPluginLoading(p.id, scope, true);

    const errors: BulkError[] = [];
    try {
      for (let i = 0; i < toProcess.length; i++) {
        setBulkProgress((prev) => {
          const next = new Map(prev);
          next.set(marketplace, { action: 'enable', current: i + 1, total: toProcess.length });
          return next;
        });
        const plugin = toProcess[i];
        try {
          if (isInstalledInScope(plugin, scope)) {
            await sendRequest({ type: 'plugin.enable', plugin: plugin.id, scope });
          } else {
            await sendRequest({ type: 'plugin.install', plugin: plugin.id, scope }, 120_000);
            try {
              await sendRequest({ type: 'plugin.enable', plugin: plugin.id, scope });
            } catch { /* install auto-enables */ }
          }
        } catch (e) {
          errors.push({ marketplace, pluginId: plugin.id, message: e instanceof Error ? e.message : String(e) });
        }
      }
    } finally {
      for (const p of toProcess) setPluginLoading(p.id, scope, false);
      setBulkProgress((prev) => {
        const next = new Map(prev);
        next.delete(marketplace);
        return next;
      });
    }
    if (errors.length > 0) {
      setBulkErrors((prev) => [...prev, ...errors]);
    } else {
      addToast(`Enabled all in ${marketplace}`);
    }
    try { await fetchAll(false); } catch { /* non-blocking */ }
  };

  /** Marketplace 層級 bulk disable（全部 scope） */
  const handleBulkDisable = async (marketplace: string, items: MergedPlugin[]): Promise<void> => {
    if (bulkProgress.has(marketplace)) return;
    const ops: { plugin: MergedPlugin; scope: PluginScope }[] = [];
    for (const p of items) {
      for (const scope of getEnabledScopes(p)) {
        ops.push({ plugin: p, scope });
      }
    }
    if (ops.length === 0) return;

    setBulkErrors((prev) => prev.filter((e) => e.marketplace !== marketplace));
    setBulkProgress((prev) => {
      const next = new Map(prev);
      next.set(marketplace, { action: 'disable', current: 0, total: ops.length });
      return next;
    });
    for (const op of ops) setPluginLoading(op.plugin.id, op.scope, true);

    const errors: BulkError[] = [];
    try {
      for (let i = 0; i < ops.length; i++) {
        setBulkProgress((prev) => {
          const next = new Map(prev);
          next.set(marketplace, { action: 'disable', current: i + 1, total: ops.length });
          return next;
        });
        try {
          await sendRequest({ type: 'plugin.disable', plugin: ops[i].plugin.id, scope: ops[i].scope });
        } catch (e) {
          errors.push({ marketplace, pluginId: ops[i].plugin.id, message: e instanceof Error ? e.message : String(e) });
        }
      }
    } finally {
      for (const op of ops) setPluginLoading(op.plugin.id, op.scope, false);
      setBulkProgress((prev) => {
        const next = new Map(prev);
        next.delete(marketplace);
        return next;
      });
    }
    if (errors.length > 0) {
      setBulkErrors((prev) => [...prev, ...errors]);
    } else {
      addToast(`Disabled all in ${marketplace}`);
    }
    try { await fetchAll(false); } catch { /* non-blocking */ }
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
    bulkProgress,
    bulkErrors,
    setBulkErrors,
    pendingBulkEnable,
    setPendingBulkEnable,
    bulkDialogScope,
    setBulkDialogScope,
    handleToggle,
    handleUpdate,
    handleUpdateAll,
    handleBulkEnable,
    handleBulkDisable,
    isUpdatingAll,
    hasInstalledPlugins,
  };
}
