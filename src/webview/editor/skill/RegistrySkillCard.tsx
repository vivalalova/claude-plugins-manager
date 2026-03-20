import React from 'react';
import type { RegistrySkill } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

interface RegistrySkillCardProps {
  skill: RegistrySkill;
  isInstalled: boolean;
  installing: boolean;
  hasWorkspace: boolean;
  onInstall: (source: string) => void;
  onViewOnline: (url: string) => void;
}

/** Registry 排行榜 skill 卡片 */
export const RegistrySkillCard = React.memo(function RegistrySkillCard({
  skill,
  isInstalled,
  installing,
  onInstall,
  onViewOnline,
}: RegistrySkillCardProps): React.ReactElement {
  const { t } = useI18n();

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
          {isInstalled ? (
            <span className="registry-installed-badge">{t('skill.registry.installed')}</span>
          ) : (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onInstall(skill.repo)}
              disabled={installing}
            >
              {installing ? t('skill.search.installing') : t('skill.search.install')}
            </button>
          )}
        </div>
      </div>
      <div className="skill-meta">
        <span>{t('skill.search.installs').replace('{count}', skill.installs)}</span>
      </div>
    </div>
  );
});
