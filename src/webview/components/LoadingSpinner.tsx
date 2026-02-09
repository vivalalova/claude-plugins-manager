import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

/** 載入中指示器 */
export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps): React.ReactElement {
  return (
    <div className="loading-spinner">
      <div className="spinner" />
      <span>{message}</span>
    </div>
  );
}
