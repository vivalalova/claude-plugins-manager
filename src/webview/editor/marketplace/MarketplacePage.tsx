import React, { useCallback, useRef } from 'react';
import { sendRequest } from '../../vscode';
import { MarketplaceCardSkeleton } from '../../components/Skeleton';
import { EmptyState, MarketplaceIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MarketplaceCard } from './MarketplaceCard';
import { VirtualCardList } from '../plugin/VirtualCardList';
import { PageHeader } from '../../components/PageHeader';
import type { Marketplace } from '../../../shared/types';
import { usePushSyncedResource } from '../../hooks/usePushSyncedResource';
import { useMarketplaceActions } from './hooks/useMarketplaceActions';

/**
 * Marketplace 管理頁面。
 * Marketplace 無 scope 概念，全域唯一。
 */
export function MarketplacePage(): React.ReactElement {
  const addInputRef = useRef<HTMLInputElement>(null);
  const loadMarketplaces = useCallback(
    () => sendRequest<Marketplace[]>({ type: 'marketplace.list' }),
    [],
  );
  const shouldRefreshMarketplaces = useCallback(
    (msg: { type?: string }) => msg.type === 'marketplace.refresh',
    [],
  );
  const {
    data: marketplaces,
    loading,
    error,
    setError,
    refresh: fetchList,
  } = usePushSyncedResource<Marketplace[]>({
    initialData: [],
    load: loadMarketplaces,
    pushFilter: shouldRefreshMarketplaces,
  });
  const {
    addSource,
    setAddSource,
    adding,
    updating,
    confirmRemove,
    setConfirmRemove,
    retryAction,
    setRetryAction,
    previewing,
    previewPlugins,
    handlePreview,
    handleClosePreview,
    handlePreviewOverlayDismiss,
    handleConfirmAdd,
    handleAdd,
    handleRemove,
    handleUpdate,
    handleToggleAutoUpdate,
    handleExport,
    handleImport,
  } = useMarketplaceActions({
    fetchList,
    setError,
  });

  return (
    <div className="page-container">
      <PageHeader
        title="Marketplaces Manager"
        actions={<>
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
        </>}
      />

      {error && (
        <ErrorBanner
          message={error}
          onDismiss={() => { setError(null); setRetryAction(null); }}
          action={retryAction && (
            <button className="btn btn-secondary btn-sm" onClick={retryAction}>Retry</button>
          )}
        />
      )}

      <div className="form-inline">
        <input
          ref={addInputRef}
          className="input"
          placeholder="Git URL, GitHub owner/repo, or local path"
          value={addSource}
          onChange={(e) => setAddSource(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !previewing && handleAdd()}
          disabled={adding || previewing}
        />
        <button
          className="btn btn-secondary"
          onClick={handlePreview}
          disabled={previewing || adding || !addSource.trim()}
        >
          {previewing ? 'Loading...' : 'Preview'}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => handleAdd()}
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
        <VirtualCardList
          items={marketplaces}
          keyExtractor={(mp) => mp.name}
          className="card-list"
          renderItem={(mp) => (
            <MarketplaceCard
              key={mp.name}
              marketplace={mp}
              updating={updating === mp.name}
              onUpdate={() => handleUpdate(mp.name)}
              onRemove={() => setConfirmRemove(mp.name)}
              onToggleAutoUpdate={() => handleToggleAutoUpdate(mp.name)}
            />
          )}
        />
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

      {previewPlugins && (
        <div
          className="confirm-overlay"
          onClick={handlePreviewOverlayDismiss}
          onKeyDown={handlePreviewOverlayDismiss}
          tabIndex={0}
        >
          <div
            className="confirm-dialog confirm-dialog--preview"
            role="dialog"
            aria-modal="true"
          >
            <div className="confirm-dialog-title">
              Marketplace Preview — {previewPlugins.length} plugin{previewPlugins.length !== 1 ? 's' : ''}
            </div>
            <div className="preview-plugin-list">
              {previewPlugins.map((p) => (
                <div key={p.name} className="preview-plugin-item">
                  <div className="preview-plugin-name">
                    {p.name}
                    {p.version && <span className="preview-plugin-version">{p.version}</span>}
                  </div>
                  {p.description && (
                    <div className="preview-plugin-desc">{p.description}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="confirm-dialog-actions">
              <button className="btn btn-secondary" onClick={handleClosePreview}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmAdd} disabled={adding}>
                {adding ? 'Adding...' : 'Add Marketplace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
