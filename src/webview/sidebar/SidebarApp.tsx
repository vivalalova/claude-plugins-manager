import React, { useState, useEffect, useCallback } from 'react';
import { postMessage, sendRequest, onPushMessage } from '../vscode';
import { mergePlugins } from '../editor/plugin/hooks/usePluginData';
import { hasPluginUpdate, isPluginEnabled } from '../editor/plugin/filterUtils';
import type { Marketplace, PluginListResponse, McpServer } from '../../shared/types';
import { useI18n } from '../i18n/I18nContext';

type CategoryId = 'marketplace' | 'plugin' | 'mcp' | 'settings' | 'info';

interface Counts {
  marketplace: number;
  plugin: number;
  mcp: number;
}

/** Sidebar：三個分類按鈕，點擊打開對應 Editor 頁面 */
export function SidebarApp(): React.ReactElement {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [pluginUpdates, setPluginUpdates] = useState(0);

  const categories = [
    {
      id: 'marketplace' as CategoryId,
      label: t('sidebar.marketplace'),
      icon: '🏪',
      description: t('sidebar.marketplace.desc'),
    },
    {
      id: 'plugin' as CategoryId,
      label: t('sidebar.plugins'),
      icon: '🔌',
      description: t('sidebar.plugins.desc'),
    },
    {
      id: 'mcp' as CategoryId,
      label: t('sidebar.mcp'),
      icon: '⚡',
      description: t('sidebar.mcp.desc'),
    },
    {
      id: 'settings' as CategoryId,
      label: t('sidebar.settings'),
      icon: '⚙️',
      description: t('sidebar.settings.desc'),
    },
    {
      id: 'info' as CategoryId,
      label: t('sidebar.info'),
      icon: 'ℹ️',
      description: t('sidebar.info.desc'),
    },
  ];

  const fetchCounts = useCallback(async () => {
    const [mktResult, pluginResult, mcpResult] = await Promise.allSettled([
      sendRequest<Marketplace[]>({ type: 'marketplace.list' }),
      sendRequest<PluginListResponse>({ type: 'plugin.listAvailable' }),
      sendRequest<McpServer[]>({ type: 'mcp.list' }),
    ]);
    let pluginCount = 0;
    let updateCount = 0;
    if (pluginResult.status === 'fulfilled') {
      const { installed, available } = pluginResult.value;
      pluginCount = installed.length;
      const merged = mergePlugins(installed, available);
      updateCount = merged.filter((p) => isPluginEnabled(p) && hasPluginUpdate(p)).length;
    }
    setCounts((prev) => ({
      marketplace: mktResult.status === 'fulfilled' ? mktResult.value.length : (prev?.marketplace ?? 0),
      plugin: pluginResult.status === 'fulfilled' ? pluginCount : (prev?.plugin ?? 0),
      mcp: mcpResult.status === 'fulfilled' ? mcpResult.value.length : (prev?.mcp ?? 0),
    }));
    if (pluginResult.status === 'fulfilled') {
      setPluginUpdates(updateCount);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    return onPushMessage((msg) => {
      if (msg.type === 'marketplace.refresh' || msg.type === 'plugin.refresh') {
        fetchCounts();
      } else if (msg.type === 'mcp.statusUpdate' && Array.isArray(msg.servers)) {
        const mcpCount = (msg.servers as McpServer[]).length;
        setCounts((prev) => prev
          ? { ...prev, mcp: mcpCount }
          : { marketplace: 0, plugin: 0, mcp: mcpCount },
        );
      }
    });
  }, [fetchCounts]);

  const handleClick = (category: string): void => {
    postMessage({ type: 'sidebar.openCategory', category });
  };

  const getCount = (id: CategoryId): number => {
    if (!counts || id === 'settings' || id === 'info') return 0;
    return counts[id] ?? 0;
  };

  return (
    <div className="sidebar-container">
      <div className="sidebar-buttons">
        {categories.map((cat) => {
          const count = getCount(cat.id);
          const updates = cat.id === 'plugin' ? pluginUpdates : 0;
          return (
            <button
              key={cat.id}
              className="sidebar-button"
              onClick={() => handleClick(cat.id)}
              title={cat.description}
            >
              <span className="sidebar-button-icon">{cat.icon}</span>
              <div className="sidebar-button-text">
                <span className="sidebar-button-label">
                  {cat.label}
                  {updates > 0
                    ? <span className="sidebar-update-badge">{updates}</span>
                    : count > 0 && <span className="sidebar-button-badge">{count}</span>}
                </span>
                <span className="sidebar-button-desc">{cat.description}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
