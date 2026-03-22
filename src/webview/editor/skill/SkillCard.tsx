import React from 'react';
import type { AgentSkill } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';
import { getAgentColor } from './agents';

interface SkillCardProps {
  skill: AgentSkill;
  removing: boolean;
  onRemove: () => void;
  onOpenFile: () => void;
  onViewDetail: () => void;
}

/** 單一 skill 卡片（flat layout，agents 與 scope 同列） */
export const SkillCard = React.memo(function SkillCard({
  skill,
  removing,
  onRemove,
  onOpenFile,
  onViewDetail,
}: SkillCardProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div
      className="card"
      tabIndex={0}
      role="group"
      aria-label={skill.name}
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

      {skill.agents.length > 0 && (
        <div className="scope-chips-row">
          {skill.agents.map((agent) => {
            const color = getAgentColor(agent);
            return (
              <span
                key={agent}
                className="skill-agent-tag"
                style={{ background: color.bg, color: color.fg }}
              >
                {agent}
              </span>
            );
          })}
        </div>
      )}

      {skill.path && (
        <div className="skill-path">{skill.path}</div>
      )}
    </div>
  );
});
