import React from 'react';
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

/** 單一 skill 卡片 */
export const SkillCard = React.memo(function SkillCard({
  skill,
  removing,
  onRemove,
  onOpenFile,
  onViewDetail,
}: SkillCardProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="card" tabIndex={0} role="group" aria-label={skill.name}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="card-name">{skill.name}</span>
          <ScopeBadge scope={skill.scope} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
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
      {skill.agents.length > 0 && (
        <div className="skill-agents">
          {skill.agents.map((agent) => (
            <span key={agent} className="skill-agent-tag">{agent}</span>
          ))}
        </div>
      )}
      <div className="skill-path">{skill.path}</div>
    </div>
  );
});
