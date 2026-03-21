import React, { useState, useEffect, useCallback } from 'react';
import { postMessage, sendRequest, onPushMessage } from '../vscode';
import { mergePlugins } from '../editor/plugin/hooks/usePluginData';
import { hasPluginUpdate, isPluginEnabled } from '../editor/plugin/filterUtils';
import type { PluginListResponse, McpServer } from '../../shared/types';
import { useI18n } from '../i18n/I18nContext';

type CategoryId = 'marketplace' | 'plugin' | 'mcp' | 'skill' | 'settings' | 'info';

/** Badge 只顯示需要注意的數量（可更新 / 有問題） */
interface AttentionCounts {
  pluginUpdates: number;
  mcpIssues: number;
}

function countMcpIssues(servers: McpServer[]): number {
  return servers.filter((s) => s.status === 'failed' || s.status === 'needs-auth').length;
}

/** Sidebar：分類按鈕，點擊打開對應 Editor 頁面 */
export function SidebarApp(): React.ReactElement {
  const { t } = useI18n();
  const [attention, setAttention] = useState<AttentionCounts | null>(null);

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
  ];

  const fetchAttention = useCallback(async () => {
    const [pluginResult, mcpResult] = await Promise.allSettled([
      sendRequest<PluginListResponse>({ type: 'plugin.listAvailable' }),
      sendRequest<McpServer[]>({ type: 'mcp.list' }),
    ]);
    let pluginUpdates = 0;
    if (pluginResult.status === 'fulfilled') {
      const { installed, available } = pluginResult.value;
      const merged = mergePlugins(installed, available);
      pluginUpdates = merged.filter((p) => isPluginEnabled(p) && hasPluginUpdate(p)).length;
    }
    let mcpIssues = 0;
    if (mcpResult.status === 'fulfilled') {
      mcpIssues = countMcpIssues(mcpResult.value);
    }
    setAttention((prev) => ({
      pluginUpdates: pluginResult.status === 'fulfilled' ? pluginUpdates : (prev?.pluginUpdates ?? 0),
      mcpIssues: mcpResult.status === 'fulfilled' ? mcpIssues : (prev?.mcpIssues ?? 0),
    }));
  }, []);

  useEffect(() => {
    fetchAttention();
  }, [fetchAttention]);

  useEffect(() => {
    return onPushMessage((msg) => {
      if (msg.type === 'marketplace.refresh' || msg.type === 'plugin.refresh') {
        fetchAttention();
      } else if (msg.type === 'mcp.statusUpdate' && Array.isArray(msg.servers)) {
        const issues = countMcpIssues(msg.servers as McpServer[]);
        setAttention((prev) => prev
          ? { ...prev, mcpIssues: issues }
          : { pluginUpdates: 0, mcpIssues: issues },
        );
      }
    });
  }, [fetchAttention]);

  const handleClick = (category: string): void => {
    postMessage({ type: 'sidebar.openCategory', category });
  };

  const getBadgeCount = (id: CategoryId): number => {
    if (!attention) return 0;
    if (id === 'plugin') return attention.pluginUpdates;
    if (id === 'mcp') return attention.mcpIssues;
    return 0;
  };

  return (
    <div className="sidebar-container">
      <div className="sidebar-buttons">
        {categories.map((cat) => {
          const badgeCount = getBadgeCount(cat.id);
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
                  {badgeCount > 0 && <span className="sidebar-update-badge">{badgeCount}</span>}
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
