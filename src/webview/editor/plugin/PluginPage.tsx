import React, { useRef } from 'react';
import { PluginCardSkeleton } from '../../components/Skeleton';
import { EmptyState, PluginIcon, NoResultsIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { KeyboardHelpOverlay } from '../../components/KeyboardHelpOverlay';
import { PluginCard } from './PluginCard';
import { BulkEnableScopeDialog } from './BulkEnableScopeDialog';
import { TranslateDialog } from './TranslateDialog';
import { getCardTranslateStatus } from './translateUtils';
import {
  CONTENT_TYPE_FILTERS,
  CONTENT_TYPE_LABELS,
  isPluginEnabled,
  hasPluginUpdate,
} from './filterUtils';
import { TRANSLATE_LANGS } from '../../../shared/types';
import { usePluginData } from './hooks/usePluginData';
import { usePluginFilters } from './hooks/usePluginFilters';
import { usePluginOperations } from './hooks/usePluginOperations';
import { useTranslation } from './hooks/useTranslation';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

/**
 * Plugin 管理頁面。
 * Search bar 過濾，按 marketplace 分 section，組內按名稱排序。
 */
export function PluginPage(): React.ReactElement {
  const {
    plugins,
    loading,
    error,
    setError,
    workspaceFolders,
    marketplaceSources,
    fetchAll,
  } = usePluginData();

  const {
    search,
    setSearch,
    debouncedSearch,
    flushSearch,
    filterEnabled,
    setFilterEnabled,
    contentTypeFilters,
    setContentTypeFilters,
    expanded,
    setExpanded,
    grouped,
  } = usePluginFilters(plugins);

  const {
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
  } = usePluginOperations(plugins, fetchAll, setError);

  const {
    translations,
    translateLang,
    dialogOpen,
    setDialogOpen,
    draftLang,
    setDraftLang,
    draftEmail,
    setDraftEmail,
    translateTitleId,
    translateEmailId,
    translateLangId,
    translateTrapRef,
    queuedTexts,
    activeTexts,
    translateWarning,
    setTranslateWarning,
    handleDialogConfirm,
    translateEmail,
  } = useTranslation(plugins);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    searchInputRef,
    onSearchClear: () => { setSearch(''); flushSearch(''); },
    cardSelector: '.card[tabindex]',
  });

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
        <div className="search-input-wrapper">
          <input
            ref={searchInputRef}
            className="input search-bar"
            type="text"
            placeholder="Search plugins..."
            aria-label="Search plugins"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              aria-label="Clear search"
              onClick={() => { setSearch(''); flushSearch(''); }}
            >
              &#x2715;
            </button>
          )}
        </div>
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
        <PluginCardSkeleton />
      ) : grouped.size === 0 ? (
        debouncedSearch || filterEnabled || contentTypeFilters.size > 0 ? (
          <EmptyState
            icon={<NoResultsIcon />}
            title="No plugins match the current filters."
            action={{
              label: 'Clear filters',
              onClick: () => {
                setSearch('');
                flushSearch('');
                setFilterEnabled(false);
                setContentTypeFilters(new Set());
              },
            }}
          />
        ) : (
          <EmptyState
            icon={<PluginIcon />}
            title="No plugins found"
            description="Add a marketplace first to discover and install plugins."
            action={{
              label: 'Go to Marketplace',
              onClick: () => window.postMessage({ type: 'navigate', category: 'marketplace' }, '*'),
            }}
          />
        )
      ) : (
        [...grouped.entries()].map(([marketplace, items]) => {
          // 搜尋或 Enabled filter 啟用時強制展開所有 section，方便一覽結果
          const isCollapsed = !filterEnabled && !debouncedSearch && contentTypeFilters.size === 0 && !expanded.has(marketplace);
          const enabledCount = items.filter(isPluginEnabled).length;
          const updateCount = items.filter(hasPluginUpdate).length;
          const mpBulk = bulkProgress.get(marketplace);
          const allEnabled = items.every(isPluginEnabled);
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
                  <span className="section-count">{enabledCount} / {items.length}</span>
                  {updateCount > 0 && (
                    <span className="section-updates">{updateCount} update{updateCount > 1 ? 's' : ''}</span>
                  )}
                  {marketplaceSources[marketplace] && (
                    <span className="section-source">{marketplaceSources[marketplace]}</span>
                  )}
                </button>
                <button
                  className={`section-bulk-btn${isCollapsed ? '' : ' section-bulk-btn--expanded'}`}
                  disabled={!!mpBulk || isUpdatingAll}
                  onClick={() => allEnabled
                    ? handleBulkDisable(marketplace, items)
                    : setPendingBulkEnable({ marketplace, items })}
                >
                  {mpBulk
                    ? `${mpBulk.action === 'enable' ? 'Enabling' : 'Disabling'} ${mpBulk.current}/${mpBulk.total}...`
                    : allEnabled ? 'Disable All' : 'Enable All'}
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

      {pendingBulkEnable && (
        <BulkEnableScopeDialog
          marketplace={pendingBulkEnable.marketplace}
          itemCount={pendingBulkEnable.items.length}
          scope={bulkDialogScope}
          workspaceFolders={workspaceFolders}
          onScopeChange={setBulkDialogScope}
          onCancel={() => setPendingBulkEnable(null)}
          onConfirm={() => {
            const { marketplace, items } = pendingBulkEnable;
            setPendingBulkEnable(null);
            handleBulkEnable(marketplace, items, bulkDialogScope);
          }}
        />
      )}

      {showHelp && <KeyboardHelpOverlay onClose={() => setShowHelp(false)} />}

      {dialogOpen && (
        <TranslateDialog
          trapRef={translateTrapRef}
          titleId={translateTitleId}
          emailId={translateEmailId}
          langId={translateLangId}
          draftEmail={draftEmail}
          draftLang={draftLang}
          onEmailChange={setDraftEmail}
          onLangChange={setDraftLang}
          onCancel={() => setDialogOpen(false)}
          onConfirm={handleDialogConfirm}
        />
      )}
    </div>
  );
}
