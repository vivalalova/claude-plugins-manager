import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/locales/en';

interface StatusBadgeProps {
  status: string;
}

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  connected: 'status.connected',
  failed: 'status.failed',
  'needs-auth': 'status.needsAuth',
  pending: 'status.pending',
  unknown: 'status.unknown',
};

const STATUS_TOOLTIP_KEYS: Record<string, TranslationKey> = {
  'needs-auth': 'status.needsAuth.tooltip',
};

/** MCP 連線狀態指示器（彩色圓點 + 文字） */
export function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  const { t } = useI18n();
  const labelKey = STATUS_LABEL_KEYS[status];
  const tooltipKey = STATUS_TOOLTIP_KEYS[status];
  const tooltip = tooltipKey ? t(tooltipKey) : undefined;

  return (
    <span className="badge" style={{ background: 'transparent', color: 'inherit' }} title={tooltip}>
      <span className={`status-dot status-${status}`} />
      {labelKey ? t(labelKey) : status}
    </span>
  );
}
