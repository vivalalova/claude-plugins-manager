import React, { useState, useEffect, useId } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

// ---------------------------------------------------------------------------
// AddSkillDialog
// ---------------------------------------------------------------------------

interface AddSkillDialogProps {
  open: boolean;
  adding: boolean;
  hasWorkspace: boolean;
  onSubmit: (source: string, scope: SkillScope) => void;
  onClose: () => void;
}

export function AddSkillDialog({
  open,
  adding,
  hasWorkspace,
  onSubmit,
  onClose,
}: AddSkillDialogProps): React.ReactElement | null {
  const { t } = useI18n();
  const [source, setSource] = useState('');
  const [scope, setScope] = useState<SkillScope>('global');
  const [validationError, setValidationError] = useState('');
  const titleId = useId();
  const trapRef = useFocusTrap(onClose, open);

  // 開啟時重置表單
  useEffect(() => {
    if (open) {
      setSource('');
      setScope('global');
      setValidationError('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (): void => {
    const trimmed = source.trim();
    if (!trimmed) {
      setValidationError(t('skill.add.validation'));
      return;
    }
    setValidationError('');
    onSubmit(trimmed, scope);
  };

  const handleOverlayDismiss = (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (e.target !== e.currentTarget) return;
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
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
        ref={trapRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="confirm-dialog-title" id={titleId}>{t('skill.add.title')}</div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="skill-source" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
            {t('skill.add.source')}
          </label>
          <input
            id="skill-source"
            type="text"
            className="search-bar"
            style={{ width: '100%' }}
            placeholder={t('skill.add.sourcePlaceholder')}
            value={source}
            onChange={(e) => { setSource(e.target.value); setValidationError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            autoFocus
          />
          {validationError && (
            <div style={{ color: 'var(--vscode-errorForeground)', fontSize: 11, marginTop: 4 }}>
              {validationError}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
            {t('skill.add.scope')}
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                name="skill-scope"
                checked={scope === 'global'}
                onChange={() => setScope('global')}
              />
              {t('skill.add.scopeGlobal')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: hasWorkspace ? 'pointer' : 'not-allowed', opacity: hasWorkspace ? 1 : 0.5 }}>
              <input
                type="radio"
                name="skill-scope"
                checked={scope === 'project'}
                onChange={() => setScope('project')}
                disabled={!hasWorkspace}
              />
              {t('skill.add.scopeProject')}
            </label>
          </div>
        </div>

        <div className="confirm-dialog-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={adding}>
            {t('skill.add.cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={adding}>
            {adding ? t('skill.page.adding') : t('skill.add.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RemoveConfirmDialog
// ---------------------------------------------------------------------------

interface RemoveConfirmDialogProps {
  skillName: string;
  skillScope: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemoveConfirmDialog({
  skillName,
  skillScope,
  onConfirm,
  onCancel,
}: RemoveConfirmDialogProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <ConfirmDialog
      title={t('skill.remove.title')}
      message={t('skill.remove.message').replace('{name}', skillName).replace('{scope}', skillScope)}
      danger
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
