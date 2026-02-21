import React from 'react';

interface StatusBadgeProps {
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  connected: 'Connected',
  failed: 'Failed',
  'needs-auth': 'Needs Auth',
  pending: 'Pending',
  unknown: 'Unknown',
};

const STATUS_TOOLTIPS: Record<string, string> = {
  'needs-auth': 'Complete the authentication flow in Claude Code CLI',
};

/** MCP 連線狀態指示器（彩色圓點 + 文字） */
export function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  const tooltip = STATUS_TOOLTIPS[status];
  return (
    <span className="badge" style={{ background: 'transparent', color: 'inherit' }} title={tooltip}>
      <span className={`status-dot status-${status}`} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
