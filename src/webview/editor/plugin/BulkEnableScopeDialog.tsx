import React, { useId } from 'react';
import type { PluginScope } from '../../../shared/types';
import type { WorkspaceFolder } from './hooks/usePluginData';
import { useFocusTrap } from '../../hooks/useFocusTrap';

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
  const titleId = useId();
  const containerRef = useFocusTrap(onCancel);

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        ref={containerRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-title" id={titleId}>Enable All — {marketplace}</div>
        <div className="confirm-dialog-message">
          Select scope for enabling {itemCount} plugins:
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
                {s === 'user' ? 'User' : s === 'project' ? 'Project' : 'Local'}
              </button>
            ))}
        </div>
        <div className="confirm-dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Enable All</button>
        </div>
      </div>
    </div>
  );
}
