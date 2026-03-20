import React, { useId } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useI18n } from '../../i18n/I18nContext';

interface SkillDetail {
  frontmatter: Record<string, string>;
  body: string;
}

interface SkillDetailPanelProps {
  skillName: string;
  skillPath: string;
  detail: SkillDetail | null;
  loading: boolean;
  onClose: () => void;
  onOpenInEditor: () => void;
  onCopyPath: () => void;
}

/** Frontmatter 顯示的欄位順序（缺失的不顯示） */
const FRONTMATTER_FIELDS = ['name', 'description', 'model', 'context', 'allowed-tools'];

/** Skill detail overlay — 顯示 SKILL.md frontmatter + body */
export function SkillDetailPanel({
  skillName,
  skillPath: _skillPath,
  detail,
  loading,
  onClose,
  onOpenInEditor,
  onCopyPath,
}: SkillDetailPanelProps): React.ReactElement {
  const { t } = useI18n();
  const titleId = useId();
  const trapRef = useFocusTrap(onClose);

  const handleOverlayDismiss = (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (e.target !== e.currentTarget) return;
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    onClose();
  };

  return (
    <div className="confirm-overlay" onClick={handleOverlayDismiss} onKeyDown={handleOverlayDismiss}>
      <div ref={trapRef} className="confirm-dialog skill-detail-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="confirm-dialog-title" id={titleId}>{skillName}</div>

        {loading ? (
          <div className="skill-search-hint">{t('skill.detail.loading')}</div>
        ) : !detail ? (
          <div className="skill-search-hint">{t('skill.detail.noContent')}</div>
        ) : (
          <>
            {Object.keys(detail.frontmatter).length > 0 && (
              <div className="skill-detail-section">
                <h4 className="skill-detail-section-title">{t('skill.detail.frontmatter')}</h4>
                <div className="skill-detail-metadata">
                  {FRONTMATTER_FIELDS.filter((key) => detail.frontmatter[key]).map((key) => (
                    <div key={key} className="skill-detail-row">
                      <span className="skill-detail-label">{key}</span>
                      <span className="skill-detail-value">{detail.frontmatter[key]}</span>
                    </div>
                  ))}
                  {/* 顯示不在 FRONTMATTER_FIELDS 中的額外欄位 */}
                  {Object.entries(detail.frontmatter)
                    .filter(([key]) => !FRONTMATTER_FIELDS.includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="skill-detail-row">
                        <span className="skill-detail-label">{key}</span>
                        <span className="skill-detail-value">{value}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {detail.body && (
              <div className="skill-detail-section">
                <h4 className="skill-detail-section-title">{t('skill.detail.body')}</h4>
                <pre className="skill-detail-body">{detail.body}</pre>
              </div>
            )}
          </>
        )}

        <div className="confirm-dialog-actions">
          <button className="btn btn-sm" onClick={onOpenInEditor}>
            {t('skill.detail.openInEditor')}
          </button>
          <button className="btn btn-sm" onClick={onCopyPath}>
            {t('skill.detail.copyPath')}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('skill.detail.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
