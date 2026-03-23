import React, { useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { CollapsibleSection } from '../../components/CollapsibleSection';
import { PluginCard } from './PluginCard';
import { VirtualCardList } from './VirtualCardList';
import { getSectionName, getVisibleItems } from './filterUtils';
import type { ContentTypeFilter } from './filterUtils';
import type { MergedPlugin, PluginScope } from '../../../shared/types';
import type { WorkspaceFolder } from './hooks/usePluginData';

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
  bulkProgress: Map<string, { action: 'enable' | 'disable'; current: number; total: number }>;
  isUpdatingAll: boolean;
  filterEnabled: boolean;
  debouncedSearch: string;
  contentTypeFilters: Set<ContentTypeFilter>;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  hiddenPlugins: ReadonlySet<string>;
  showHidden: boolean;
  workspaceFolders: WorkspaceFolder[];
  marketplaceSources: Record<string, string>;
  translations: Record<string, string>;
  translateStatusMap: Map<string, 'translating' | 'queued'>;
  loadingPlugins: Map<string, Set<PluginScope>>;
  onBulkDisable: (marketplace: string, items: MergedPlugin[]) => void;
  onPendingBulkEnable: (value: { marketplace: string; items: MergedPlugin[] }) => void;
  onToggle: (pluginId: string, scope: PluginScope, enable: boolean) => Promise<void>;
  onUpdate: (pluginId: string, scopes: PluginScope[]) => Promise<void>;
  onToggleHidden: (pluginId: string) => void;
  moveToSection: (marketplace: string, sectionId: number) => void;
  createSection: (marketplace: string) => void;
  reorderSection: (sectionId: number, toIndex: number) => void;
  renameSection: (sectionId: number, name: string) => void;
}

export function PluginSections({
  groupedSections,
  sectionNames,
  sectionStats,
  bulkProgress,
  isUpdatingAll,
  filterEnabled,
  debouncedSearch,
  contentTypeFilters,
  expanded,
  setExpanded,
  hiddenPlugins,
  showHidden,
  workspaceFolders,
  marketplaceSources,
  translations,
  translateStatusMap,
  loadingPlugins,
  onBulkDisable,
  onPendingBulkEnable,
  onToggle,
  onUpdate,
  onToggleHidden,
  moveToSection,
  createSection,
  reorderSection,
  renameSection,
}: PluginSectionsProps): React.ReactElement {
  const { t } = useI18n();

  const [draggedMarketplace, setDraggedMarketplace] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<number | 'new' | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<number | null>(null);
  const [dragOverDividerId, setDragOverDividerId] = useState<number | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const editingCommitRef = useRef(false);

  const startSectionRename = (sectionId: number) => {
    setEditingName(getSectionName(sectionId, sectionNames, t('plugin.section.label', { n: sectionId })));
    setEditingSectionId(sectionId);
  };

  const renderSection = (marketplace: string, items: MergedPlugin[]) => {
    const visibleItems = getVisibleItems(items, hiddenPlugins, showHidden);
    const isCollapsed = !filterEnabled && !debouncedSearch && contentTypeFilters.size === 0 && !expanded.has(marketplace);
    const stats = sectionStats.get(marketplace) ?? { enabledCount: 0, updateCount: 0, allEnabled: false, hiddenCount: 0, visibleCount: 0 };
    const mpBulk = bulkProgress.get(marketplace);
    return (
      <CollapsibleSection
        key={marketplace}
        label={marketplace}
        badge={
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
              <span className="section-source">{marketplaceSources[marketplace]}</span>
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
        headerActions={
          <button
            className={`section-bulk-btn${isCollapsed ? '' : ' section-bulk-btn--expanded'}`}
            disabled={!!mpBulk || isUpdatingAll}
            onClick={(e) => {
              e.stopPropagation();
              if (stats.allEnabled) onBulkDisable(marketplace, visibleItems);
              else onPendingBulkEnable({ marketplace, items: visibleItems });
            }}
          >
            {mpBulk
              ? t(mpBulk.action === 'enable' ? 'plugin.section.enabling' : 'plugin.section.disabling', { current: mpBulk.current, total: mpBulk.total })
              : stats.allEnabled ? t('plugin.section.disableAll') : t('plugin.section.enableAll')}
          </button>
        }
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
              hidden={hiddenPlugins.has(plugin.id)}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onToggleHidden={onToggleHidden}
            />
          )}
        />
      </CollapsibleSection>
    );
  };

  return (
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
  );
}
