import React, { useId } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useI18n } from '../i18n/I18nContext';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 確認對話框，用於 destructive 操作 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement {
  const { t } = useI18n();
  const titleId = useId();
  const trapRef = useFocusTrap(onCancel);

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        ref={trapRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-title" id={titleId}>{title}</div>
        <div className="confirm-dialog-message">{message}</div>
        <div className="confirm-dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel ?? t('confirm.default.cancel')}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('confirm.default.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
