import React, { useId, useMemo } from 'react';
import { marked } from 'marked';
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

/** Frontmatter 中作為 tag 顯示的欄位 */
const TAG_FIELDS = new Set(['model', 'context']);

/** Frontmatter 中拆成多 tag 的欄位（逗號分隔） */
const MULTI_TAG_FIELDS = new Set(['allowed-tools']);

/** Frontmatter 顯示順序（name/description 特殊處理，不在此列） */
const META_FIELDS = ['model', 'context', 'allowed-tools'];

/** 將 markdown body 轉為 HTML */
function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
}

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

  const bodyHtml = useMemo(
    () => (detail?.body ? renderMarkdown(detail.body) : ''),
    [detail?.body],
  );

  /** 取得 frontmatter 中不在已知欄位清單的額外 key */
  const extraFields = useMemo(() => {
    if (!detail) return [];
    const known = new Set(['name', 'description', ...META_FIELDS]);
    return Object.entries(detail.frontmatter).filter(([key]) => !known.has(key));
  }, [detail]);

  return (
    <DialogOverlay titleId={titleId} onClose={onClose} className="skill-detail-dialog">
      {/* ---- Header ---- */}
      <div className="skill-detail-header">
        <div className="skill-detail-title" id={titleId}>{skillName}</div>
        {detail?.frontmatter.description && (
          <div className="skill-detail-desc">{detail.frontmatter.description}</div>
        )}

        {/* Meta tags row */}
        {detail && (
          <div className="skill-detail-tags">
            {META_FIELDS.filter((key) => detail.frontmatter[key]).map((key) => {
              if (MULTI_TAG_FIELDS.has(key)) {
                return detail.frontmatter[key].split(',').map((v) => (
                  <span key={`${key}-${v.trim()}`} className="skill-detail-tag skill-detail-tag--tool">
                    {v.trim()}
                  </span>
                ));
              }
              return (
                <span
                  key={key}
                  className={`skill-detail-tag ${TAG_FIELDS.has(key) ? 'skill-detail-tag--meta' : ''}`}
                >
                  {key}: {detail.frontmatter[key]}
                </span>
              );
            })}
            {extraFields.map(([key, value]) => (
              <span key={key} className="skill-detail-tag">{key}: {value}</span>
            ))}
          </div>
        )}
      </div>

      {/* ---- Content ---- */}
      <div className="skill-detail-content">
        {loading ? (
          <div className="skill-search-hint">{t('skill.detail.loading')}</div>
        ) : !detail ? (
          <div className="skill-search-hint">{t('skill.detail.noContent')}</div>
        ) : bodyHtml ? (
          <div
            className="skill-detail-markdown"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : null}
      </div>

      {/* ---- Footer ---- */}
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
