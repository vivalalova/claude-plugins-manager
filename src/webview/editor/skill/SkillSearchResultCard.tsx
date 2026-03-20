import React from 'react';
import type { SkillSearchResult } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

interface SkillSearchResultCardProps {
  result: SkillSearchResult;
  installing: boolean;
  hasWorkspace: boolean;
  onInstall: (source: string) => void;
  onViewOnline: (url: string) => void;
}

/** 線上搜尋結果卡片 */
export const SkillSearchResultCard = React.memo(function SkillSearchResultCard({
  result,
  installing,
  onInstall,
  onViewOnline,
}: SkillSearchResultCardProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="card" tabIndex={0} role="group" aria-label={result.name}>
      <div className="card-header">
        <div className="card-name-column">
          <span className="card-name">{result.name}</span>
          <span className="skill-search-repo">{result.repo}</span>
        </div>
        <div className="card-header-right">
          {result.url && (
            <button className="btn btn-sm" onClick={() => onViewOnline(result.url!)}>
              {t('skill.search.viewOnline')}
            </button>
          )}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onInstall(result.fullId)}
            disabled={installing}
          >
            {installing ? t('skill.search.installing') : t('skill.search.install')}
          </button>
        </div>
      </div>
      {result.installs && (
        <div className="skill-meta">
          <span>{t('skill.search.installs').replace('{count}', result.installs)}</span>
        </div>
      )}
    </div>
  );
});
