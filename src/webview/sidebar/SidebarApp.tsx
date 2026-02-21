import React, { useState, useEffect, useCallback } from 'react';
import { postMessage, sendRequest, onPushMessage } from '../vscode';
import type { Marketplace, PluginListResponse, McpServer } from '../../shared/types';

interface CategoryButton {
  id: keyof Counts;
  label: string;
  icon: string;
  description: string;
}

const CATEGORIES: CategoryButton[] = [
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: '🏪',
    description: 'Manage plugin sources',
  },
  {
    id: 'plugin',
    label: 'Plugins',
    icon: '🔌',
    description: 'Install, enable, and configure plugins',
  },
  {
    id: 'mcp',
    label: 'MCP Servers',
    icon: '⚡',
    description: 'Manage MCP server connections',
  },
];

interface Counts {
  marketplace: number;
  plugin: number;
  mcp: number;
}

/** Sidebar：三個分類按鈕，點擊打開對應 Editor 頁面 */
export function SidebarApp(): React.ReactElement {
  const [counts, setCounts] = useState<Counts | null>(null);

  const fetchCounts = useCallback(async () => {
    const [mktResult, pluginResult, mcpResult] = await Promise.allSettled([
      sendRequest<Marketplace[]>({ type: 'marketplace.list' }),
      sendRequest<PluginListResponse>({ type: 'plugin.listInstalled' }),
      sendRequest<McpServer[]>({ type: 'mcp.list' }),
    ]);
    setCounts((prev) => ({
      marketplace: mktResult.status === 'fulfilled' ? mktResult.value.length : (prev?.marketplace ?? 0),
      plugin: pluginResult.status === 'fulfilled' ? pluginResult.value.installed.length : (prev?.plugin ?? 0),
      mcp: mcpResult.status === 'fulfilled' ? mcpResult.value.length : (prev?.mcp ?? 0),
    }));
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

  const getCount = (id: keyof Counts): number => {
    if (!counts) return 0;
    return counts[id] ?? 0;
  };

  return (
    <div className="sidebar-container">
      <div className="sidebar-buttons">
        {CATEGORIES.map((cat) => {
          const count = getCount(cat.id);
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
                  {count > 0 && <span className="sidebar-button-badge">{count}</span>}
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
