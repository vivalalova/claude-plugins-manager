import React, { useState } from 'react';
import type { SkillSearchResult, SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

interface SkillSearchResultCardProps {
  result: SkillSearchResult;
  installing: boolean;
  hasWorkspace: boolean;
  onInstall: (source: string, scope: SkillScope) => void;
  onViewOnline: (url: string) => void;
}

/** 線上搜尋結果卡片 */
export const SkillSearchResultCard = React.memo(function SkillSearchResultCard({
  result,
  installing,
  hasWorkspace,
  onInstall,
  onViewOnline,
}: SkillSearchResultCardProps): React.ReactElement {
  const { t } = useI18n();
  const [showScopePicker, setShowScopePicker] = useState(false);

  const handleInstallClick = (): void => {
    if (showScopePicker) {
      setShowScopePicker(false);
    } else {
      setShowScopePicker(true);
    }
  };

  const handleScopeSelect = (scope: SkillScope): void => {
    setShowScopePicker(false);
    onInstall(result.fullId, scope);
  };

  return (
    <div className="card" tabIndex={0} role="group" aria-label={result.name}>
      <div className="card-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="card-name">{result.name}</span>
          <span className="skill-search-repo">{result.repo}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, position: 'relative' }}>
          {result.url && (
            <button
              className="btn btn-sm"
              onClick={() => onViewOnline(result.url!)}
            >
              {t('skill.search.viewOnline')}
            </button>
          )}
          <button
            className="btn btn-sm btn-primary"
            onClick={handleInstallClick}
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
        </div>
      </div>
      <div className="skill-meta">
        {result.installs && (
          <span>{t('skill.search.installs').replace('{count}', result.installs)}</span>
        )}
      </div>
    </div>
  );
});
