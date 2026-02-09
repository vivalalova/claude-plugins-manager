import React from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { ScopeBadge } from '../../components/ScopeBadge';
import type { McpServer } from '../../../shared/types';

interface McpServerCardProps {
  server: McpServer;
  onRemove: () => void;
  onViewDetail: () => void;
}

/** MCP Server 卡片，顯示名稱、命令、scope、連線狀態 */
export function McpServerCard({
  server,
  onRemove,
  onViewDetail,
}: McpServerCardProps): React.ReactElement {
  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="card-name">{server.name}</span>
          {server.scope && <ScopeBadge scope={server.scope} />}
        </div>
        <StatusBadge status={server.status} />
      </div>
      <div className="card-meta">
        <div style={{ fontFamily: 'var(--vscode-editor-font-family)', fontSize: 12 }}>
          {server.command}
        </div>
        {server.fullName !== server.name && (
          <div style={{ fontSize: 11, marginTop: 2 }}>{server.fullName}</div>
        )}
      </div>
      <div className="card-actions">
        <button className="btn btn-secondary" onClick={onViewDetail}>
          Details
        </button>
        <button className="btn btn-danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}
