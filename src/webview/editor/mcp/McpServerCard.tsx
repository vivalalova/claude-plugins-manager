import React from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { ScopeBadge } from '../../components/ScopeBadge';
import type { McpServer } from '../../../shared/types';

interface McpServerCardProps {
  server: McpServer;
  onEdit: () => void;
  onRemove: () => void;
  onViewDetail: () => void;
  onRetry: () => void;
  retrying?: boolean;
}

/** MCP Server 卡片，顯示名稱、命令、scope、連線狀態 */
export function McpServerCard({
  server,
  onEdit,
  onRemove,
  onViewDetail,
  onRetry,
  retrying,
}: McpServerCardProps): React.ReactElement {
  const isFailed = server.status === 'failed';
  return (
    <div className={`card${isFailed ? ' card--failed' : ''}`}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="card-name">{server.name}</span>
          {server.scope && <ScopeBadge scope={server.scope} />}
        </div>
        <StatusBadge status={server.status} />
      </div>
      {isFailed && (
        <div className="card-error">Connection failed</div>
      )}
      <div className="card-meta">
        <div style={{ fontFamily: 'var(--vscode-editor-font-family)', fontSize: 12 }}>
          {server.command}
        </div>
        {server.fullName !== server.name && (
          <div style={{ fontSize: 11, marginTop: 2 }}>{server.fullName}</div>
        )}
      </div>
      <div className="card-actions">
        {isFailed && (
          <button className="btn btn-primary" onClick={onRetry} disabled={retrying}>
            {retrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
        <button className="btn btn-secondary" onClick={onViewDetail}>
          Details
        </button>
        <button className="btn btn-secondary" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn-danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}
