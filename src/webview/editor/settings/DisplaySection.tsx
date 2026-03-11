import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { BooleanToggle, EnumDropdown } from './components/SettingControls';

const KNOWN_TEAMMATE_MODES = ['auto', 'inline', 'tmux', 'iterm2'] as const;

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

  const teammateModeLabels: Record<string, string> = {
    auto: t('settings.display.teammateMode.auto'),
    inline: t('settings.display.teammateMode.inline'),
    tmux: t('settings.display.teammateMode.tmux'),
    iterm2: t('settings.display.teammateMode.iterm2'),
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.display')}</h3>

      <EnumDropdown
        label={t('settings.display.teammateMode.label')}
        description={t('settings.display.teammateMode.description')}
        value={settings.teammateMode}
        knownValues={KNOWN_TEAMMATE_MODES}
        knownLabels={teammateModeLabels}
        notSetLabel={t('settings.display.teammateMode.notSet')}
        unknownTemplate={t('settings.display.teammateMode.unknown')}
        settingKey="teammateMode"
        onSave={onSave}
        onDelete={onDelete}
      />

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
