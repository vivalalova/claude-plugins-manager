import React from 'react';
import type { RegistrySkill, SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';
import { ScopeToggle } from '../../components/ScopeToggle';

interface RegistrySkillCardProps {
  skill: RegistrySkill;
  /** 目前以 Claude Code agent 安裝的 scope 集合 */
  installedScopes: ReadonlySet<SkillScope>;
  /** 正在 loading（remove 中）的 scope 集合 */
  loadingScopes: ReadonlySet<SkillScope>;
  /** 安裝操作進行中（disable 所有 scope toggle） */
  installing: boolean;
  hasWorkspace: boolean;
  onScopeToggle: (repo: string, skillName: string, scope: SkillScope, enable: boolean) => void;
  onViewOnline: (url: string) => void;
}

/** Registry 排行榜 skill 卡片。每個 scope 一個 checkbox：勾 = 已安裝，取消勾 = 移除。 */
export const RegistrySkillCard = React.memo(function RegistrySkillCard({
  skill,
  installedScopes,
  loadingScopes,
  installing,
  hasWorkspace,
  onScopeToggle,
  onViewOnline,
}: RegistrySkillCardProps): React.ReactElement {
  const { t } = useI18n();
  const scopeControlsDisabled = installing || loadingScopes.size > 0;

  return (
    <div className="card" tabIndex={0} role="group" aria-label={skill.name}>
      <div className="card-header">
        <div className="card-name-with-rank">
          <span className="registry-rank">#{skill.rank}</span>
          <div className="card-name-column">
            <span className="card-name">{skill.name}</span>
            <span className="skill-search-repo">{skill.repo}</span>
          </div>
        </div>
        <div className="card-header-right">
          <button className="btn btn-sm" onClick={() => onViewOnline(skill.url)}>
            {t('skill.search.viewOnline')}
          </button>
        </div>
      </div>
      <div className="skill-meta">
        <span>{t('skill.search.installs').replace('{count}', skill.installs)}</span>
      </div>
      <div className="scope-chips-row">
        <span className="card-expand-arrow-spacer" />
        <div
          className="scope-chips"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <ScopeToggle
            label={t('skill.add.scopeGlobal')}
            scope="global"
            enabled={installedScopes.has('global')}
            loading={loadingScopes.has('global')}
            disabled={scopeControlsDisabled}
            onToggle={(on) => onScopeToggle(skill.repo, skill.name, 'global', on)}
          />
          <ScopeToggle
            label={t('skill.add.scopeProject')}
            scope="project"
            enabled={installedScopes.has('project')}
            loading={loadingScopes.has('project')}
            disabled={scopeControlsDisabled || !hasWorkspace}
            onToggle={(on) => onScopeToggle(skill.repo, skill.name, 'project', on)}
          />
        </div>
      </div>
    </div>
  );
});
