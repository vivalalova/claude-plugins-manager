import React, { useEffect, useState } from 'react';
import { MarketplacePage } from './marketplace/MarketplacePage';
import { PluginPage } from './plugin/PluginPage';
import { McpPage } from './mcp/McpPage';
import { SettingsGridPage } from './settings/grid/SettingsGridPage';
import { InfoPage } from './info/InfoPage';
import { SkillsPage } from './skill/SkillsPage';

interface EditorAppProps {
  mode: string;
}

/** Editor 頁面路由，依 mode 渲染對應管理頁面，支援 navigate message 切換 */
export function EditorApp({ mode: initialMode }: EditorAppProps): React.ReactElement {
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    const handler = (e: MessageEvent): void => {
      if (e.data?.type === 'navigate' && e.data.category) {
        setMode(e.data.category);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  switch (mode) {
    case 'marketplace':
      return <MarketplacePage />;
    case 'plugin':
      return <PluginPage />;
    case 'mcp':
      return <McpPage />;
    case 'skill':
      return <SkillsPage />;
    case 'settings':
      return <SettingsGridPage />;
    case 'info':
      return <InfoPage />;
    default:
      return <div className="error-banner">Unknown mode: {mode}</div>;
  }
}
