import React, { useCallback, useEffect, useState } from 'react';
import { sendRequest, onPushMessage } from '../../vscode';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { McpServerCard } from './McpServerCard';
import { AddMcpDialog } from './AddMcpDialog';
import type { EditServerInfo } from './AddMcpDialog';
import type { McpServer } from '../../../shared/types';

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
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingServer, setEditingServer] = useState<EditServerInfo | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [detailText, setDetailText] = useState<string | null>(null);

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
      }
    });
    return unsubscribe;
  }, []);

  const handleRemove = async (name: string): Promise<void> => {
    setConfirmRemove(null);
    setError(null);
    try {
      await sendRequest({ type: 'mcp.remove', name });
      await fetchList();
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

  const handleEdit = (server: McpServer): void =>
    setEditingServer(buildEditServerInfo(server));

  const handleAdded = async (): Promise<void> => {
    setShowAddDialog(false);
    setEditingServer(null);
    await fetchList();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">MCP Servers Manager</div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={fetchList} disabled={loading}>
            Refresh
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

      {loading ? (
        <LoadingSpinner message="Loading MCP servers..." />
      ) : servers.length === 0 ? (
        <div className="empty-state">No MCP servers configured</div>
      ) : (
        <div className="card-list">
          {servers.map((server) => (
            <McpServerCard
              key={server.fullName}
              server={server}
              onEdit={() => handleEdit(server)}
              onRemove={() => setConfirmRemove(server.name)}
              onViewDetail={() => handleViewDetail(server.fullName)}
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
          onAdded={handleAdded}
          onCancel={() => setEditingServer(null)}
        />
      )}

      {detailText && (
        <div className="confirm-overlay" onClick={() => setDetailText(null)}>
          <div
            className="confirm-dialog"
            style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-dialog-title">Server Detail</div>
            <pre style={{
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              background: 'var(--vscode-textCodeBlock-background)',
              padding: 12,
              borderRadius: 4,
              marginBottom: 16,
            }}>
              {detailText}
            </pre>
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
