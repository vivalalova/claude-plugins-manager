import React from 'react';

interface ScopeBadgeProps {
  scope: string;
  /** project scope 時顯示的路徑 */
  projectPath?: string;
}

/** Scope 標籤（user / project / local） */
export function ScopeBadge({ scope, projectPath }: ScopeBadgeProps): React.ReactElement {
  const className = `badge badge-scope-${scope}`;
  const label = projectPath
    ? `project: ${shortenPath(projectPath)}`
    : scope;

  return <span className={className}>{label}</span>;
}

/** 縮短路徑顯示（只取最後兩層） */
function shortenPath(fullPath: string): string {
  const parts = fullPath.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length > 2
    ? `.../${parts.slice(-2).join('/')}`
    : fullPath;
}
