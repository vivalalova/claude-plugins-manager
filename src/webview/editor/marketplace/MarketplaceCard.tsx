import React from 'react';
import type { Marketplace } from '../../../shared/types';
import { formatDate } from '../../utils/formatDate';

interface MarketplaceCardProps {
  marketplace: Marketplace;
  updating: boolean;
  onUpdate: () => void;
  onRemove: () => void;
  onToggleAutoUpdate: () => void;
}

/** 單個 Marketplace 卡片 */
export function MarketplaceCard({
  marketplace,
  updating,
  onUpdate,
  onRemove,
  onToggleAutoUpdate,
}: MarketplaceCardProps): React.ReactElement {
  const sourceUrl = marketplace.url ?? marketplace.repo ?? marketplace.path ?? '';

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-name">{marketplace.name}</div>
        {sourceUrl && (
          <span className="card-meta-url">{sourceUrl}</span>
        )}
      </div>
      {marketplace.lastUpdated && (
        <div className="card-meta">Updated: {formatDate(marketplace.lastUpdated)}</div>
      )}
      <div className="card-actions">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={marketplace.autoUpdate}
            onChange={onToggleAutoUpdate}
          />
          Auto-update
        </label>
        <button
          className="btn btn-secondary"
          onClick={onUpdate}
          disabled={updating}
        >
          {updating ? 'Updating...' : 'Update'}
        </button>
        <button className="btn btn-danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

