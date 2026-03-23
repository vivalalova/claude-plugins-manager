import React, { useMemo, useRef } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { PluginCardSkeleton } from '../../components/Skeleton';
import { EmptyState, PluginIcon, NoResultsIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PluginDialogs } from './PluginDialogs';
import { PluginToolbar } from './PluginToolbar';
import { PluginSections } from './PluginSections';
import { getCardTranslateStatus } from './translateUtils';
import { isPluginEnabled, hasPluginUpdate, getVisibleItems } from './filterUtils';
import type { ContentTypeFilter } from './filterUtils';
import type { MergedPlugin } from '../../../shared/types';
import { usePluginData } from './hooks/usePluginData';
import { usePluginFilters } from './hooks/usePluginFilters';
import { usePluginOperations } from './hooks/usePluginOperations';
import { PageHeader } from '../../components/PageHeader';
import { useTranslation } from './hooks/useTranslation';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';


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

  /** 預計算 per-section 統計（single-pass） */
  const sectionStats = useMemo(() => {
    const map = new Map<string, { enabledCount: number; updateCount: number; allEnabled: boolean; hiddenCount: number; visibleCount: number }>();
    for (const section of groupedSections) {
      for (const [marketplace, items] of section.groups) {
        if (items.length > 0) {
          const visible = getVisibleItems(items, hiddenPlugins, showHidden);
          let enabledCount = 0;
          let updateCount = 0;
          let allEnabled = true;
          for (const p of visible) {
            const enabled = isPluginEnabled(p);
            if (enabled) {
              enabledCount++;
              if (hasPluginUpdate(p)) updateCount++;
            } else {
              allEnabled = false;
            }
          }
          map.set(marketplace, {
            enabledCount,
            updateCount,
            allEnabled: visible.length > 0 && allEnabled,
            hiddenCount: items.length - visible.length,
            visibleCount: visible.length,
          });
        }
      }
    }
    return map;
  }, [groupedSections, hiddenPlugins, showHidden]);

  /** 預計算 per-plugin translateStatus，只計算可見 plugin */
  const translateStatusMap = useMemo(() => {
    const map = new Map<string, 'translating' | 'queued'>();
    if (!translateLang) return map;
    for (const section of groupedSections) {
      for (const items of section.groups.values()) {
        for (const p of items) {
          const status = getCardTranslateStatus(p, translateLang, activeTexts, queuedTexts);
          if (status) map.set(p.id, status);
        }
      }
    }
    return map;
  }, [groupedSections, translateLang, activeTexts, queuedTexts]);

  /** 所有可見 plugin（排除隱藏），供 handleUpdateAll 使用 */
  const visiblePlugins = useMemo(() => {
    const result: MergedPlugin[] = [];
    for (const section of groupedSections) {
      for (const items of section.groups.values()) {
        result.push(...getVisibleItems(items, hiddenPlugins, showHidden));
      }
    }
    return result;
  }, [groupedSections, hiddenPlugins, showHidden]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    searchInputRef,
    onSearchClear: () => { setSearch(''); flushSearch(''); },
    cardSelector: '.card[tabindex]',
  });

  /** 總可見 plugin 數（用於空狀態判斷），從 sectionStats 派生 */
  const totalVisiblePlugins = useMemo(() => {
    let total = 0;
    for (const s of sectionStats.values()) total += s.visibleCount;
    return total;
  }, [sectionStats]);

  return (
    <div className="page-container">
      <PageHeader
        title={t('plugin.page.title')}
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
          moveToSection={moveToSection}
          createSection={createSection}
          reorderSection={reorderSection}
          renameSection={renameSection}
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
