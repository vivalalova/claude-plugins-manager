import { useMemo } from 'react';
import type { MergedPlugin } from '../../../../shared/types';
import { getVisibleItems, hasPluginUpdate, isPluginEnabled } from '../filterUtils';
import { getCardTranslateStatus } from '../translateUtils';

export interface PluginPageGroupedSection {
  id: number;
  groups: Map<string, MergedPlugin[]>;
}

export interface PluginSectionStats {
  enabledCount: number;
  updateCount: number;
  allEnabled: boolean;
  hiddenCount: number;
  visibleCount: number;
}

interface UsePluginPageViewStateOptions {
  groupedSections: PluginPageGroupedSection[];
  hiddenPlugins: ReadonlySet<string>;
  showHidden: boolean;
  translateLang: string;
  activeTexts: Set<string>;
  queuedTexts: Set<string>;
}

export function usePluginPageViewState({
  groupedSections,
  hiddenPlugins,
  showHidden,
  translateLang,
  activeTexts,
  queuedTexts,
}: UsePluginPageViewStateOptions): {
  sectionStats: Map<string, PluginSectionStats>;
  translateStatusMap: Map<string, 'translating' | 'queued'>;
  visiblePlugins: MergedPlugin[];
  totalVisiblePlugins: number;
} {
  const sectionStats = useMemo(() => {
    const map = new Map<string, PluginSectionStats>();

    for (const section of groupedSections) {
      for (const [marketplace, items] of section.groups) {
        if (items.length === 0) {
          continue;
        }

        const visible = getVisibleItems(items, hiddenPlugins, showHidden);
        let enabledCount = 0;
        let updateCount = 0;
        let allEnabled = true;

        for (const plugin of visible) {
          const enabled = isPluginEnabled(plugin);
          if (enabled) {
            enabledCount++;
            if (hasPluginUpdate(plugin)) {
              updateCount++;
            }
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

    return map;
  }, [groupedSections, hiddenPlugins, showHidden]);

  const translateStatusMap = useMemo(() => {
    const map = new Map<string, 'translating' | 'queued'>();
    if (!translateLang) {
      return map;
    }

    for (const section of groupedSections) {
      for (const items of section.groups.values()) {
        for (const plugin of items) {
          const status = getCardTranslateStatus(plugin, translateLang, activeTexts, queuedTexts);
          if (status) {
            map.set(plugin.id, status);
          }
        }
      }
    }

    return map;
  }, [groupedSections, translateLang, activeTexts, queuedTexts]);

  const visiblePlugins = useMemo(() => {
    const result: MergedPlugin[] = [];

    for (const section of groupedSections) {
      for (const items of section.groups.values()) {
        result.push(...getVisibleItems(items, hiddenPlugins, showHidden));
      }
    }

    return result;
  }, [groupedSections, hiddenPlugins, showHidden]);

  const totalVisiblePlugins = useMemo(() => {
    let total = 0;
    for (const stats of sectionStats.values()) {
      total += stats.visibleCount;
    }
    return total;
  }, [sectionStats]);

  return {
    sectionStats,
    translateStatusMap,
    visiblePlugins,
    totalVisiblePlugins,
  };
}
