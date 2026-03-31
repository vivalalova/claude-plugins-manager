import React, { useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { PluginCardSkeleton } from '../../components/Skeleton';
import { EmptyState, PluginIcon, NoResultsIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DialogOverlay } from '../../components/DialogOverlay';
import { PluginDialogs } from './PluginDialogs';
import { PluginToolbar } from './PluginToolbar';
import { PluginSections } from './PluginSections';
import { OrphanedSection } from './OrphanedSection';
import { ContentDetailPanel } from '../../components/ContentDetailPanel';
import type { ContentTypeFilter } from './filterUtils';
import { usePluginData } from './hooks/usePluginData';
import { usePluginFilters } from './hooks/usePluginFilters';
import { usePluginOperations } from './hooks/usePluginOperations';
import { PageHeader } from '../../components/PageHeader';
import { useTranslation } from './hooks/useTranslation';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { usePluginPageViewState } from './hooks/usePluginPageViewState';
import { useMarketplaceActions } from '../marketplace/hooks/useMarketplaceActions';
import { sendRequest } from '../../vscode';
import type { PluginContentItem, PluginScope } from '../../../shared/types';
import type { ContentDetail } from '../../components/ContentDetailPanel';


/**
 * Plugin 管理頁面。
 * Search bar 過濾，按 marketplace 分 N 個 section，組內按名稱排序。
 * Marketplace 管理功能整合於 section header 及 PageHeader。
 */
export function PluginPage(): React.ReactElement {
  const { t } = useI18n();
  const {
    plugins,
    orphaned,
    loading,
    error,
    setError,
    workspaceFolders,
    marketplaceSources,
    marketplaces,
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
    sortBy,
    setSortBy,
    expanded,
    setExpanded,
    groupedSections,
    moveToSection,
    createSection,
    reorderSection,
    renameSection,
    sectionNames,
    hiddenPlugins,
    showHidden,
    setShowHidden,
    toggleHidden,
    ready,
  } = usePluginFilters(plugins);

  const {
    loadingPlugins,
    installError,
    setInstallError,
    updateAllProgress,
    updateAllErrors,
    setUpdateAllErrors,
    handleToggle,
    handleUpdate,
    handleUpdateAll,
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
    translateEmailId,
    translateLangId,
    queuedTexts,
    activeTexts,
    translateWarning,
    setTranslateWarning,
    handleDialogConfirm,
    translateEmail,
    retryTranslate,
  } = useTranslation(plugins);

  const {
    sectionStats,
    translateStatusMap,
    visiblePlugins,
    totalVisiblePlugins,
  } = usePluginPageViewState({
    groupedSections,
    hiddenPlugins,
    showHidden,
    translateLang,
    activeTexts,
    queuedTexts,
  });

  // Marketplace actions
  const {
    addSource,
    setAddSource,
    adding,
    updating: marketplaceUpdating,
    confirmRemove,
    setConfirmRemove,
    retryAction,
    setRetryAction,
    previewing,
    previewPlugins,
    handlePreview,
    handleClosePreview,
    handlePreviewOverlayDismiss,
    handleConfirmAdd,
    handleAdd,
    handleRemove,
    handleUpdate: handleMarketplaceUpdate,
    handleToggleAutoUpdate,
  } = useMarketplaceActions({ fetchList: fetchAll, setError });

  const [showAddDialog, setShowAddDialog] = useState(false);

  const [contentDetailItem, setContentDetailItem] = useState<PluginContentItem | null>(null);
  const [contentDetail, setContentDetail] = useState<ContentDetail | null>(null);
  const [contentDetailLoading, setContentDetailLoading] = useState(false);

  const handleViewContent = async (item: PluginContentItem): Promise<void> => {
    setContentDetailItem(item);
    setContentDetail(null);
    setContentDetailLoading(true);
    try {
      const data = await sendRequest<ContentDetail>({ type: 'plugin.getContentDetail', path: item.path });
      setContentDetail(data);
    } catch (err) {
      setContentDetailItem(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setContentDetailLoading(false);
    }
  };

  const handleOpenContentInEditor = (): void => {
    if (!contentDetailItem) return;
    sendRequest({ type: 'hooks.openFile', path: contentDetailItem.path }).catch(() => {});
  };

  const [installOnlyId, setInstallOnlyId] = useState<string | null>(null);

  const handleInstallOnly = async (pluginId: string): Promise<void> => {
    setInstallOnlyId(pluginId);
    try {
      await sendRequest({ type: 'plugin.install', plugin: pluginId, scope: 'user' });
      // install auto-enables → immediately disable（disable 失敗不阻斷，但仍 refresh）
      await sendRequest({ type: 'plugin.disable', plugin: pluginId, scope: 'user' }).catch(() => { /* CLI enable/disable exit 1 on duplicate ops */ });
      await fetchAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstallOnlyId(null);
    }
  };

  // Orphaned plugins state
  const [removingOrphans, setRemovingOrphans] = useState<Set<string>>(new Set());

  const orphanKey = (pluginId: string, scope: PluginScope, projectPath?: string): string =>
    `${pluginId}:${scope}:${projectPath ?? ''}`;

  const handleRemoveOrphaned = async (pluginId: string, scope: PluginScope, projectPath?: string): Promise<void> => {
    const key = orphanKey(pluginId, scope, projectPath);
    setRemovingOrphans((prev) => new Set(prev).add(key));
    try {
      await sendRequest({ type: 'plugin.removeOrphaned', plugin: pluginId, scope, projectPath });
      await fetchAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingOrphans((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  const handleRemoveAllOrphaned = async (): Promise<void> => {
    const allKeys = new Set(orphaned.map((o) => orphanKey(o.id, o.scope, o.projectPath)));
    setRemovingOrphans(allKeys);
    try {
      await sendRequest({ type: 'plugin.removeAllOrphaned' });
      await fetchAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingOrphans(new Set());
    }
  };

  const searchInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    searchInputRef,
    onSearchClear: () => { setSearch(''); flushSearch(''); },
    cardSelector: '.card[tabindex]',
  });

  return (
    <div className="page-container">
      <PageHeader
        title={t('plugin.page.title')}
        subtitle={t('plugin.page.subtitle')}
        actions={<>
          <button
            className="btn btn-secondary"
            onClick={() => setShowAddDialog(true)}
          >
            {t('plugin.page.addMarketplace')}
          </button>
          {hasInstalledPlugins && (
            <button
              className="btn btn-secondary"
              onClick={() => handleUpdateAll(visiblePlugins)}
              disabled={loading || isUpdatingAll}
            >
              {isUpdatingAll
                ? t('plugin.page.updating', { current: updateAllProgress?.current ?? 0, total: updateAllProgress?.total ?? 0 })
                : t('plugin.page.updateAll')}
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => fetchAll()}
            disabled={loading || isUpdatingAll}
          >
            {t('plugin.page.refresh')}
          </button>
        </>}
      />

      <PluginToolbar
        searchInputRef={searchInputRef}
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => { setSearch(''); flushSearch(''); }}
        translateLang={translateLang}
        queuedTextsSize={queuedTexts.size}
        activeTextsSize={activeTexts.size}
        onTranslateOpen={() => { setDraftEmail(translateEmail); setDraftLang(translateLang); setDialogOpen(true); }}
        filterEnabled={filterEnabled}
        onFilterEnabledToggle={() => setFilterEnabled((v) => !v)}
        showHidden={showHidden}
        onShowHiddenToggle={() => setShowHidden((v) => !v)}
        contentTypeFilters={contentTypeFilters}
        onContentTypeFilterToggle={(type: ContentTypeFilter) => setContentTypeFilters((prev) => {
          const next = new Set(prev);
          if (next.has(type)) next.delete(type);
          else next.add(type);
          return next;
        })}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />

      {error && (
        <ErrorBanner
          message={error}
          onDismiss={() => { setError(null); setRetryAction(null); }}
          action={retryAction && (
            <button className="btn btn-secondary btn-sm" onClick={retryAction}>Retry</button>
          )}
        />
      )}
      {installError && (
        <ErrorBanner
          message={installError.message}
          onDismiss={() => setInstallError(null)}
          action={
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleToggle(installError.pluginId, installError.scope, installError.enable)}
            >
              {t('plugin.page.retry')}
            </button>
          }
        />
      )}
      {updateAllErrors.length > 0 && (
        <ErrorBanner
          message={`Update All: ${updateAllErrors.length} failed — ${updateAllErrors.map((e) => `${e.pluginId} (${e.scope})`).join(', ')}`}
          onDismiss={() => setUpdateAllErrors([])}
          action={
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleUpdateAll(visiblePlugins)}
              disabled={isUpdatingAll}
            >
              {t('plugin.page.retry')}
            </button>
          }
        />
      )}
      {translateWarning && (
        <ErrorBanner
          message={t('plugin.page.quotaExceeded')}
          onDismiss={() => setTranslateWarning(null)}
          action={
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setTranslateWarning(null); retryTranslate(); }}
            >
              {t('plugin.page.retryTranslation')}
            </button>
          }
        />
      )}

      {loading || !ready ? (
        <PluginCardSkeleton />
      ) : totalVisiblePlugins === 0 ? (
        debouncedSearch || filterEnabled || contentTypeFilters.size > 0 || (!showHidden && hiddenPlugins.size > 0) ? (
          <EmptyState
            icon={<NoResultsIcon />}
            title={t('plugin.page.noResults')}
            action={{
              label: t('plugin.page.clearFilters'),
              onClick: () => {
                setSearch('');
                flushSearch('');
                setFilterEnabled(false);
                setShowHidden(true);
                setContentTypeFilters(new Set());
                setSortBy('name');
              },
            }}
          />
        ) : (
          <EmptyState
            icon={<PluginIcon />}
            title={t('plugin.page.noPlugins')}
            description={t('plugin.page.noPluginsDesc')}
            action={{
              label: t('plugin.page.addMarketplace'),
              onClick: () => setShowAddDialog(true),
            }}
          />
        )
      ) : (
        <PluginSections
          groupedSections={groupedSections}
          sectionNames={sectionNames}
          sectionStats={sectionStats}
          isUpdatingAll={isUpdatingAll}
          filterEnabled={filterEnabled}
          debouncedSearch={debouncedSearch}
          contentTypeFilters={contentTypeFilters}
          expanded={expanded}
          setExpanded={setExpanded}
          hiddenPlugins={hiddenPlugins}
          showHidden={showHidden}
          workspaceFolders={workspaceFolders}
          marketplaceSources={marketplaceSources}
          translations={translations}
          translateStatusMap={translateStatusMap}
          loadingPlugins={loadingPlugins}
          onToggle={handleToggle}
          onUpdate={handleUpdate}
          onToggleHidden={toggleHidden}
          onViewContent={handleViewContent}
          onInstallOnly={handleInstallOnly}
          installOnlyId={installOnlyId}
          moveToSection={moveToSection}
          createSection={createSection}
          reorderSection={reorderSection}
          renameSection={renameSection}
          marketplaces={marketplaces}
          marketplaceUpdating={marketplaceUpdating}
          onMarketplaceUpdate={(name) => handleMarketplaceUpdate(name)}
          onMarketplaceRemove={(name) => setConfirmRemove(name)}
          onMarketplaceToggleAutoUpdate={(name) => handleToggleAutoUpdate(name)}
        />
      )}

      {!loading && ready && (
        <OrphanedSection
          orphaned={orphaned}
          removing={removingOrphans}
          onRemove={handleRemoveOrphaned}
          onRemoveAll={handleRemoveAllOrphaned}
        />
      )}

      {contentDetailItem && (
        <ContentDetailPanel
          name={contentDetailItem.name}
          detail={contentDetail}
          loading={contentDetailLoading}
          onClose={() => setContentDetailItem(null)}
          onOpenInEditor={handleOpenContentInEditor}
        />
      )}

      {showAddDialog && (
        <DialogOverlay
          titleId="add-marketplace-title"
          onClose={() => { setShowAddDialog(false); setAddSource(''); }}
        >
          <div className="confirm-dialog-title" id="add-marketplace-title">
            {t('plugin.page.addMarketplace')}
          </div>
          <div className="form-inline" style={{ margin: '12px 0' }}>
            <input
              ref={addInputRef}
              className="input"
              placeholder="Git URL, GitHub owner/repo, or local path"
              value={addSource}
              onChange={(e) => setAddSource(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !previewing && handleAdd()}
              disabled={adding || previewing}
              autoFocus
            />
          </div>
          <div className="confirm-dialog-actions">
            <button
              className="btn btn-secondary"
              onClick={handlePreview}
              disabled={previewing || adding || !addSource.trim()}
            >
              {previewing ? 'Loading...' : 'Preview'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleAdd()}
              disabled={adding || !addSource.trim()}
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </DialogOverlay>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove Marketplace"
          message={`Remove "${confirmRemove}"? Plugins from this marketplace will no longer be available.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => handleRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {previewPlugins && (
        <div
          className="confirm-overlay"
          onClick={handlePreviewOverlayDismiss}
          onKeyDown={handlePreviewOverlayDismiss}
          tabIndex={0}
        >
          <div
            className="confirm-dialog confirm-dialog--preview"
            role="dialog"
            aria-modal="true"
          >
            <div className="confirm-dialog-title">
              Marketplace Preview — {previewPlugins.length} plugin{previewPlugins.length !== 1 ? 's' : ''}
            </div>
            <div className="preview-plugin-list">
              {previewPlugins.map((p) => (
                <div key={p.name} className="preview-plugin-item">
                  <div className="preview-plugin-name">
                    {p.name}
                    {p.version && <span className="preview-plugin-version">{p.version}</span>}
                  </div>
                  {p.description && (
                    <div className="preview-plugin-desc">{p.description}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="confirm-dialog-actions">
              <button className="btn btn-secondary" onClick={handleClosePreview}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmAdd} disabled={adding}>
                {adding ? 'Adding...' : 'Add Marketplace'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PluginDialogs
        showHelp={showHelp}
        onHelpClose={() => setShowHelp(false)}
        dialogOpen={dialogOpen}
        emailId={translateEmailId}
        langId={translateLangId}
        draftEmail={draftEmail}
        draftLang={draftLang}
        onEmailChange={setDraftEmail}
        onLangChange={setDraftLang}
        onTranslateCancel={() => setDialogOpen(false)}
        onTranslateConfirm={handleDialogConfirm}
      />
    </div>
  );
}
