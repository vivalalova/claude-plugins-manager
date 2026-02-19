import React from 'react';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  /** 額外 action（如 Retry 按鈕），放在 message 和 dismiss 之間 */
  action?: React.ReactNode;
}

/** 錯誤提示橫幅 */
export function ErrorBanner({ message, onDismiss, action }: ErrorBannerProps): React.ReactElement {
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      {action}
      {onDismiss && (
        <button className="btn-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
