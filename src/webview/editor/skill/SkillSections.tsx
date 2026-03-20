import React from 'react';
import { SkillCard } from './SkillCard';
import type { AgentSkill } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

interface SkillSectionsProps {
  globalSkills: AgentSkill[];
  projectSkills: AgentSkill[];
  removingSkills: Set<string>;
  onRemove: (name: string, scope: AgentSkill['scope']) => void;
  onOpenFile: (path: string) => void;
  onViewDetail: (skill: AgentSkill) => void;
}

/** 按 scope 分組顯示 skill cards */
export function SkillSections({
  globalSkills,
  projectSkills,
  removingSkills,
  onRemove,
  onOpenFile,
  onViewDetail,
}: SkillSectionsProps): React.ReactElement {
  const { t } = useI18n();

  const renderSection = (title: string, skills: AgentSkill[]): React.ReactNode => {
    if (skills.length === 0) return null;
    return (
      <div className="mcp-section">
        <div className="mcp-section-header">
          <h3 className="mcp-section-title">{title} ({skills.length})</h3>
        </div>
        <div className="card-list">
          {skills.map((skill) => (
            <SkillCard
              key={`${skill.scope}:${skill.name}`}
              skill={skill}
              removing={removingSkills.has(`${skill.scope}:${skill.name}`)}
              onRemove={() => onRemove(skill.name, skill.scope)}
              onOpenFile={() => onOpenFile(skill.path)}
              onViewDetail={() => onViewDetail(skill)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderSection(t('skill.section.global'), globalSkills)}
      {renderSection(t('skill.section.project'), projectSkills)}
    </>
  );
}
