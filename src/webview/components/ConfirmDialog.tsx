import React, { useId } from 'react';
import { DialogOverlay } from './DialogOverlay';
import { useI18n } from '../i18n/I18nContext';

interface ConfirmDialogProps {
  title: string;
  message: string;
  messageDetail?: React.ReactNode;
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
  messageDetail,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement {
  const { t } = useI18n();
  const titleId = useId();

  return (
    <DialogOverlay titleId={titleId} onClose={onCancel}>
      <div className="confirm-dialog-title" id={titleId}>{title}</div>
      <div className="confirm-dialog-message">{message}</div>
      {messageDetail && <div className="confirm-dialog-detail">{messageDetail}</div>}
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
    </DialogOverlay>
  );
}
