import React, { useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { CardSection } from '../../components/CardSection';
import { PluginCard } from './PluginCard';
import { VirtualCardList } from './VirtualCardList';
import { getSectionName, getVisibleItems } from './filterUtils';
import type { Marketplace, MergedPlugin, PluginContentItem, PluginScope } from '../../../shared/types';
import type { WorkspaceFolder } from './hooks/usePluginData';
import { useSectionDrop } from './hooks/useSectionDrop';

function formatMarketplaceSource(source: string): string {
  const match = source.match(/github\.com\/([^/]+\/[^/.]+)/);
  return match ? match[1] : source;
}

interface SectionStats {
  enabledCount: number;
  updateCount: number;
  allEnabled: boolean;
  hiddenCount: number;
  visibleCount: number;
}

export interface PluginSectionsProps {
  groupedSections: { id: number; groups: Map<string, MergedPlugin[]> }[];
  sectionNames: Record<number, string> | undefined;
  sectionStats: Map<string, SectionStats>;
  isUpdatingAll: boolean;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  hiddenPlugins: ReadonlySet<string>;
  showHidden: boolean;
  workspaceFolders: WorkspaceFolder[];
  marketplaceSources: Record<string, string>;
  translations: Record<string, string>;
  translateStatusMap: Map<string, 'translating' | 'queued'>;
  loadingPlugins: Map<string, Set<PluginScope>>;
  onToggle: (pluginId: string, scope: PluginScope, enable: boolean) => Promise<void>;
  onUpdate: (pluginId: string, scopes: PluginScope[]) => Promise<void>;
  onToggleHidden: (pluginId: string) => void;
  onViewContent?: (item: PluginContentItem) => void;
  onInstallOnly?: (pluginId: string) => void;
  installOnlyId?: string | null;
  moveToSection: (marketplace: string, sectionId: number) => void;
  createSection: (marketplace: string) => void;
  reorderSection: (sectionId: number, toIndex: number) => void;
  renameSection: (sectionId: number, name: string) => void;
  // Marketplace actions
  marketplaces: Marketplace[];
  marketplaceUpdating: string | null;
  onMarketplaceUpdate: (name: string) => void;
  onMarketplaceRemove: (name: string) => void;
  onMarketplaceToggleAutoUpdate: (name: string) => void;
}

interface SectionDropContainerProps {
  sectionId: number | 'new';
  draggedMarketplace: string | null;
  setDragOverSectionId: React.Dispatch<React.SetStateAction<number | 'new' | null>>;
  setDraggedMarketplace: React.Dispatch<React.SetStateAction<string | null>>;
  onDrop: (marketplace: string) => void;
  className: string;
  children: React.ReactNode;
}

function SectionDropContainer({
  sectionId,
  draggedMarketplace,
  setDragOverSectionId,
  setDraggedMarketplace,
  onDrop,
  className,
  children,
}: SectionDropContainerProps): React.ReactElement {
  const handlers = useSectionDrop({
    sectionId,
    draggedMarketplace,
    setDragOverSectionId,
    setDraggedMarketplace,
    onDrop,
  });
  return (
    <div className={className} {...handlers}>
      {children}
    </div>
  );
}

export function PluginSections({
  groupedSections,
  sectionNames,
  sectionStats,
  isUpdatingAll,
  expanded,
  setExpanded,
  hiddenPlugins,
  showHidden,
  workspaceFolders,
  marketplaceSources,
  translations,
  translateStatusMap,
  loadingPlugins,
  onToggle,
  onUpdate,
  onToggleHidden,
  onViewContent,
  onInstallOnly,
  installOnlyId,
  moveToSection,
  createSection,
  reorderSection,
  renameSection,
  marketplaces,
  marketplaceUpdating,
  onMarketplaceUpdate,
  onMarketplaceRemove,
  onMarketplaceToggleAutoUpdate,
}: PluginSectionsProps): React.ReactElement {
  const { t } = useI18n();

  // 全域正在操作的 scope set（跨 plugin，防 concurrent CLI writes）
  const globalLoadingScopes = useMemo(() => {
    const scopes = new Set<PluginScope>();
    for (const scopeSet of loadingPlugins.values()) {
      for (const s of scopeSet) scopes.add(s);
    }
    return scopes;
  }, [loadingPlugins]);

  const [draggedMarketplace, setDraggedMarketplace] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<number | 'new' | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<number | null>(null);
  const [dragOverDividerId, setDragOverDividerId] = useState<number | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const editingCommitRef = useRef(false);

  const section0Drop = useSectionDrop({
    sectionId: 0,
    draggedMarketplace,
    setDragOverSectionId,
    setDraggedMarketplace,
    onDrop: (mp) => moveToSection(mp, 0),
  });

  const addZoneDrop = useSectionDrop({
    sectionId: 'new',
    draggedMarketplace,
    setDragOverSectionId,
    setDraggedMarketplace,
    onDrop: createSection,
  });

  const startSectionRename = (sectionId: number) => {
    setEditingName(getSectionName(sectionId, sectionNames, t('plugin.section.label', { n: sectionId })));
    setEditingSectionId(sectionId);
  };

  const renderSection = (marketplace: string, items: MergedPlugin[]) => {
    const visibleItems = getVisibleItems(items, hiddenPlugins, showHidden);
    const isCollapsed = !expanded.has(marketplace);
    const stats = sectionStats.get(marketplace) ?? { enabledCount: 0, updateCount: 0, allEnabled: false, hiddenCount: 0, visibleCount: 0 };
    const mpData = marketplaces.find((m) => m.name === marketplace);
    const isUpdating = marketplaceUpdating === marketplace;
    return (
      <CardSection
        key={marketplace}
        variant="collapsible"
        title={marketplace}
        count={
          <>
            {stats.enabledCount} / {stats.visibleCount}
            {stats.hiddenCount > 0 && ` (${t('plugin.section.hiddenCount', { count: stats.hiddenCount })})`}
          </>
        }
        extra={
          <>
            {stats.updateCount > 0 && (
              <span className="section-updates">{t(stats.updateCount > 1 ? 'plugin.section.updatesPlural' : 'plugin.section.updates', { count: stats.updateCount })}</span>
            )}
            {marketplaceSources[marketplace] && (
              <span className="section-source">{formatMarketplaceSource(marketplaceSources[marketplace])}</span>
            )}
          </>
        }
        isCollapsed={isCollapsed}
        onToggle={() => setExpanded((prev) => {
          const next = new Set(prev);
          if (next.has(marketplace)) next.delete(marketplace);
          else next.add(marketplace);
          return next;
        })}
        headerActions={mpData ? (
          <div className="section-marketplace-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={mpData.autoUpdate}
                onChange={() => onMarketplaceToggleAutoUpdate(marketplace)}
              />
              {t('marketplace.card.autoUpdate')}
            </label>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onMarketplaceUpdate(marketplace)}
              disabled={isUpdating || isUpdatingAll}
            >
              {isUpdating ? t('marketplace.card.updating') : t('marketplace.card.update')}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onMarketplaceRemove(marketplace)}
            >
              {t('marketplace.card.remove')}
            </button>
          </div>
        ) : undefined}
        headerProps={{
          draggable: true,
          title: t('plugin.section.dragHandle'),
          onDragStart: (e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', marketplace);
            setDraggedMarketplace(marketplace);
          },
          onDragEnd: () => { setDraggedMarketplace(null); setDragOverSectionId(null); },
        }}
      >
        <VirtualCardList
          items={visibleItems}
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
              globalLoadingScopes={globalLoadingScopes}
              hidden={hiddenPlugins.has(plugin.id)}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onToggleHidden={onToggleHidden}
              onViewContent={onViewContent}
              onInstallOnly={onInstallOnly}
              installOnlyLoading={installOnlyId === plugin.id}
            />
          )}
        />
      </CardSection>
    );
  };

  return (
    <>
      {/* Section 0 — 預設區 */}
      <div
        className={`sections-container${dragOverSectionId === 0 && draggedMarketplace !== null ? ' sections-container--drag-over' : ''}`}
        {...section0Drop}
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
      {groupedSections.slice(1).map((section, index) => (
        <React.Fragment key={section.id}>
          <div
            className={`section-divider-header${dragOverDividerId === section.id && draggedSectionId !== null && draggedSectionId !== section.id ? ' section-divider-header--drag-over' : ''}`}
            draggable={groupedSections.length > 2}
            title={groupedSections.length > 2 ? t('plugin.section.dragHandle') : undefined}
            onDragStart={(e) => {
              if (groupedSections.length <= 2) return;
              e.stopPropagation();
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/x-section-order', String(section.id));
              setDraggedSectionId(section.id);
            }}
            onDragEnd={() => { setDraggedSectionId(null); setDragOverDividerId(null); }}
            onDragOver={(e) => {
              if (draggedSectionId !== null && draggedSectionId !== section.id) {
                e.preventDefault();
                setDragOverDividerId(section.id);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverDividerId(null);
              }
            }}
            onDrop={(e) => {
              if (draggedSectionId !== null && draggedSectionId !== section.id) {
                e.preventDefault();
                reorderSection(draggedSectionId, index);
              }
              setDragOverDividerId(null);
              setDraggedSectionId(null);
            }}
          >
            {editingSectionId === section.id ? (
              <input
                className="section-divider-label section-divider-label--editing"
                value={editingName}
                autoFocus
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    editingCommitRef.current = true;
                    renameSection(section.id, editingName);
                    setEditingSectionId(null);
                  } else if (e.key === 'Escape') {
                    editingCommitRef.current = true;
                    setEditingSectionId(null);
                  }
                }}
                onBlur={() => {
                  if (editingCommitRef.current) {
                    editingCommitRef.current = false;
                    return;
                  }
                  renameSection(section.id, editingName);
                  setEditingSectionId(null);
                }}
              />
            ) : (
              <span
                className="section-divider-label section-divider-label--clickable"
                onClick={() => startSectionRename(section.id)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  startSectionRename(section.id);
                }}
                role="button"
                tabIndex={0}
              >
                {getSectionName(section.id, sectionNames, t('plugin.section.label', { n: section.id }))}
              </span>
            )}
            <span className="section-divider-line" />
          </div>
          <SectionDropContainer
            sectionId={section.id}
            draggedMarketplace={draggedMarketplace}
            setDragOverSectionId={setDragOverSectionId}
            setDraggedMarketplace={setDraggedMarketplace}
            onDrop={(mp) => moveToSection(mp, section.id)}
            className={`sections-container${dragOverSectionId === section.id && draggedMarketplace !== null ? ' sections-container--drag-over' : ''}`}
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
          </SectionDropContainer>
        </React.Fragment>
      ))}

      {/* 新增 section 分隔線 + drop zone */}
      <div className="section-divider-header">
        <span className="section-divider-line" />
      </div>
      <div
        className={`sections-add-zone${dragOverSectionId === 'new' ? ' sections-add-zone--drag-over' : ''}`}
        {...addZoneDrop}
      >
        {t('plugin.section.addHint')}
      </div>
    </>
  );
}
