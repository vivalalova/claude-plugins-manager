import React, { useState, useEffect, useId } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DialogOverlay } from '../../components/DialogOverlay';
import type { SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';
import { ALL_AGENTS } from './agents';

interface AddSkillDialogProps {
  open: boolean;
  adding: boolean;
  hasWorkspace: boolean;
  cachedAgents: string[];
  /** 預填 source（來自 search/registry Install 按鈕） */
  initialSource?: string;
  onSubmit: (source: string, scope: SkillScope, agents: string[]) => void;
  onClose: () => void;
}

export function AddSkillDialog({
  open,
  adding,
  hasWorkspace,
  cachedAgents,
  initialSource,
  onSubmit,
  onClose,
}: AddSkillDialogProps): React.ReactElement | null {
  const { t } = useI18n();
  const [source, setSource] = useState('');
  const [scope, setScope] = useState<SkillScope>('global');
  const [agents, setAgents] = useState<Set<string>>(() => new Set(cachedAgents));
  const [showAllAgents, setShowAllAgents] = useState(false);
  const [validationError, setValidationError] = useState('');
  const titleId = useId();

  // cachedAgents 變更時同步（例如 viewState 恢復）
  useEffect(() => {
    setAgents(new Set(cachedAgents));
  }, [cachedAgents]);

  // 開啟時重置表單；若有 initialSource 則預填
  useEffect(() => {
    if (open) {
      setSource(initialSource ?? '');
      setScope('global');
      setValidationError('');
    }
  }, [open, initialSource]);

  if (!open) return null;

  const toggleAgent = (agent: string): void => {
    setAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agent)) {
        next.delete(agent);
      } else {
        next.add(agent);
      }
      return next;
    });
  };

  const handleSubmit = (): void => {
    const trimmed = source.trim();
    if (!trimmed) {
      setValidationError(t('skill.add.validation'));
      return;
    }
    setValidationError('');
    onSubmit(trimmed, scope, [...agents]);
  };

  return (
    <DialogOverlay titleId={titleId} onClose={onClose}>
      <div className="confirm-dialog-title" id={titleId}>{t('skill.add.title')}</div>

      <div className="skill-dialog-field">
        <label htmlFor="skill-source" className="skill-dialog-label">
          {t('skill.add.source')}
        </label>
        <input
          id="skill-source"
          type="text"
          className="search-bar skill-dialog-input"
          placeholder={t('skill.add.sourcePlaceholder')}
          value={source}
          onChange={(e) => { setSource(e.target.value); setValidationError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          autoFocus
        />
        {validationError && (
          <div className="skill-dialog-error">{validationError}</div>
        )}
      </div>

      <div className="skill-dialog-field">
        <label className="skill-dialog-label">
          {t('skill.add.scope')}
        </label>
        <div className="skill-dialog-radio-group">
          <label className="skill-dialog-radio">
            <input
              type="radio"
              name="skill-scope"
              checked={scope === 'global'}
              onChange={() => setScope('global')}
            />
            {t('skill.add.scopeGlobal')}
          </label>
          <label className={`skill-dialog-radio${!hasWorkspace ? ' skill-dialog-radio--disabled' : ''}`}>
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

      <div className="skill-dialog-field">
        <label className="skill-dialog-label">
          {t('skill.add.agents')}
        </label>
        <div className="skill-dialog-hint">
          {t('skill.add.agentsHint')}
        </div>
        <div className="skill-dialog-agents-grid">
          {ALL_AGENTS.filter((a) => a.visible || showAllAgents).map((a) => (
            <label key={a.name} className="skill-dialog-agent-label">
              <input
                type="checkbox"
                checked={agents.has(a.name)}
                onChange={() => toggleAgent(a.name)}
              />
              {a.label}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="skill-dialog-toggle-link"
          onClick={() => setShowAllAgents((p) => !p)}
        >
          {showAllAgents ? t('skill.add.agentsShowLess') : t('skill.add.agentsShowAll')}
        </button>
      </div>

      <div className="confirm-dialog-actions">
        <button className="btn btn-secondary" onClick={onClose} disabled={adding}>
          {t('skill.add.cancel')}
        </button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={adding}>
          {adding ? t('skill.page.adding') : t('skill.add.confirm')}
        </button>
      </div>
    </DialogOverlay>
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
