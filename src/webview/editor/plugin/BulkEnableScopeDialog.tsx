import React, { useId } from 'react';
import type { PluginScope } from '../../../shared/types';
import type { WorkspaceFolder } from './hooks/usePluginData';
import { DialogOverlay } from '../../components/DialogOverlay';
import { useI18n } from '../../i18n/I18nContext';

interface BulkEnableScopeDialogProps {
  marketplace: string;
  itemCount: number;
  scope: PluginScope;
  workspaceFolders: WorkspaceFolder[];
  onScopeChange: (scope: PluginScope) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Bulk enable 時選擇 scope 的 dialog。
 * PluginPage 負責條件渲染（pendingBulkEnable && ...）。
 */
export function BulkEnableScopeDialog({
  marketplace,
  itemCount,
  scope,
  workspaceFolders,
  onScopeChange,
  onCancel,
  onConfirm,
}: BulkEnableScopeDialogProps): React.ReactElement {
  const { t } = useI18n();
  const titleId = useId();

  return (
    <DialogOverlay titleId={titleId} onClose={onCancel}>
      <div className="confirm-dialog-title" id={titleId}>
        {t('bulk.title', { marketplace })}
      </div>
      <div className="confirm-dialog-message">
        {t('bulk.message', { count: itemCount })}
      </div>
      <div className="scope-checkboxes" style={{ marginBottom: 16 }}>
        {(['user', 'project', 'local'] as const)
          .filter((s) => s === 'user' || workspaceFolders.length > 0)
          .map((s) => (
            <button
              key={s}
              className={`filter-chip${scope === s ? ' filter-chip--active' : ''}`}
              onClick={() => onScopeChange(s)}
            >
              {s === 'user' ? t('bulk.scopeUser') : s === 'project' ? t('bulk.scopeProject') : t('bulk.scopeLocal')}
            </button>
          ))}
      </div>
      <div className="confirm-dialog-actions">
        <button className="btn btn-secondary" onClick={onCancel}>{t('bulk.cancel')}</button>
        <button className="btn btn-primary" onClick={onConfirm}>{t('bulk.confirm')}</button>
      </div>
    </DialogOverlay>
  );
}
