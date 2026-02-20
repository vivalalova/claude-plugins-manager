import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { sendRequest, onPushMessage } from '../../vscode';
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
import type { McpServer } from '../../../shared/types';

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
  return {
    name: server.name,
    commandOrUrl: server.config?.command ?? server.command,
    args: server.config?.args,
    scope: server.scope,
  };
}

/**
 * MCP Server 管理頁面。
 * 即時狀態：mount 時 list + 訂閱 mcp.statusUpdate push。
 */
export function McpPage(): React.ReactElement {
  const { addToast } = useToast();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingServer, setEditingServer] = useState<EditServerInfo | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [detailText, setDetailText] = useState<string | null>(null);
  const [pollUnavailable, setPollUnavailable] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const detailTitleId = useId();
  const detailTrapRef = useFocusTrap(() => setDetailText(null), !!detailText);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sendRequest<McpServer[]>({ type: 'mcp.list' });
      setServers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      }
      if (msg.type === 'mcp.pollUnavailable') {
        setPollUnavailable(true);
      }
    });
    return unsubscribe;
  }, []);

  /** 狀態摘要計數 */
  const statusCounts = useMemo(() => {
    const counts = { connected: 0, failed: 0, pending: 0, other: 0 };
    for (const s of servers) {
      if (s.status === 'connected') counts.connected++;
      else if (s.status === 'failed') counts.failed++;
      else if (s.status === 'pending') counts.pending++;
      else counts.other++;
    }
    return counts;
  }, [servers]);

  const handleRemove = async (name: string): Promise<void> => {
    setConfirmRemove(null);
    setError(null);
    try {
      await sendRequest({ type: 'mcp.remove', name });
      await fetchList();
      addToast('MCP server removed');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleViewDetail = async (name: string): Promise<void> => {
    setError(null);
    try {
      const detail = await sendRequest<string>({ type: 'mcp.getDetail', name });
      setDetailText(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleResetProjectChoices = async (): Promise<void> => {
    setError(null);
    try {
      await sendRequest({ type: 'mcp.resetProjectChoices' });
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRetrying(false);
    }
  };

  /** 重啟 polling（poll unavailable 後） */
  const handleRestartPolling = async (): Promise<void> => {
    setPollUnavailable(false);
    try {
      await sendRequest({ type: 'mcp.restartPolling' });
    } catch (e) {
      setPollUnavailable(true);
      setError(e instanceof Error ? e.message : String(e));
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">MCP Servers Manager</div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleRefreshStatus} disabled={loading || retrying}>
            {retrying ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-secondary" onClick={handleResetProjectChoices}>
            Reset Project Choices
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddDialog(true)}>
            Add Server
          </button>
        </div>
      </div>

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
        <div className="card-list">
          {servers.map((server) => (
            <McpServerCard
              key={server.fullName}
              server={server}
              onEdit={() => handleEdit(server)}
              onRemove={() => setConfirmRemove(server.name)}
              onViewDetail={() => handleViewDetail(server.fullName)}
              onRetry={handleRefreshStatus}
              retrying={retrying}
            />
          ))}
        </div>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove MCP Server"
          message={`Remove "${confirmRemove}"?`}
          confirmLabel="Remove"
          danger
          onConfirm={() => handleRemove(confirmRemove)}
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
        <div className="confirm-overlay" onClick={() => setDetailText(null)}>
          <div
            ref={detailTrapRef}
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailTitleId}
            style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
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
