import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { BooleanToggle, NumberSetting, TagInput, TextSetting } from './components/SettingControls';
import { CLAUDE_SETTINGS_SCHEMA, getSchemaDefault } from '../../../shared/claude-settings-schema';
import { SchemaFieldRenderer } from './components/SchemaFieldRenderer';

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

  const booleanFields: { key: keyof ClaudeSettings; label: string; description: string }[] = [
    { key: 'enableAllProjectMcpServers', label: t('settings.general.enableAllProjectMcpServers.label'), description: t('settings.general.enableAllProjectMcpServers.description') },
    { key: 'includeGitInstructions', label: t('settings.general.includeGitInstructions.label'), description: t('settings.general.includeGitInstructions.description') },
    { key: 'respectGitignore', label: t('settings.general.respectGitignore.label'), description: t('settings.general.respectGitignore.description') },
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

      <SchemaFieldRenderer
        settingKey="effortLevel"
        schema={CLAUDE_SETTINGS_SCHEMA.effortLevel}
        value={settings.effortLevel}
        scope={scope}
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

      {booleanFields.map(({ key, label, description }) => (
        <BooleanToggle
          key={key}
          label={label}
          description={description}
          value={settings[key] as boolean | undefined}
          settingKey={key}
          defaultValue={getSchemaDefault<boolean>(key)}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}

      <TextSetting
        label={t('settings.general.outputStyle.label')}
        description={t('settings.general.outputStyle.description')}
        value={settings.outputStyle}
        placeholder={t('settings.general.outputStyle.placeholder')}
        saveLabel={t('settings.general.outputStyle.save')}
        clearLabel={t('settings.general.outputStyle.clear')}
        settingKey="outputStyle"
        scope={scope}
        onSave={onSave}
        onDelete={onDelete}
      />

      <SchemaFieldRenderer
        settingKey="autoUpdatesChannel"
        schema={CLAUDE_SETTINGS_SCHEMA.autoUpdatesChannel}
        value={settings.autoUpdatesChannel}
        scope={scope}
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
        defaultValue={getSchemaDefault<number>('cleanupPeriodDays')}
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
