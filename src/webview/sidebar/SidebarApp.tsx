import React from 'react';
import { postMessage } from '../vscode';

interface CategoryButton {
  id: string;
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

/** Sidebar：三個分類按鈕，點擊打開對應 Editor 頁面 */
export function SidebarApp(): React.ReactElement {
  const handleClick = (category: string): void => {
    postMessage({ type: 'sidebar.openCategory', category });
  };

  return (
    <div className="sidebar-container">
      <div className="sidebar-buttons">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className="sidebar-button"
            onClick={() => handleClick(cat.id)}
            title={cat.description}
          >
            <span className="sidebar-button-icon">{cat.icon}</span>
            <div className="sidebar-button-text">
              <span className="sidebar-button-label">{cat.label}</span>
              <span className="sidebar-button-desc">{cat.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
