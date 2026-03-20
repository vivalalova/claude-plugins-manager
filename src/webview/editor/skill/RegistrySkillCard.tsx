import React from 'react';
import type { RegistrySkill, SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';
import { ScopePicker } from './ScopePicker';

interface RegistrySkillCardProps {
  skill: RegistrySkill;
  isInstalled: boolean;
  installing: boolean;
  hasWorkspace: boolean;
  onInstall: (source: string, scope: SkillScope) => void;
  onViewOnline: (url: string) => void;
}

/** Registry 排行榜 skill 卡片 */
export const RegistrySkillCard = React.memo(function RegistrySkillCard({
  skill,
  isInstalled,
  installing,
  hasWorkspace,
  onInstall,
  onViewOnline,
}: RegistrySkillCardProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="card" tabIndex={0} role="group" aria-label={skill.name}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="registry-rank">#{skill.rank}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span className="card-name">{skill.name}</span>
            <span className="skill-search-repo">{skill.repo}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <button className="btn btn-sm" onClick={() => onViewOnline(skill.url)}>
            {t('skill.search.viewOnline')}
          </button>
          {isInstalled ? (
            <span className="registry-installed-badge">{t('skill.registry.installed')}</span>
          ) : (
            <ScopePicker
              installing={installing}
              hasWorkspace={hasWorkspace}
              onInstall={(scope) => onInstall(skill.repo, scope)}
            />
          )}
        </div>
      </div>
      <div className="skill-meta">
        <span>{t('skill.search.installs').replace('{count}', skill.installs)}</span>
      </div>
    </div>
  );
});
