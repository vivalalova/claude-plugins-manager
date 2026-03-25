import React, { useId, useMemo } from 'react';
import { marked } from 'marked';
import { DialogOverlay } from './DialogOverlay';
import { useI18n } from '../i18n/I18nContext';

export interface ContentDetail {
  frontmatter: Record<string, string>;
  body: string;
}

interface ContentDetailPanelProps {
  /** 顯示在標題的名稱 */
  name: string;
  detail: ContentDetail | null;
  loading: boolean;
  onClose: () => void;
  onOpenInEditor?: () => void;
}

/** Frontmatter 中作為 tag 顯示的欄位 */
const TAG_FIELDS = new Set(['model', 'context']);

/** Frontmatter 中拆成多 tag 的欄位（逗號分隔） */
const MULTI_TAG_FIELDS = new Set(['allowed-tools', 'agents']);

/** Frontmatter 顯示順序（name/description 特殊處理，不在此列） */
const META_FIELDS = ['model', 'context', 'allowed-tools', 'agents'];

/** 將 markdown body 轉為 HTML */
function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
}

/**
 * 通用 markdown 詳情 overlay。
 * 顯示 .md 檔案的 frontmatter tags + body（markdown 渲染）。
 * 供 plugin content items（commands/skills/agents）使用。
 */
export function ContentDetailPanel({
  name,
  detail,
  loading,
  onClose,
  onOpenInEditor,
}: ContentDetailPanelProps): React.ReactElement {
  const { t } = useI18n();
  const titleId = useId();

  const bodyHtml = useMemo(
    () => (detail?.body ? renderMarkdown(detail.body) : ''),
    [detail?.body],
  );

  const extraFields = useMemo(() => {
    if (!detail) return [];
    const known = new Set(['name', 'description', ...META_FIELDS]);
    return Object.entries(detail.frontmatter).filter(([key]) => !known.has(key));
  }, [detail]);

  return (
    <DialogOverlay titleId={titleId} onClose={onClose} className="skill-detail-dialog">
      {/* ---- Header ---- */}
      <div className="skill-detail-header">
        <div className="skill-detail-title" id={titleId}>{name}</div>
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
        {onOpenInEditor && (
          <button className="btn btn-sm" onClick={onOpenInEditor}>
            {t('skill.detail.openInEditor')}
          </button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>
          {t('skill.detail.close')}
        </button>
      </div>
    </DialogOverlay>
  );
}
