import React from 'react';
import { useI18n } from '../i18n/I18nContext';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  /** 額外 action（如 Retry 按鈕），放在 message 和 dismiss 之間 */
  action?: React.ReactNode;
  className?: string;
}

/** 錯誤提示橫幅 */
export function ErrorBanner({ message, onDismiss, action, className }: ErrorBannerProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className={`error-banner${className ? ` ${className}` : ''}`} role="alert">
      <span>{message}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
        {action}
        {onDismiss && (
          <button className="btn-dismiss" onClick={onDismiss} aria-label={t('error.dismiss')}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}
