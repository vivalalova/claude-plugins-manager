import React from 'react';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

/** 錯誤提示橫幅 */
export function ErrorBanner({ message, onDismiss }: ErrorBannerProps): React.ReactElement {
  return (
    <div className="error-banner">
      <span>{message}</span>
      {onDismiss && (
        <button className="btn-dismiss" onClick={onDismiss} title="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
