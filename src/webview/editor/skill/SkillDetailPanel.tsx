import React, { useId } from 'react';
import { DialogOverlay } from '../../components/DialogOverlay';
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

  return (
    <DialogOverlay titleId={titleId} onClose={onClose} className="skill-detail-dialog">
      <div className="skill-detail-header">
        <div className="skill-detail-title" id={titleId}>{skillName}</div>
      </div>

      <div className="skill-detail-content">
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
      </div>

      <div className="skill-detail-actions">
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
    </DialogOverlay>
  );
}
