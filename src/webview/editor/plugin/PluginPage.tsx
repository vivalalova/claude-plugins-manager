import React, { useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { PluginCardSkeleton } from '../../components/Skeleton';
import { EmptyState, PluginIcon, NoResultsIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { KeyboardHelpOverlay } from '../../components/KeyboardHelpOverlay';
import { PluginCard } from './PluginCard';
import { VirtualCardList } from './VirtualCardList';
import { BulkEnableScopeDialog } from './BulkEnableScopeDialog';
import { TranslateDialog } from './TranslateDialog';
import { getCardTranslateStatus } from './translateUtils';
import {
  CONTENT_TYPE_FILTERS,
  isPluginEnabled,
  hasPluginUpdate,
} from './filterUtils';
import type { ContentTypeFilter } from './filterUtils';
import { TRANSLATE_LANGS } from '../../../shared/types';
import type { MergedPlugin } from '../../../shared/types';
import { usePluginData } from './hooks/usePluginData';
import { usePluginFilters } from './hooks/usePluginFilters';
import { usePluginOperations } from './hooks/usePluginOperations';
import { useTranslation } from './hooks/useTranslation';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { findConflicts } from './dependencyUtils';
import type { ResourceConflict } from './dependencyUtils';

/**
 * Plugin 管理頁面。
 * Search bar 過濾，按 marketplace 分 N 個 section，組內按名稱排序。
 */
export function PluginPage(): React.ReactElement {
  const { t } = useI18n();

  const CONTENT_TYPE_LABELS: Record<ContentTypeFilter, string> = {
    commands: t('filter.commands'),
    skills: t('filter.skills'),
    agents: t('filter.agents'),
    mcp: t('filter.mcp'),
  };

  const PLUGIN_SORT_OPTIONS = [
    { value: 'name' as const, label: t('filter.sortName') },
    { value: 'lastUpdated' as const, label: t('filter.sortLastUpdated') },
  ];

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
    retryTranslate,
  } = useTranslation(plugins);

  /** 預計算 per-plugin conflict 映射 */
  const conflictsByPlugin = useMemo(() => {
    const allConflicts = findConflicts(plugins);
    const map = new Map<string, ResourceConflict[]>();
    for (const c of allConflicts) {
      for (const pid of c.pluginIds) {
        const existing = map.get(pid);
        if (existing) existing.push(c);
        else map.set(pid, [c]);
      }
    }
    return map;
  }, [plugins]);

  /** 預計算 per-section 統計（enabledCount / updateCount / allEnabled） */
  const sectionStats = useMemo(() => {
    const map = new Map<string, { enabledCount: number; updateCount: number; allEnabled: boolean }>();
    for (const section of groupedSections) {
      for (const [marketplace, items] of section.groups) {
        if (items.length > 0) {
          map.set(marketplace, {
            enabledCount: items.filter(isPluginEnabled).length,
            updateCount: items.filter(hasPluginUpdate).length,
            allEnabled: items.every(isPluginEnabled),
          });
        }
      }
    }
    return map;
  }, [groupedSections]);

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

  const [draggedMarketplace, setDraggedMarketplace] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<number | 'new' | null>(null);

  /** 渲染單一 marketplace section */
  const renderSection = (marketplace: string, items: MergedPlugin[]) => {
    const isCollapsed = !filterEnabled && !debouncedSearch && contentTypeFilters.size === 0 && !expanded.has(marketplace);
    const stats = sectionStats.get(marketplace) ?? { enabledCount: 0, updateCount: 0, allEnabled: false };
    const mpBulk = bulkProgress.get(marketplace);
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
            <span className="section-count">{stats.enabledCount} / {items.length}</span>
            {stats.updateCount > 0 && (
              <span className="section-updates">{t(stats.updateCount > 1 ? 'plugin.section.updatesPlural' : 'plugin.section.updates', { count: stats.updateCount })}</span>
            )}
            {marketplaceSources[marketplace] && (
              <span className="section-source">{marketplaceSources[marketplace]}</span>
            )}
          </button>
          <div
            className={`section-drag-handle${isCollapsed ? '' : ' section-drag-handle--expanded'}`}
            draggable
            title={t('plugin.section.dragHandle')}
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', marketplace);
              setDraggedMarketplace(marketplace);
            }}
            onDragEnd={() => { setDraggedMarketplace(null); setDragOverSectionId(null); }}
          >
            ⠿
          </div>
          <button
            className={`section-bulk-btn${isCollapsed ? '' : ' section-bulk-btn--expanded'}`}
            disabled={!!mpBulk || isUpdatingAll}
            onClick={() => stats.allEnabled
              ? handleBulkDisable(marketplace, items)
              : setPendingBulkEnable({ marketplace, items })}
          >
            {mpBulk
              ? t(mpBulk.action === 'enable' ? 'plugin.section.enabling' : 'plugin.section.disabling', { current: mpBulk.current, total: mpBulk.total })
              : stats.allEnabled ? t('plugin.section.disableAll') : t('plugin.section.enableAll')}
          </button>
        </div>
        <div className={`section-body${isCollapsed ? ' section-body--collapsed' : ''}`}>
          <div className="section-body-inner">
            <VirtualCardList
              items={items}
              keyExtractor={(plugin) => plugin.id}
              className="card-list"
              renderItem={(plugin) => (
                <PluginCard
                  plugin={plugin}
                  workspaceName={workspaceFolders[0]?.name}
                  marketplaceUrl={plugin.marketplaceName ? marketplaceSources[plugin.marketplaceName] : undefined}
                  translations={translations}
                  translateStatus={translateStatusMap.get(plugin.id)}
                  loadingScopes={loadingPlugins.get(plugin.id)}
                  conflicts={conflictsByPlugin.get(plugin.id)}
                  onToggle={handleToggle}
                  onUpdate={handleUpdate}
                />
              )}
            />
          </div>
        </div>
      </div>
    );
  };

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    searchInputRef,
    onSearchClear: () => { setSearch(''); flushSearch(''); },
    cardSelector: '.card[tabindex]',
  });

  /** 總可見 plugin 數（用於空狀態判斷） */
  const totalVisiblePlugins = groupedSections.reduce((total, s) => {
    return total + [...s.groups.values()].reduce((sum, items) => sum + items.length, 0);
  }, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">{t('plugin.page.title')}</div>
        <div className="page-actions">
          {hasInstalledPlugins && (
            <button
              className="btn btn-secondary"
              onClick={handleUpdateAll}
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
        </div>
      </div>

      <div className="search-row">
        <div className="search-input-wrapper">
          <input
            ref={searchInputRef}
            className="input search-bar"
            type="text"
            placeholder={t('plugin.page.searchPlaceholder')}
            aria-label={t('plugin.page.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              aria-label={t('plugin.page.clearSearch')}
              onClick={() => { setSearch(''); flushSearch(''); }}
            >
              &#x2715;
            </button>
          )}
        </div>
        <button
          className="btn btn-secondary translate-btn"
          onClick={() => { setDraftEmail(translateEmail); setDraftLang(translateLang); setDialogOpen(true); }}
          disabled={queuedTexts.size > 0 || activeTexts.size > 0}
        >
          {translateLang ? TRANSLATE_LANGS[translateLang] ?? translateLang : t('plugin.page.translate')}
        </button>
      </div>

      <div className="filter-chips">
        <button
          className={`filter-chip${filterEnabled ? ' filter-chip--active' : ''}`}
          onClick={() => setFilterEnabled((v) => !v)}
        >
          {t('plugin.page.filterEnabled')}
        </button>
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
        <span className="filter-separator" aria-hidden="true" />
        {PLUGIN_SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`filter-chip${sortBy === opt.value ? ' filter-chip--active' : ''}`}
            aria-pressed={sortBy === opt.value}
            onClick={() => setSortBy(opt.value)}
          >
            {opt.label}
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
              onClick={handleUpdateAll}
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
          message={translateWarning}
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

      {loading ? (
        <PluginCardSkeleton />
      ) : totalVisiblePlugins === 0 ? (
        debouncedSearch || filterEnabled || contentTypeFilters.size > 0 ? (
          <EmptyState
            icon={<NoResultsIcon />}
            title={t('plugin.page.noResults')}
            action={{
              label: t('plugin.page.clearFilters'),
              onClick: () => {
                setSearch('');
                flushSearch('');
                setFilterEnabled(false);
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
        <>
          {/* Section 0 — 預設區 */}
          <div
            className={`sections-container${dragOverSectionId === 0 && draggedMarketplace !== null ? ' sections-container--drag-over' : ''}`}
            onDragOver={(e) => {
              if (draggedMarketplace) {
                e.preventDefault();
                setDragOverSectionId(0);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverSectionId(null);
              }
            }}
            onDrop={(e) => {
              const mp = e.dataTransfer.getData('text/plain');
              if (mp) {
                e.preventDefault();
                moveToSection(mp, 0);
              }
              setDragOverSectionId(null);
              setDraggedMarketplace(null);
            }}
          >
            {groupedSections[0].groups.size === 0 ? (
              <div className={`sections-drop-zone${dragOverSectionId === 0 ? ' sections-drop-zone--drag-over' : ''}`}>
                {t('plugin.section.emptyHint')}
              </div>
            ) : (
              [...groupedSections[0].groups.entries()].map(([marketplace, items]) => renderSection(marketplace, items))
            )}
          </div>

          {/* 動態 section N（N >= 1） */}
          {groupedSections.slice(1).map((section) => (
            <React.Fragment key={section.id}>
              <div className="section-divider-header">
                <span className="section-divider-label">{t('plugin.section.label', { n: section.id })}</span>
                <span className="section-divider-line" />
              </div>
              <div
                className={`sections-container${dragOverSectionId === section.id && draggedMarketplace !== null ? ' sections-container--drag-over' : ''}`}
                onDragOver={(e) => {
                  if (draggedMarketplace) {
                    e.preventDefault();
                    setDragOverSectionId(section.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverSectionId(null);
                  }
                }}
                onDrop={(e) => {
                  const mp = e.dataTransfer.getData('text/plain');
                  if (mp) {
                    e.preventDefault();
                    moveToSection(mp, section.id);
                  }
                  setDragOverSectionId(null);
                  setDraggedMarketplace(null);
                }}
              >
                {[...section.groups.values()].every((items) => items.length === 0) ? (
                  <div className={`sections-drop-zone${dragOverSectionId === section.id ? ' sections-drop-zone--drag-over' : ''}`}>
                    {t('plugin.section.emptyHint')}
                  </div>
                ) : (
                  [...section.groups.entries()]
                    .filter(([, items]) => items.length > 0)
                    .map(([marketplace, items]) => renderSection(marketplace, items))
                )}
              </div>
            </React.Fragment>
          ))}

          {/* 新增 section 分隔線 + drop zone */}
          <div className="section-divider-header">
            <span className="section-divider-line" />
          </div>
          <div
            className={`sections-add-zone${dragOverSectionId === 'new' ? ' sections-add-zone--drag-over' : ''}`}
            onDragOver={(e) => {
              if (draggedMarketplace) {
                e.preventDefault();
                setDragOverSectionId('new');
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverSectionId(null);
              }
            }}
            onDrop={(e) => {
              const mp = e.dataTransfer.getData('text/plain');
              if (mp) {
                e.preventDefault();
                createSection(mp);
              }
              setDragOverSectionId(null);
              setDraggedMarketplace(null);
            }}
          >
            {t('plugin.section.addHint')}
          </div>
        </>
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
