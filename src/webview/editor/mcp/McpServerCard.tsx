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
  onAuthenticate?: () => void;
  retrying?: boolean;
}

/** MCP Server 卡片，顯示名稱、命令、scope、連線狀態 */
export function McpServerCard({
  server,
  onEdit,
  onRemove,
  onViewDetail,
  onRetry,
  onAuthenticate,
  retrying,
}: McpServerCardProps): React.ReactElement {
  const isFailed = server.status === 'failed';
  const isNeedsAuth = server.status === 'needs-auth';
  const cardClass = `card${isFailed ? ' card--failed' : ''}${isNeedsAuth ? ' card--needs-auth' : ''}`;
  return (
    <div className={cardClass} tabIndex={0} role="group" aria-label={server.name}>
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
      {isNeedsAuth && (
        <div className="card-auth-guide" role="status">
          Authentication required — complete the auth flow in Claude Code CLI, then check status
        </div>
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
        {isNeedsAuth && onAuthenticate && (
          <button className="btn btn-primary" onClick={onAuthenticate} disabled={retrying}>
            {retrying ? 'Checking...' : 'Check Status'}
          </button>
        )}
        <button className="btn btn-secondary" onClick={onViewDetail}>
          Details
        </button>
        {server.scope && (
          <button className="btn btn-secondary" onClick={onEdit}>
            Edit
          </button>
        )}
        {server.scope && (
          <button className="btn btn-danger" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
