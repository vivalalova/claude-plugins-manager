import React, { useState } from 'react';
import { ScopeBadge } from '../../components/ScopeBadge';
import type { AgentSkill } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

interface SkillCardProps {
  skill: AgentSkill;
  removing: boolean;
  onRemove: () => void;
  onOpenFile: () => void;
  onViewDetail: () => void;
}

/** 單一 skill 卡片（expandable，匹配 PluginCard 樣式） */
export const SkillCard = React.memo(function SkillCard({
  skill,
  removing,
  onRemove,
  onOpenFile,
  onViewDetail,
}: SkillCardProps): React.ReactElement {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const hasExpandableContent = skill.agents.length > 0 || !!skill.path;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, label')) return;
    if (hasExpandableContent) setExpanded((v) => !v);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, label')) return;
    if (!hasExpandableContent) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    setExpanded((v) => !v);
  };

  return (
    <div
      className={`card${hasExpandableContent ? ' card--expandable' : ''}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      role="group"
      aria-label={skill.name}
      aria-expanded={hasExpandableContent ? expanded : undefined}
    >
      <div className="card-header">
        <div>
          <span className="card-name">{skill.name}</span>
        </div>
        <div className="card-header-right">
          <button className="btn btn-sm" onClick={onViewDetail}>
            {t('skill.card.viewDetail')}
          </button>
          <button className="btn btn-sm" onClick={onOpenFile} title={t('skill.card.openFile')}>
            {t('skill.card.openFile')}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={onRemove}
            disabled={removing}
          >
            {removing ? t('skill.card.removing') : t('skill.card.remove')}
          </button>
        </div>
      </div>

      <div className="card-description">
        {skill.description || t('skill.card.noDescription')}
      </div>

      <div className="scope-chips-row">
        {hasExpandableContent
          ? <span className={`card-expand-arrow${expanded ? ' card-expand-arrow--open' : ''}`} />
          : <span className="card-expand-arrow-spacer" />}
        <ScopeBadge scope={skill.scope} />
      </div>

      {hasExpandableContent && (
        <div className={`plugin-contents${expanded ? '' : ' plugin-contents--collapsed'}`}>
          <div className="section-body-inner">
            <div className="plugin-contents-grid">
              {skill.agents.length > 0 && (
                <div className="content-section">
                  <div className="content-section-label">Agents</div>
                  <div className="skill-agents">
                    {skill.agents.map((agent) => (
                      <span key={agent} className="skill-agent-tag">{agent}</span>
                    ))}
                  </div>
                </div>
              )}
              {skill.path && (
                <div className="content-section">
                  <div className="content-section-label">Path</div>
                  <div className="skill-path">{skill.path}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
