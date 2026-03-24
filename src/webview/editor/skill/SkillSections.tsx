import React, { useState } from 'react';
import { SkillCard } from './SkillCard';
import { CardSection } from '../../components/CardSection';
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

/** 按 scope 分組顯示 skill cards（collapsible sections） */
export function SkillSections({
  globalSkills,
  projectSkills,
  removingSkills,
  onRemove,
  onOpenFile,
  onViewDetail,
}: SkillSectionsProps): React.ReactElement {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['global', 'project']));

  const toggleCollapsed = (key: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderSection = (title: string, scopeKey: string, skills: AgentSkill[]): React.ReactNode => {
    if (skills.length === 0) return null;
    return (
      <CardSection
        variant="collapsible"
        title={title}
        count={skills.length}
        isCollapsed={collapsed.has(scopeKey)}
        onToggle={() => toggleCollapsed(scopeKey)}
      >
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
      </CardSection>
    );
  };

  return (
    <>
      {renderSection(t('skill.section.global'), 'global', globalSkills)}
      {renderSection(t('skill.section.project'), 'project', projectSkills)}
    </>
  );
}
