import React from 'react';
import type { Marketplace } from '../../../shared/types';
import { formatDate } from '../../utils/formatDate';
import { useI18n } from '../../i18n/I18nContext';

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
  const { t } = useI18n();
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
        <div className="card-meta">{t('marketplace.card.updated')} {formatDate(marketplace.lastUpdated)}</div>
      )}
      <div className="card-actions">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={marketplace.autoUpdate}
            onChange={onToggleAutoUpdate}
          />
          {t('marketplace.card.autoUpdate')}
        </label>
        <button
          className="btn btn-secondary"
          onClick={onUpdate}
          disabled={updating}
        >
          {updating ? t('marketplace.card.updating') : t('marketplace.card.update')}
        </button>
        <button className="btn btn-danger" onClick={onRemove}>
          {t('marketplace.card.remove')}
        </button>
      </div>
    </div>
  );
}
