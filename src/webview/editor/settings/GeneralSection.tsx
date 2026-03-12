import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { BooleanToggle, EnumDropdown, NumberSetting, TagInput, TextSetting } from './components/SettingControls';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_EFFORT_LEVELS = ['high', 'medium', 'low'] as const;
const KNOWN_OUTPUT_STYLES = ['auto', 'stream-json'] as const;
const KNOWN_AUTO_UPDATES_CHANNELS = ['stable', 'latest'] as const;

// ---------------------------------------------------------------------------
// GeneralSection
// ---------------------------------------------------------------------------

interface GeneralSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function GeneralSection({ scope, settings, onSave, onDelete }: GeneralSectionProps): React.ReactElement {
  const { t } = useI18n();

  const effortLabels: Record<string, string> = {
    high: t('settings.general.effortLevel.high'),
    medium: t('settings.general.effortLevel.medium'),
    low: t('settings.general.effortLevel.low'),
  };

  const outputLabels: Record<string, string> = {
    auto: t('settings.general.outputStyle.auto'),
    'stream-json': t('settings.general.outputStyle.streamJson'),
  };

  const autoUpdatesChannelLabels: Record<string, string> = {
    stable: t('settings.general.autoUpdatesChannel.stable'),
    latest: t('settings.general.autoUpdatesChannel.latest'),
  };

  const booleanFields: { key: keyof ClaudeSettings; label: string; description: string; defaultValue?: boolean }[] = [
    { key: 'enableAllProjectMcpServers', label: t('settings.general.enableAllProjectMcpServers.label'), description: t('settings.general.enableAllProjectMcpServers.description') },
    { key: 'includeGitInstructions', label: t('settings.general.includeGitInstructions.label'), description: t('settings.general.includeGitInstructions.description'), defaultValue: true },
    { key: 'respectGitignore', label: t('settings.general.respectGitignore.label'), description: t('settings.general.respectGitignore.description'), defaultValue: true },
    { key: 'fastMode', label: t('settings.general.fastMode.label'), description: t('settings.general.fastMode.description') },
    { key: 'fastModePerSessionOptIn', label: t('settings.general.fastModePerSessionOptIn.label'), description: t('settings.general.fastModePerSessionOptIn.description') },
    { key: 'autoMemoryEnabled', label: t('settings.general.autoMemoryEnabled.label'), description: t('settings.general.autoMemoryEnabled.description') },
    { key: 'alwaysThinkingEnabled', label: t('settings.general.alwaysThinkingEnabled.label'), description: t('settings.general.alwaysThinkingEnabled.description') },
  ];

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.general')}</h3>
      <p className="settings-field-description">
        {t('settings.general.docsHint')}
        <a href="https://code.claude.com/docs/en/settings" target="_blank" rel="noreferrer" className="settings-docs-link">
          {t('settings.general.docsLinkText')}
        </a>
      </p>

      <EnumDropdown
        label={t('settings.general.effortLevel.label')}
        description={t('settings.general.effortLevel.description')}
        value={settings.effortLevel}
        knownValues={KNOWN_EFFORT_LEVELS}
        knownLabels={effortLabels}
        notSetLabel={t('settings.general.effortLevel.notSet')}
        unknownTemplate={t('settings.general.effortLevel.unknown')}
        settingKey="effortLevel"
        onSave={onSave}
        onDelete={onDelete}
      />

      <TextSetting
        label={t('settings.general.language.label')}
        description={t('settings.general.language.description')}
        value={settings.language}
        placeholder={t('settings.general.language.placeholder')}
        saveLabel={t('settings.general.language.save')}
        clearLabel={t('settings.general.language.clear')}
        settingKey="language"
        scope={scope}
        onSave={onSave}
        onDelete={onDelete}
      />

      <TagInput
        label={t('settings.general.availableModels.label')}
        description={t('settings.general.availableModels.description')}
        scope={scope}
        tags={settings.availableModels ?? []}
        emptyPlaceholder={t('settings.general.availableModels.empty')}
        inputPlaceholder={t('settings.general.availableModels.placeholder')}
        addLabel={t('settings.general.availableModels.add')}
        duplicateError={t('settings.general.availableModels.duplicate')}
        settingKey="availableModels"
        onSave={onSave}
      />

      {booleanFields.map(({ key, label, description, defaultValue }) => (
        <BooleanToggle
          key={key}
          label={label}
          description={description}
          value={settings[key] as boolean | undefined}
          settingKey={key}
          defaultValue={defaultValue}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}

      <EnumDropdown
        label={t('settings.general.outputStyle.label')}
        value={settings.outputStyle}
        description={t('settings.general.outputStyle.description')}
        knownValues={KNOWN_OUTPUT_STYLES}
        knownLabels={outputLabels}
        notSetLabel={t('settings.general.outputStyle.notSet')}
        unknownTemplate={t('settings.general.outputStyle.unknown')}
        settingKey="outputStyle"
        onSave={onSave}
        onDelete={onDelete}
      />

      <EnumDropdown
        label={t('settings.general.autoUpdatesChannel.label')}
        description={t('settings.general.autoUpdatesChannel.description')}
        value={settings.autoUpdatesChannel}
        knownValues={KNOWN_AUTO_UPDATES_CHANNELS}
        knownLabels={autoUpdatesChannelLabels}
        notSetLabel={t('settings.general.autoUpdatesChannel.notSet')}
        unknownTemplate={t('settings.general.autoUpdatesChannel.unknown')}
        settingKey="autoUpdatesChannel"
        onSave={onSave}
        onDelete={onDelete}
      />

      <NumberSetting
        label={t('settings.general.cleanupPeriodDays.label')}
        description={t('settings.general.cleanupPeriodDays.description')}
        value={settings.cleanupPeriodDays}
        placeholder={t('settings.general.cleanupPeriodDays.placeholder')}
        saveLabel={t('settings.general.cleanupPeriodDays.save')}
        clearLabel={t('settings.general.cleanupPeriodDays.clear')}
        settingKey="cleanupPeriodDays"
        scope={scope}
        min={0}
        step={1}
        minError={t('settings.general.cleanupPeriodDays.minError')}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}
