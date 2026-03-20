import React, { useState } from 'react';
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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
    const isCollapsed = collapsed.has(scopeKey);
    return (
      <div className="plugin-section">
        <div className="section-header">
          <button
            className={`section-toggle${isCollapsed ? ' section-toggle--collapsed' : ''}`}
            onClick={() => toggleCollapsed(scopeKey)}
          >
            <span className={`section-chevron${isCollapsed ? ' section-chevron--collapsed' : ''}`}>&#9662;</span>
            <span className="section-toggle-label">{title}</span>
            <span className="section-count">{skills.length}</span>
          </button>
        </div>
        <div className={`section-body${isCollapsed ? ' section-body--collapsed' : ''}`}>
          <div className="section-body-inner">
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
        </div>
      </div>
    );
  };

  return (
    <>
      {renderSection(t('skill.section.global'), 'global', globalSkills)}
      {renderSection(t('skill.section.project'), 'project', projectSkills)}
    </>
  );
}
