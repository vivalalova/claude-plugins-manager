import React from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface DialogOverlayProps {
  titleId: string;
  onClose: () => void;
  /** 附加到 .confirm-dialog 的額外 CSS class */
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** 共用 overlay 容器：處理 overlay dismiss、focus trap、ARIA */
export function DialogOverlay({
  titleId,
  onClose,
  className,
  style,
  children,
}: DialogOverlayProps): React.ReactElement {
  const trapRef = useFocusTrap(onClose);

  const handleOverlayDismiss = (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (e.target !== e.currentTarget) return;
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    if ('preventDefault' in e) e.preventDefault();
    onClose();
  };

  return (
    <div
      className="confirm-overlay"
      onClick={handleOverlayDismiss}
      onKeyDown={handleOverlayDismiss}
      tabIndex={0}
    >
      <div
        className={`confirm-dialog${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={trapRef}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}
