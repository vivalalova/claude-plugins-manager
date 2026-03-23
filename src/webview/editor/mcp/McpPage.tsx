import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { sendRequest, onPushMessage } from '../../vscode';
import { toErrorMessage } from '../../../shared/errorUtils';
import { McpCardSkeleton } from '../../components/Skeleton';
import { EmptyState, ServerIcon } from '../../components/EmptyState';
import { JsonHighlight } from '../../components/JsonHighlight';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { McpServerCard } from './McpServerCard';
import { AddMcpDialog } from './AddMcpDialog';
import type { EditServerInfo } from './AddMcpDialog';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useToast } from '../../components/Toast';
import type { McpAddParams, McpServer } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';
import { PageHeader } from '../../components/PageHeader';

/** 檢查字串是否為合法 JSON */
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/** 從 McpServer 建構編輯 dialog 預填資訊（優先用結構化 config） */
export function buildEditServerInfo(server: McpServer): EditServerInfo {
  const config = server.config;
  const headers = config?.headers
    ? Object.entries(config.headers).map(([key, value]) => `${key}: ${value}`)
    : undefined;
  return {
    name: server.name,
    commandOrUrl: config?.url ?? config?.command ?? server.command,
    args: config?.args,
    transport: config?.transport,
    scope: server.scope,
    env: config?.env,
    headers,
  };
}

/**
 * MCP Server 管理頁面。
 * 即時狀態：mount 時 list + 訂閱 mcp.statusUpdate push。
 */
export function McpPage(): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingServer, setEditingServer] = useState<EditServerInfo | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ name: string; scope?: McpAddParams['scope'] } | null>(null);
  const [detailText, setDetailText] = useState<string | null>(null);
  const [pollUnavailable, setPollUnavailable] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [testingServer, setTestingServer] = useState<string | null>(null);
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});
  const [removingServer, setRemovingServer] = useState<string | null>(null);
  const detailTitleId = useId();
  const detailTrapRef = useFocusTrap(() => setDetailText(null), !!detailText);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sendRequest<McpServer[]>({ type: 'mcp.list' });
      setServers(data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  // 訂閱 MCP 狀態推送
  useEffect(() => {
    const unsubscribe = onPushMessage((msg) => {
      if (msg.type === 'mcp.statusUpdate' && Array.isArray(msg.servers)) {
        setServers(msg.servers as McpServer[]);
        setPollUnavailable(false);
        setTestErrors({});
      }
      if (msg.type === 'mcp.pollUnavailable') {
        setPollUnavailable(true);
      }
    });
    return unsubscribe;
  }, []);

  /** 狀態摘要計數 */
  const statusCounts = useMemo(() => {
    const counts = { connected: 0, failed: 0, needsAuth: 0, pending: 0, other: 0 };
    for (const s of servers) {
      if (s.status === 'connected') counts.connected++;
      else if (s.status === 'failed') counts.failed++;
      else if (s.status === 'needs-auth') counts.needsAuth++;
      else if (s.status === 'pending') counts.pending++;
      else counts.other++;
    }
    return counts;
  }, [servers]);

  const groupedServers = useMemo(() => {
    const direct: McpServer[] = [];
    const pluginProvided: McpServer[] = [];
    for (const server of servers) {
      if (server.plugin || server.fullName.startsWith('plugin:')) {
        if (server.plugin?.enabled !== false) {
          pluginProvided.push(server);
        }
      } else {
        direct.push(server);
      }
    }
    return { direct, pluginProvided };
  }, [servers]);

  const handleRemove = async (name: string, scope?: McpAddParams['scope']): Promise<void> => {
    setConfirmRemove(null);
    setError(null);
    setRemovingServer(`${scope ?? 'none'}:${name}`);
    try {
      await sendRequest({ type: 'mcp.remove', name, scope });
      await fetchList();
      addToast('MCP server removed');
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setRemovingServer(null);
    }
  };

  const handleViewDetail = async (name: string): Promise<void> => {
    setError(null);
    try {
      const detail = await sendRequest<string>({ type: 'mcp.getDetail', name });
      setDetailText(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
    } catch (e) {
      setError(toErrorMessage(e));
    }
  };

  const handleResetProjectChoices = async (): Promise<void> => {
    setError(null);
    try {
      await sendRequest({ type: 'mcp.resetProjectChoices' });
      await fetchList();
    } catch (e) {
      setError(toErrorMessage(e));
    }
  };

  /** 單次完整刷新（CLI health check） */
  const handleRefreshStatus = async (): Promise<void> => {
    setRetrying(true);
    setError(null);
    try {
      const data = await sendRequest<McpServer[]>({ type: 'mcp.refreshStatus' }, 30_000);
      setServers(data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setRetrying(false);
    }
  };

  /** 單一 server 連線測試（複用 mcp.refreshStatus，per-card loading） */
  const handleTestConnection = async (server: McpServer): Promise<void> => {
    const serverKey = `${server.scope ?? 'none'}:${server.fullName}`;
    setTestingServer(serverKey);
    setTestErrors((prev) => { const next = { ...prev }; delete next[serverKey]; return next; });
    setError(null);
    try {
      const data = await sendRequest<McpServer[]>({ type: 'mcp.refreshStatus' }, 30_000);
      setServers(data);
      const updated = data.find((s) => s.fullName === server.fullName && s.scope === server.scope);
      if (updated && updated.status !== 'connected') {
        setTestErrors((prev) => ({
          ...prev,
          [serverKey]: updated.status === 'failed' ? 'Connection failed' : `Status: ${updated.status}`,
        }));
      }
    } catch (e) {
      setTestErrors((prev) => ({ ...prev, [serverKey]: toErrorMessage(e) }));
    } finally {
      setTestingServer(null);
    }
  };

  /** 重啟 polling（poll unavailable 後） */
  const handleRestartPolling = async (): Promise<void> => {
    setPollUnavailable(false);
    try {
      await sendRequest({ type: 'mcp.restartPolling' });
    } catch (e) {
      setPollUnavailable(true);
      setError(toErrorMessage(e));
    }
  };

  const handleEdit = (server: McpServer): void =>
    setEditingServer(buildEditServerInfo(server));

  const handleAdded = async (): Promise<void> => {
    setShowAddDialog(false);
    setEditingServer(null);
    await fetchList();
    addToast('MCP server added');
  };

  const handleEdited = async (): Promise<void> => {
    setShowAddDialog(false);
    setEditingServer(null);
    await fetchList();
    addToast('MCP server updated');
  };

  const renderServerSection = (title: string, sectionServers: McpServer[]): React.ReactElement => (
    <section className="mcp-section" role="region" aria-label={title}>
      <div className="mcp-section-header">
        <div className="mcp-section-title-row">
          <h2 className="mcp-section-title">{title}</h2>
          <span className="mcp-section-count">{sectionServers.length}</span>
        </div>
      </div>
      <div className="card-list">
        {sectionServers.map((server) => (
          <McpServerCard
            key={`${server.scope ?? 'none'}:${server.fullName}`}
            server={server}
            onEdit={() => handleEdit(server)}
            onRemove={() => setConfirmRemove({ name: server.name, scope: server.scope })}
            onViewDetail={() => handleViewDetail(server.fullName)}
            onTestConnection={() => handleTestConnection(server)}
            onAuthenticate={handleRefreshStatus}
            retrying={retrying}
            testing={testingServer === `${server.scope ?? 'none'}:${server.fullName}`}
            anyTesting={testingServer !== null}
            testError={testErrors[`${server.scope ?? 'none'}:${server.fullName}`] ?? null}
            removing={removingServer === `${server.scope ?? 'none'}:${server.name}`}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div className="page-container">
      <PageHeader
        title="MCP Servers Manager"
        actions={<>
          <button className="btn btn-secondary" onClick={handleRefreshStatus} disabled={loading || retrying}>
            {retrying ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-secondary" onClick={handleResetProjectChoices}>
            Reset Project Choices
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddDialog(true)}>
            Add Server
          </button>
        </>}
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {pollUnavailable && (
        <div className="warning-banner" role="status">
          <span>Status polling unavailable</span>
          <button className="btn btn-secondary btn-sm" onClick={handleRestartPolling}>
            Retry Polling
          </button>
        </div>
      )}

      {!loading && servers.length > 0 && (
        <div className="mcp-status-summary">
          {statusCounts.connected > 0 && (
            <span className="mcp-status-item mcp-status-item--connected">
              Connected: {statusCounts.connected}
            </span>
          )}
          {statusCounts.needsAuth > 0 && (
            <span className="mcp-status-item mcp-status-item--needs-auth">
              Needs Auth: {statusCounts.needsAuth}
            </span>
          )}
          {statusCounts.failed > 0 && (
            <span className="mcp-status-item mcp-status-item--failed">
              Failed: {statusCounts.failed}
            </span>
          )}
          {statusCounts.pending > 0 && (
            <span className="mcp-status-item mcp-status-item--pending">
              Pending: {statusCounts.pending}
            </span>
          )}
          {statusCounts.other > 0 && (
            <span className="mcp-status-item mcp-status-item--other">
              Other: {statusCounts.other}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <McpCardSkeleton />
      ) : servers.length === 0 ? (
        <EmptyState
          icon={<ServerIcon />}
          title="No MCP servers configured"
          description="Add an MCP server to extend Claude's capabilities."
          action={{ label: 'Add Server', onClick: () => setShowAddDialog(true) }}
        />
      ) : (
        <div className="mcp-sections">
          {groupedServers.direct.length > 0 && renderServerSection(t('mcp.section.direct'), groupedServers.direct)}
          {groupedServers.pluginProvided.length > 0 && renderServerSection(t('mcp.section.plugin'), groupedServers.pluginProvided)}
        </div>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove MCP Server"
          message={`Remove "${confirmRemove.name}"?`}
          confirmLabel="Remove"
          danger
          onConfirm={() => handleRemove(confirmRemove.name, confirmRemove.scope)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {showAddDialog && (
        <AddMcpDialog
          onAdded={handleAdded}
          onCancel={() => setShowAddDialog(false)}
        />
      )}

      {editingServer && (
        <AddMcpDialog
          editServer={editingServer}
          onAdded={handleEdited}
          onCancel={() => setEditingServer(null)}
        />
      )}

      {detailText && (
        <div
          className="confirm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailText(null);
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            setDetailText(null);
          }}
          tabIndex={0}
        >
          <div
            ref={detailTrapRef}
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailTitleId}
            style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}
          >
            <div className="confirm-dialog-title" id={detailTitleId}>Server Detail</div>
            {isValidJson(detailText) ? (
              <JsonHighlight json={detailText} />
            ) : (
              <pre className="json-highlight" style={{ padding: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {detailText}
              </pre>
            )}
            <div className="confirm-dialog-actions">
              <button className="btn btn-primary" onClick={() => setDetailText(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
