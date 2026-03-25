import React, { useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { PluginCardSkeleton } from '../../components/Skeleton';
import { EmptyState, PluginIcon, NoResultsIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PluginDialogs } from './PluginDialogs';
import { PluginToolbar } from './PluginToolbar';
import { PluginSections } from './PluginSections';
import { ContentDetailPanel } from '../../components/ContentDetailPanel';
import type { ContentTypeFilter } from './filterUtils';
import { usePluginData } from './hooks/usePluginData';
import { usePluginFilters } from './hooks/usePluginFilters';
import { usePluginOperations } from './hooks/usePluginOperations';
import { PageHeader } from '../../components/PageHeader';
import { useTranslation } from './hooks/useTranslation';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { usePluginPageViewState } from './hooks/usePluginPageViewState';
import { sendRequest } from '../../vscode';
import type { PluginContentItem } from '../../../shared/types';
import type { ContentDetail } from '../../components/ContentDetailPanel';


/**
 * Plugin 管理頁面。
 * Search bar 過濾，按 marketplace 分 N 個 section，組內按名稱排序。
 */
export function PluginPage(): React.ReactElement {
  const { t } = useI18n();

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
    handleExport,
    handleImport,
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

  const searchInputRef = useRef<HTMLInputElement>(null);
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
          <button
            className="btn btn-secondary"
            onClick={handleExport}
            disabled={loading || !hasInstalledPlugins}
          >
            {t('plugin.page.export')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleImport}
          >
            {t('plugin.page.import')}
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
      {bulkErrors.length > 0 && (
        <ErrorBanner
          message={`Bulk toggle: ${bulkErrors.length} failed — ${bulkErrors.map((e) => e.pluginId).join(', ')}`}
          onDismiss={() => setBulkErrors([])}
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
              label: t('plugin.page.goToMarketplace'),
              onClick: () => window.postMessage({ type: 'navigate', category: 'marketplace' }, '*'),
            }}
          />
        )
      ) : (
        <PluginSections
          groupedSections={groupedSections}
          sectionNames={sectionNames}
          sectionStats={sectionStats}
          bulkProgress={bulkProgress}
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
          onBulkDisable={handleBulkDisable}
          onPendingBulkEnable={setPendingBulkEnable}
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

      <PluginDialogs
        pendingBulkEnable={pendingBulkEnable}
        bulkDialogScope={bulkDialogScope}
        workspaceFolders={workspaceFolders}
        onBulkDialogScopeChange={setBulkDialogScope}
        onBulkDialogCancel={() => setPendingBulkEnable(null)}
        onBulkDialogConfirm={() => {
          const { marketplace, items } = pendingBulkEnable!;
          setPendingBulkEnable(null);
          handleBulkEnable(marketplace, items, bulkDialogScope);
        }}
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
