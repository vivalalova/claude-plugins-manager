import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sendRequest, onPushMessage } from '../../vscode';
import { MarketplaceCardSkeleton } from '../../components/Skeleton';
import { EmptyState, MarketplaceIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MarketplaceCard } from './MarketplaceCard';
import { useToast } from '../../components/Toast';
import type { Marketplace } from '../../../shared/types';

/**
 * Marketplace 管理頁面。
 * Marketplace 無 scope 概念，全域唯一。
 */
export function MarketplacePage(): React.ReactElement {
  const { addToast } = useToast();
  const addInputRef = useRef<HTMLInputElement>(null);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addSource, setAddSource] = useState('');
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const fetchList = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const data = await sendRequest<Marketplace[]>({ type: 'marketplace.list' });
      setMarketplaces(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  // 訂閱檔案變更推送，自動靜默刷新
  useEffect(() => {
    const unsubscribe = onPushMessage((msg) => {
      if (msg.type === 'marketplace.refresh') {
        fetchList(false);
      }
    });
    return unsubscribe;
  }, [fetchList]);

  const handleAdd = async (): Promise<void> => {
    const source = addSource.trim();
    if (!source) {
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await sendRequest({ type: 'marketplace.add', source });
      setAddSource('');
      await fetchList();
      addToast('Marketplace added');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (name: string): Promise<void> => {
    setConfirmRemove(null);
    setError(null);
    try {
      await sendRequest({ type: 'marketplace.remove', name });
      await fetchList();
      addToast('Marketplace removed');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUpdate = async (name?: string): Promise<void> => {
    setUpdating(name ?? '__all__');
    setError(null);
    try {
      await sendRequest({ type: 'marketplace.update', name });
      await fetchList();
      addToast(name ? `Updated ${name}` : 'All marketplaces updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleAutoUpdate = async (name: string): Promise<void> => {
    setError(null);
    try {
      await sendRequest({ type: 'marketplace.toggleAutoUpdate', name });
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExport = async (): Promise<void> => {
    setError(null);
    try {
      await sendRequest({ type: 'marketplace.export' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleImport = async (): Promise<void> => {
    setError(null);
    try {
      await sendRequest<string[]>({ type: 'marketplace.import' });
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">Marketplaces Manager</div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={() => fetchList()}
            disabled={loading}
          >
            Refresh
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleExport}
            disabled={loading || marketplaces.length === 0}
          >
            Export
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleImport}
          >
            Import
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleUpdate()}
            disabled={updating !== null}
          >
            {updating === '__all__' ? 'Updating...' : 'Update All'}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="form-inline">
        <input
          ref={addInputRef}
          className="input"
          placeholder="Git URL, GitHub owner/repo, or local path"
          value={addSource}
          onChange={(e) => setAddSource(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          disabled={adding}
        />
        <button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={adding || !addSource.trim()}
        >
          {adding ? 'Adding...' : 'Add'}
        </button>
      </div>

      {loading ? (
        <MarketplaceCardSkeleton />
      ) : marketplaces.length === 0 ? (
        <EmptyState
          icon={<MarketplaceIcon />}
          title="No marketplaces configured"
          description="Add a marketplace source to discover and install plugins."
          action={{ label: 'Add Marketplace', onClick: () => addInputRef.current?.focus() }}
        />
      ) : (
        <div className="card-list">
          {marketplaces.map((mp) => (
            <MarketplaceCard
              key={mp.name}
              marketplace={mp}
              updating={updating === mp.name}
              onUpdate={() => handleUpdate(mp.name)}
              onRemove={() => setConfirmRemove(mp.name)}
              onToggleAutoUpdate={() => handleToggleAutoUpdate(mp.name)}
            />
          ))}
        </div>
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove Marketplace"
          message={`Remove "${confirmRemove}"? Plugins from this marketplace will no longer be available.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => handleRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
