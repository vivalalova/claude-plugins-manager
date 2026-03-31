import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { OrphanedPlugin, PluginScope } from '../../../shared/types';

interface OrphanedSectionProps {
  orphaned: OrphanedPlugin[];
  removing: Set<string>;
  onRemove: (pluginId: string, scope: PluginScope, projectPath?: string) => void;
  onRemoveAll: () => void;
}

/** orphaned entry 的唯一 key（同 plugin 可有多 scope） */
function orphanKey(o: OrphanedPlugin): string {
  return `${o.id}:${o.scope}:${o.projectPath ?? ''}`;
}

export function OrphanedSection({
  orphaned,
  removing,
  onRemove,
  onRemoveAll,
}: OrphanedSectionProps): React.ReactElement | null {
  const { t } = useI18n();

  if (orphaned.length === 0) return null;

  const isRemovingAll = removing.size > 0 && removing.size === orphaned.length;

  return (
    <>
      <div className="section-divider-header">
        <span className="section-divider-label">{t('plugin.orphan.title')}</span>
        <span className="section-divider-line" />
      </div>
      <div className="orphan-section">
        <p className="orphan-description">{t('plugin.orphan.description')}</p>
        <div className="orphan-actions">
          <button
            className="btn btn-danger btn-sm"
            onClick={onRemoveAll}
            disabled={isRemovingAll}
          >
            {isRemovingAll ? t('plugin.orphan.removing') : t('plugin.orphan.removeAll')}
          </button>
        </div>
        <div className="card-list">
          {orphaned.map((o) => {
            const key = orphanKey(o);
            const isRemoving = removing.has(key);
            return (
              <div key={key} className="card orphan-card">
                <div className="orphan-card-header">
                  <span className="orphan-card-name">{o.id}</span>
                  <span className={`scope-badge scope-badge--${o.scope}`}>{o.scope}</span>
                </div>
                <div className="orphan-card-path">{o.installPath}</div>
                <div className="orphan-card-actions">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => onRemove(o.id, o.scope, o.projectPath)}
                    disabled={isRemoving}
                  >
                    {isRemoving ? t('plugin.orphan.removing') : t('plugin.orphan.remove')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
