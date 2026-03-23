import React, { useCallback, useRef, useState } from 'react';
import { sendRequest } from '../../vscode';
import { MarketplaceCardSkeleton } from '../../components/Skeleton';
import { EmptyState, MarketplaceIcon } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MarketplaceCard } from './MarketplaceCard';
import { VirtualCardList } from '../plugin/VirtualCardList';
import { PageHeader } from '../../components/PageHeader';
import type { Marketplace, PreviewPlugin } from '../../../shared/types';
import { usePushSyncedResource } from '../../hooks/usePushSyncedResource';
import { usePageAction } from '../../hooks/usePageAction';

/**
 * Marketplace 管理頁面。
 * Marketplace 無 scope 概念，全域唯一。
 */
export function MarketplacePage(): React.ReactElement {
  const addInputRef = useRef<HTMLInputElement>(null);
  const [addSource, setAddSource] = useState('');
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewPlugins, setPreviewPlugins] = useState<PreviewPlugin[] | null>(null);
  const [previewSource, setPreviewSource] = useState('');
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
  const runPageAction = usePageAction({ setError });

  const runAddMarketplace = async (source: string): Promise<void> => {
    const normalizedSource = source.trim();
    if (!normalizedSource) {
      return;
    }

    setAdding(true);
    setRetryAction(null);
    await runPageAction({
      action: () => sendRequest({ type: 'marketplace.add', source: normalizedSource }),
      onSuccess: async () => {
        setAddSource('');
        await fetchList();
      },
      onError: (message) => {
        setError(message);
        setRetryAction(() => () => runAddMarketplace(normalizedSource));
      },
      onFinally: () => {
        setAdding(false);
      },
      successToast: 'Marketplace added',
    });
  };

  const handlePreview = async (): Promise<void> => {
    const source = addSource.trim();
    if (!source) return;
    setPreviewing(true);
    setRetryAction(null);
    await runPageAction({
      action: () => sendRequest<PreviewPlugin[]>({ type: 'marketplace.preview', source }),
      onSuccess: (plugins) => {
        setPreviewPlugins(plugins);
        setPreviewSource(source);
      },
      onFinally: () => {
        setPreviewing(false);
      },
    });
  };

  const handleClosePreview = (): void => {
    setPreviewPlugins(null);
    setPreviewSource('');
  };
  const handlePreviewOverlayDismiss = (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (e.target !== e.currentTarget) return;
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    if ('preventDefault' in e) e.preventDefault();
    handleClosePreview();
  };

  const handleConfirmAdd = async (): Promise<void> => {
    const source = previewSource;
    handleClosePreview();
    await runAddMarketplace(source);
  };

  const handleAdd = async (sourceOverride?: string): Promise<void> => {
    await runAddMarketplace(sourceOverride ?? addSource);
  };

  const handleRemove = async (name: string): Promise<void> => {
    setConfirmRemove(null);
    setRetryAction(null);
    await runPageAction({
      action: () => sendRequest({ type: 'marketplace.remove', name }),
      onSuccess: async () => {
        await fetchList();
      },
      onError: (message) => {
        setError(message);
        setRetryAction(() => () => handleRemove(name));
      },
      successToast: 'Marketplace removed',
    });
  };

  const handleUpdate = async (name?: string): Promise<void> => {
    setUpdating(name ?? '__all__');
    setRetryAction(null);
    await runPageAction({
      action: () => sendRequest({ type: 'marketplace.update', name }),
      onSuccess: async () => {
        await fetchList();
      },
      onError: (message) => {
        setError(message);
        setRetryAction(() => () => handleUpdate(name));
      },
      onFinally: () => {
        setUpdating(null);
      },
      successToast: name ? `Updated ${name}` : 'All marketplaces updated',
    });
  };

  const handleToggleAutoUpdate = async (name: string): Promise<void> => {
    setRetryAction(null);
    await runPageAction({
      action: () => sendRequest({ type: 'marketplace.toggleAutoUpdate', name }),
      onSuccess: async () => {
        await fetchList();
      },
      onError: (message) => {
        setError(message);
        setRetryAction(() => () => handleToggleAutoUpdate(name));
      },
    });
  };

  const handleExport = async (): Promise<void> => {
    setRetryAction(null);
    await runPageAction({
      action: () => sendRequest({ type: 'marketplace.export' }),
      onError: (message) => {
        setError(message);
        setRetryAction(() => () => handleExport());
      },
    });
  };

  const handleImport = async (): Promise<void> => {
    setRetryAction(null);
    await runPageAction({
      action: () => sendRequest<string[]>({ type: 'marketplace.import' }),
      onSuccess: async () => {
        await fetchList();
      },
      onError: (message) => {
        setError(message);
        setRetryAction(() => () => handleImport());
      },
    });
  };

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
