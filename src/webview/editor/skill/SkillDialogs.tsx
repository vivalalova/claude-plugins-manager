import React, { useState, useEffect, useId } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

// ---------------------------------------------------------------------------
// AddSkillDialog
// ---------------------------------------------------------------------------

/** skills CLI 支援的所有 agents。visible: 是否預設顯示於 UI（常用的優先顯示）。 */
const ALL_AGENTS: ReadonlyArray<{ name: string; label: string; visible: boolean }> = [
  { name: 'claude-code', label: 'Claude Code', visible: true },
  { name: 'cursor', label: 'Cursor', visible: true },
  { name: 'gemini-cli', label: 'Gemini CLI', visible: true },
  { name: 'github-copilot', label: 'GitHub Copilot', visible: true },
  { name: 'codex', label: 'Codex', visible: true },
  { name: 'windsurf', label: 'Windsurf', visible: true },
  { name: 'cline', label: 'Cline', visible: true },
  { name: 'roo', label: 'Roo Code', visible: true },
  { name: 'amp', label: 'Amp', visible: false },
  { name: 'antigravity', label: 'Antigravity', visible: false },
  { name: 'augment', label: 'Augment', visible: false },
  { name: 'openclaw', label: 'OpenClaw', visible: false },
  { name: 'codebuddy', label: 'CodeBuddy', visible: false },
  { name: 'command-code', label: 'Command Code', visible: false },
  { name: 'continue', label: 'Continue', visible: false },
  { name: 'cortex', label: 'Cortex Code', visible: false },
  { name: 'crush', label: 'Crush', visible: false },
  { name: 'droid', label: 'Droid', visible: false },
  { name: 'goose', label: 'Goose', visible: false },
  { name: 'iflow-cli', label: 'iFlow CLI', visible: false },
  { name: 'junie', label: 'Junie', visible: false },
  { name: 'kilo', label: 'Kilo Code', visible: false },
  { name: 'kimi-cli', label: 'Kimi Code CLI', visible: false },
  { name: 'kiro-cli', label: 'Kiro CLI', visible: false },
  { name: 'kode', label: 'Kode', visible: false },
  { name: 'mcpjam', label: 'MCPJam', visible: false },
  { name: 'mistral-vibe', label: 'Mistral Vibe', visible: false },
  { name: 'mux', label: 'Mux', visible: false },
  { name: 'neovate', label: 'Neovate', visible: false },
  { name: 'opencode', label: 'OpenCode', visible: false },
  { name: 'openhands', label: 'OpenHands', visible: false },
  { name: 'pi', label: 'Pi', visible: false },
  { name: 'pochi', label: 'Pochi', visible: false },
  { name: 'qoder', label: 'Qoder', visible: false },
  { name: 'qwen-code', label: 'Qwen Code', visible: false },
  { name: 'replit', label: 'Replit', visible: false },
  { name: 'trae', label: 'Trae', visible: false },
  { name: 'trae-cn', label: 'Trae CN', visible: false },
  { name: 'warp', label: 'Warp', visible: false },
  { name: 'zencoder', label: 'Zencoder', visible: false },
  { name: 'adal', label: 'AdaL', visible: false },
];

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
  const trapRef = useFocusTrap(onClose, open);

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
