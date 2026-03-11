import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';

interface DisplaySectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function DisplaySection(_props: DisplaySectionProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.display')}</h3>
    </div>
  );
}
