import React from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { ScopeBadge } from '../../components/ScopeBadge';
import type { McpServer } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

interface McpServerCardProps {
  server: McpServer;
  onEdit: () => void;
  onRemove: () => void;
  onViewDetail: () => void;
  onRetry: () => void;
  onAuthenticate?: () => void;
  retrying?: boolean;
  removing?: boolean;
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
  removing,
}: McpServerCardProps): React.ReactElement {
  const { t } = useI18n();
  const isFailed = server.status === 'failed';
  const isNeedsAuth = server.status === 'needs-auth';
  const isPluginProvided = server.fullName.startsWith('plugin:');
  const canManageInMcp = !!server.scope && !isPluginProvided;
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
        <div className="card-error">{t('mcp.card.connectionFailed')}</div>
      )}
      {isNeedsAuth && (
        <div className="card-auth-guide" role="status">
          {t('mcp.card.authRequired')}
        </div>
      )}
      <div className="card-meta">
        <div style={{ fontFamily: 'var(--vscode-editor-font-family)', fontSize: 12 }}>
          {server.command}
        </div>
        {server.plugin && (
          <div className="card-plugin-meta" role="note" aria-label={t('mcp.card.pluginManageHint')}>
            <div>{t('mcp.card.pluginProvided', { plugin: server.plugin.id })}</div>
            <div className="scope-badges">
              <span className={server.plugin.enabled ? 'badge-enabled' : 'badge-disabled'}>
                {server.plugin.enabled ? t('mcp.card.pluginEnabled') : t('mcp.card.pluginDisabled')}
              </span>
            </div>
            <div>{t('mcp.card.pluginManageHint')}</div>
          </div>
        )}
        {server.fullName !== server.name && (
          <div style={{ fontSize: 11, marginTop: 2 }}>{server.fullName}</div>
        )}
      </div>
      <div className="card-actions">
        {isFailed && (
          <button className="btn btn-primary" onClick={onRetry} disabled={retrying}>
            {retrying ? t('mcp.card.retrying') : t('mcp.card.retry')}
          </button>
        )}
        {isNeedsAuth && onAuthenticate && (
          <button className="btn btn-primary" onClick={onAuthenticate} disabled={retrying}>
            {retrying ? t('mcp.card.checking') : t('mcp.card.checkStatus')}
          </button>
        )}
        <button className="btn btn-secondary" onClick={onViewDetail}>
          {t('mcp.card.details')}
        </button>
        {canManageInMcp && (
          <button className="btn btn-secondary" onClick={onEdit}>
            {t('mcp.card.edit')}
          </button>
        )}
        {canManageInMcp && (
          <button className="btn btn-danger" onClick={onRemove} disabled={removing}>
            {removing ? t('mcp.card.removing') : t('mcp.card.remove')}
          </button>
        )}
      </div>
    </div>
  );
}
