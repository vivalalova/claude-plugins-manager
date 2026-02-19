import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendRequest, onPushMessage } from '../../vscode';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PluginCard } from './PluginCard';
import { collectPluginTexts, getCardTranslateStatus, runConcurrent } from './translateUtils';
import {
  matchesContentType,
  matchesSearch,
  isPluginInstalled,
  getInstalledScopes,
  CONTENT_TYPE_FILTERS,
  CONTENT_TYPE_LABELS,
  PLUGIN_SEARCH_KEY,
  PLUGIN_FILTER_ENABLED_KEY,
  readContentTypeFilters,
  writeContentTypeFilters,
  type ContentTypeFilter,
} from './filterUtils';
import type { TranslateResult } from '../../../extension/services/TranslationService';
import {
  TRANSLATE_LANGS,
  type InstalledPlugin,
  type AvailablePlugin,
  type MergedPlugin,
  type PluginListResponse,
  type PluginScope,
} from '../../../shared/types';

interface WorkspaceFolder {
  name: string;
  path: string;
}

/**
 * Plugin 管理頁面。
 * Search bar 過濾，按 marketplace 分 section，組內按名稱排序。
 */
export function PluginPage(): React.ReactElement {
  const [plugins, setPlugins] = useState<MergedPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** per-plugin per-scope 安裝中狀態 */
  const [loadingPlugins, setLoadingPlugins] = useState<Map<string, Set<PluginScope>>>(new Map());
  /** 安裝失敗可重試的錯誤 */
  const [installError, setInstallError] = useState<{
    message: string;
    pluginId: string;
    scope: PluginScope;
    enable: boolean;
  } | null>(null);
  /** Update All 進度（null = 未執行） */
  const [updateAllProgress, setUpdateAllProgress] = useState<{ current: number; total: number } | null>(null);
  /** Update All 完成後的失敗摘要 */
  const [updateAllErrors, setUpdateAllErrors] = useState<{ pluginId: string; scope: PluginScope; message: string }[]>([]);
  /** Marketplace 層級 bulk toggle 進度（key = marketplace name） */
  const [bulkProgress, setBulkProgress] = useState<Map<string, { action: 'enable' | 'disable'; current: number; total: number }>>(new Map());
  /** Bulk toggle 完成後的失敗摘要 */
  const [bulkErrors, setBulkErrors] = useState<{ marketplace: string; pluginId: string; message: string }[]>([]);
  const [search, setSearch] = useState(() => localStorage.getItem(PLUGIN_SEARCH_KEY) ?? '');
  const [filterEnabled, setFilterEnabled] = useState(
    () => localStorage.getItem(PLUGIN_FILTER_ENABLED_KEY) === 'true',
  );
  const [contentTypeFilters, setContentTypeFilters] = useState<Set<ContentTypeFilter>>(readContentTypeFilters);
  const [workspaceFolders, setWorkspaceFolders] = useState<WorkspaceFolder[]>([]);
  // 預設收合，使用者手動展開的 marketplace 加入此 set
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [marketplaceSources, setMarketplaceSources] = useState<Record<string, string>>({});
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translateLang, setTranslateLang] = useState(
    () => localStorage.getItem('plugin.translateLang') ?? '',
  );
  const [translateEmail, setTranslateEmail] = useState(
    () => localStorage.getItem('plugin.translateEmail') ?? '',
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftLang, setDraftLang] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [queuedTexts, setQueuedTexts] = useState<Set<string>>(new Set());
  const [activeTexts, setActiveTexts] = useState<Set<string>>(new Set());
  const [translateWarning, setTranslateWarning] = useState<string | null>(null);
  const translateVersionRef = useRef(0);
  useEffect(() => {
    sendRequest<WorkspaceFolder[]>({ type: 'workspace.getFolders' })
      .then(setWorkspaceFolders)
      .catch(() => {});
  }, []);

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

  // Filter 狀態持久化 → localStorage
  useEffect(() => { localStorage.setItem(PLUGIN_SEARCH_KEY, search); }, [search]);
  useEffect(() => { localStorage.setItem(PLUGIN_FILTER_ENABLED_KEY, String(filterEnabled)); }, [filterEnabled]);
  useEffect(() => { writeContentTypeFilters(contentTypeFilters); }, [contentTypeFilters]);

  /** 語言變更或 plugins 載入後自動翻譯（分批送出，最多 3 併發，逐批更新 UI） */
  const doTranslate = useCallback(async (lang: string, email: string, items: MergedPlugin[]) => {
    const version = ++translateVersionRef.current;

    if (!lang || !email) {
      setTranslations({});
      setQueuedTexts(new Set());
      setActiveTexts(new Set());
      setTranslateWarning(null);
      return;
    }

    // 收集所有可翻譯文字（plugin desc + content desc）
    const texts = [...new Set(collectPluginTexts(items))];
    if (texts.length === 0) return;

    const CHUNK_SIZE = 5;
    const chunks: string[][] = [];
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      chunks.push(texts.slice(i, i + CHUNK_SIZE));
    }

    setTranslations({});
    setTranslateWarning(null);
    setQueuedTexts(new Set(texts));
    setActiveTexts(new Set());

    let quotaExceeded = false;

    const tasks = chunks.map((chunk) => async () => {
      if (translateVersionRef.current !== version || quotaExceeded) return;

      // queued → active
      setQueuedTexts((prev) => {
        const next = new Set(prev);
        for (const t of chunk) next.delete(t);
        return next;
      });
      setActiveTexts((prev) => {
        const next = new Set(prev);
        for (const t of chunk) next.add(t);
        return next;
      });

      try {
        const { translations: result, warning } = await sendRequest<TranslateResult>(
          { type: 'plugin.translate', texts: chunk, targetLang: lang, email },
        );
        if (translateVersionRef.current !== version) return;
        setTranslations((prev) => ({ ...prev, ...result }));
        if (warning) {
          quotaExceeded = true;
          setTranslateWarning(warning);
          setQueuedTexts(new Set());
          setActiveTexts(new Set());
        }
      } catch {
        // 翻譯失敗不影響主流程
      } finally {
        if (!quotaExceeded) {
          setActiveTexts((prev) => {
            const next = new Set(prev);
            for (const t of chunk) next.delete(t);
            return next;
          });
        }
      }
    });

    await runConcurrent(tasks, 3);
  }, []);

  useEffect(() => {
    if (plugins.length > 0 && translateLang && translateEmail) {
      doTranslate(translateLang, translateEmail, plugins);
    }
  }, [translateLang, translateEmail, plugins, doTranslate]);

  /** Dialog confirm：儲存設定並觸發翻譯 */
  const handleDialogConfirm = (): void => {
    localStorage.setItem('plugin.translateEmail', draftEmail);
    localStorage.setItem('plugin.translateLang', draftLang);
    setTranslateEmail(draftEmail);
    setTranslateLang(draftLang);
    setDialogOpen(false);
  };

  /** 過濾 + 按 marketplace 分組 */
  const grouped = useMemo(() => {
    let filtered = search
      ? plugins.filter((p) => matchesSearch(p, search))
      : plugins;

    if (filterEnabled) {
      filtered = filtered.filter((p) =>
        p.userInstall?.enabled
        || p.projectInstalls.some((i) => i.enabled)
        || p.localInstall?.enabled,
      );
    }

    // Content type filter（OR 邏輯）：未載入 contents 的 plugin 保守顯示
    if (contentTypeFilters.size > 0) {
      filtered = filtered.filter((p) => matchesContentType(p, contentTypeFilters));
    }

    const groups = new Map<string, MergedPlugin[]>();
    for (const p of filtered) {
      const key = p.marketplaceName ?? 'other';
      const arr = groups.get(key);
      if (arr) {
        arr.push(p);
      } else {
        groups.set(key, [p]);
      }
    }
    return groups;
  }, [plugins, search, filterEnabled, contentTypeFilters]);

  /** 設定 per-plugin per-scope loading */
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
        try {
          await sendRequest({ type: 'plugin.enable', plugin: pluginId, scope });
        } catch {
          // install 已自動 enable → 靜默
        }
      } else {
        await sendRequest({ type: 'plugin.disable', plugin: pluginId, scope });
      }
      await fetchAll(false);
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

  const handleUpdate = async (pluginId: string, scopes: PluginScope[]): Promise<void> => {
    setError(null);
    try {
      for (const scope of scopes) {
        await sendRequest({ type: 'plugin.update', plugin: pluginId, scope });
      }
      await fetchAll(false);
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
    const errors: { pluginId: string; scope: PluginScope; message: string }[] = [];

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
    if (errors.length > 0) setUpdateAllErrors(errors);
    try { await fetchAll(false); } catch { /* refresh failure non-blocking */ }
  };

  /** Marketplace 層級 bulk enable/disable（user scope） */
  const handleBulkToggle = async (marketplace: string, items: MergedPlugin[]): Promise<void> => {
    if (bulkProgress.has(marketplace)) return;
    const allUserEnabled = items.every((p) => p.userInstall?.enabled);
    const enable = !allUserEnabled;
    const scope: PluginScope = 'user';
    const toProcess = enable
      ? items.filter((p) => !p.userInstall?.enabled)
      : items.filter((p) => p.userInstall?.enabled);

    if (toProcess.length === 0) return;

    setBulkErrors((prev) => prev.filter((e) => e.marketplace !== marketplace));
    setBulkProgress((prev) => {
      const next = new Map(prev);
      next.set(marketplace, { action: enable ? 'enable' : 'disable', current: 0, total: toProcess.length });
      return next;
    });
    for (const p of toProcess) setPluginLoading(p.id, scope, true);

    const errors: { marketplace: string; pluginId: string; message: string }[] = [];

    try {
      for (let i = 0; i < toProcess.length; i++) {
        setBulkProgress((prev) => {
          const next = new Map(prev);
          next.set(marketplace, { action: enable ? 'enable' : 'disable', current: i + 1, total: toProcess.length });
          return next;
        });

        const plugin = toProcess[i];
        try {
          if (enable) {
            if (plugin.userInstall) {
              // 已安裝但 disabled → 只需 enable
              await sendRequest({ type: 'plugin.enable', plugin: plugin.id, scope });
            } else {
              // 未安裝 → install（自動 enable）
              await sendRequest({ type: 'plugin.install', plugin: plugin.id, scope }, 120_000);
              try {
                await sendRequest({ type: 'plugin.enable', plugin: plugin.id, scope });
              } catch { /* install auto-enables */ }
            }
          } else {
            await sendRequest({ type: 'plugin.disable', plugin: plugin.id, scope });
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

    if (errors.length > 0) setBulkErrors((prev) => [...prev, ...errors]);
    try { await fetchAll(false); } catch { /* non-blocking */ }
  };

  const isUpdatingAll = updateAllProgress !== null;
  const hasInstalledPlugins = plugins.some(isPluginInstalled);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">Plugins Manager</div>
        <div className="page-actions">
          {hasInstalledPlugins && (
            <button
              className="btn btn-secondary"
              onClick={handleUpdateAll}
              disabled={loading || isUpdatingAll}
            >
              {isUpdatingAll
                ? `Updating ${updateAllProgress?.current ?? 0}/${updateAllProgress?.total ?? 0}...`
                : 'Update All'}
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => fetchAll()}
            disabled={loading || isUpdatingAll}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="search-row">
        <input
          className="input search-bar"
          type="text"
          placeholder="Search plugins..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filterEnabled}
            onChange={() => setFilterEnabled((v) => !v)}
          />
          <span>Enabled</span>
        </label>
        <button
          className="btn btn-secondary translate-btn"
          onClick={() => { setDraftEmail(translateEmail); setDraftLang(translateLang); setDialogOpen(true); }}
          disabled={queuedTexts.size > 0 || activeTexts.size > 0}
        >
          {translateLang ? TRANSLATE_LANGS[translateLang] ?? translateLang : 'Translate'}
        </button>
      </div>

      <div className="filter-chips">
        {CONTENT_TYPE_FILTERS.map((type) => (
          <button
            key={type}
            className={`filter-chip${contentTypeFilters.has(type) ? ' filter-chip--active' : ''}`}
            onClick={() => setContentTypeFilters((prev) => {
              const next = new Set(prev);
              if (next.has(type)) next.delete(type);
              else next.add(type);
              return next;
            })}
          >
            {CONTENT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {installError && (
        <ErrorBanner
          message={installError.message}
          onDismiss={() => setInstallError(null)}
          action={
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleToggle(installError.pluginId, installError.scope, installError.enable)}
            >
              Retry
            </button>
          }
        />
      )}
      {updateAllErrors.length > 0 && (
        <ErrorBanner
          message={`Update All: ${updateAllErrors.length} failed — ${updateAllErrors.map((e) => `${e.pluginId} (${e.scope})`).join(', ')}`}
          onDismiss={() => setUpdateAllErrors([])}
        />
      )}
      {bulkErrors.length > 0 && (
        <ErrorBanner
          message={`Bulk toggle: ${bulkErrors.length} failed — ${bulkErrors.map((e) => e.pluginId).join(', ')}`}
          onDismiss={() => setBulkErrors([])}
        />
      )}
      {translateWarning && (
        <ErrorBanner message={translateWarning} onDismiss={() => setTranslateWarning(null)} />
      )}

      {loading ? (
        <LoadingSpinner message="Loading plugins..." />
      ) : grouped.size === 0 ? (
        <div className="empty-state">
          {search || filterEnabled || contentTypeFilters.size > 0
            ? 'No plugins match the current filters.'
            : 'No plugins found. Add a marketplace first.'}
        </div>
      ) : (
        [...grouped.entries()].map(([marketplace, items]) => {
          // 搜尋或 Enabled filter 啟用時強制展開所有 section，方便一覽結果
          const isCollapsed = !filterEnabled && !search && contentTypeFilters.size === 0 && !expanded.has(marketplace);
          const installedCount = items.filter(isPluginInstalled).length;
          const mpBulk = bulkProgress.get(marketplace);
          const allUserEnabled = items.every((p) => p.userInstall?.enabled);
          return (
            <div key={marketplace} className="plugin-section">
              <div className="section-header">
                <button
                  className={`section-toggle${isCollapsed ? ' section-toggle--collapsed' : ''}`}
                  onClick={() => setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(marketplace)) next.delete(marketplace);
                    else next.add(marketplace);
                    return next;
                  })}
                >
                  <span className={`section-chevron${isCollapsed ? ' section-chevron--collapsed' : ''}`}>&#9662;</span>
                  <span className="section-toggle-label">{marketplace}</span>
                  <span className="section-count">{installedCount} / {items.length}</span>
                  {marketplaceSources[marketplace] && (
                    <span className="section-source">{marketplaceSources[marketplace]}</span>
                  )}
                </button>
                <button
                  className={`section-bulk-btn${isCollapsed ? '' : ' section-bulk-btn--expanded'}`}
                  disabled={!!mpBulk || isUpdatingAll}
                  onClick={() => handleBulkToggle(marketplace, items)}
                >
                  {mpBulk
                    ? `${mpBulk.action === 'enable' ? 'Enabling' : 'Disabling'} ${mpBulk.current}/${mpBulk.total}...`
                    : allUserEnabled ? 'Disable All' : 'Enable All'}
                </button>
              </div>
              <div className={`section-body${isCollapsed ? ' section-body--collapsed' : ''}`}>
                <div className="section-body-inner">
                  <div className="card-list">
                    {items.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        workspaceName={workspaceFolders[0]?.name}
                        marketplaceUrl={plugin.marketplaceName ? marketplaceSources[plugin.marketplaceName] : undefined}
                        translations={translations}
                        translateStatus={getCardTranslateStatus(plugin, translateLang, activeTexts, queuedTexts)}
                        loadingScopes={loadingPlugins.get(plugin.id)}
                        onToggle={(scope, enable) => handleToggle(plugin.id, scope, enable)}
                        onUpdate={(scopes) => handleUpdate(plugin.id, scopes)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {dialogOpen && (
        <div
          className="confirm-overlay"
          onClick={() => setDialogOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setDialogOpen(false); }}
        >
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-dialog-title">Translate</div>
            <div className="form-row">
              <label className="form-label">Email (MyMemory API)</label>
              <input
                className="input"
                type="email"
                value={draftEmail}
                onChange={(e) => setDraftEmail(e.target.value)}
                placeholder="your@email.com"
              />
              <span className="form-hint">
                Email is sent to MyMemory API to increase daily quota.
              </span>
            </div>
            <div className="form-row">
              <label className="form-label">Language</label>
              <select
                className="input"
                value={draftLang}
                onChange={(e) => setDraftLang(e.target.value)}
              >
                <option value="">English</option>
                {Object.entries(TRANSLATE_LANGS).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div className="confirm-dialog-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setDialogOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleDialogConfirm}
                disabled={!draftEmail || !draftLang}
              >OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 合併 installed + available 為統一列表。
 * 按名稱字母排序。
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
    } else {
      map.set(id, {
        id,
        name: avail.name,
        marketplaceName: avail.marketplaceName,
        description: avail.description,
        version: avail.version,
        contents: avail.contents,
        sourceDir: avail.sourceDir,
        userInstall: null,
        projectInstalls: [],
        localInstall: null,
      });
    }
  }

  // 按名稱排序
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
