import React from 'react';
import type { SkillSearchResult, SkillScope } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';
import { ScopePicker } from './ScopePicker';

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

  return (
    <div className="card" tabIndex={0} role="group" aria-label={result.name}>
      <div className="card-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="card-name">{result.name}</span>
          <span className="skill-search-repo">{result.repo}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {result.url && (
            <button className="btn btn-sm" onClick={() => onViewOnline(result.url!)}>
              {t('skill.search.viewOnline')}
            </button>
          )}
          <ScopePicker
            installing={installing}
            hasWorkspace={hasWorkspace}
            onInstall={(scope) => onInstall(result.fullId, scope)}
          />
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
