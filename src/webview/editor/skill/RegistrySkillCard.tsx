import React, { useState } from 'react';
import type { RegistrySkill, SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

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
  const [showScopePicker, setShowScopePicker] = useState(false);

  const handleScopeSelect = (scope: SkillScope): void => {
    setShowScopePicker(false);
    onInstall(skill.repo, scope);
  };

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
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, position: 'relative' }}>
          <button className="btn btn-sm" onClick={() => onViewOnline(skill.url)}>
            {t('skill.search.viewOnline')}
          </button>
          {isInstalled ? (
            <span className="registry-installed-badge">{t('skill.registry.installed')}</span>
          ) : (
            <>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setShowScopePicker(!showScopePicker)}
                disabled={installing}
              >
                {installing ? t('skill.search.installing') : t('skill.search.install')}
              </button>
              {showScopePicker && !installing && (
                <div className="skill-scope-picker">
                  <button className="skill-scope-picker-item" onClick={() => handleScopeSelect('global')}>
                    {t('skill.add.scopeGlobal')}
                  </button>
                  <button
                    className="skill-scope-picker-item"
                    onClick={() => handleScopeSelect('project')}
                    disabled={!hasWorkspace}
                  >
                    {t('skill.add.scopeProject')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="skill-meta">
        <span>{t('skill.search.installs').replace('{count}', skill.installs)}</span>
      </div>
    </div>
  );
});
