import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { BooleanToggle } from './components/SettingControls';

interface DisplaySectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function DisplaySection({ scope: _scope, settings, onSave, onDelete }: DisplaySectionProps): React.ReactElement {
  const { t } = useI18n();

  const booleanFields: { key: keyof ClaudeSettings; label: string; description: string }[] = [
    { key: 'showTurnDuration', label: t('settings.display.showTurnDuration.label'), description: t('settings.display.showTurnDuration.description') },
    { key: 'spinnerTipsEnabled', label: t('settings.display.spinnerTipsEnabled.label'), description: t('settings.display.spinnerTipsEnabled.description') },
    { key: 'terminalProgressBarEnabled', label: t('settings.display.terminalProgressBarEnabled.label'), description: t('settings.display.terminalProgressBarEnabled.description') },
    { key: 'prefersReducedMotion', label: t('settings.display.prefersReducedMotion.label'), description: t('settings.display.prefersReducedMotion.description') },
  ];

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.display')}</h3>

      {booleanFields.map(({ key, label, description }) => (
        <BooleanToggle
          key={key}
          label={label}
          description={description}
          value={settings[key] as boolean | undefined}
          settingKey={key}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
