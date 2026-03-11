import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { TextSetting } from './components/SettingControls';

interface AdvancedSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function AdvancedSection({ scope, settings, onSave, onDelete }: AdvancedSectionProps): React.ReactElement {
  const { t } = useI18n();

  const textFields: { key: keyof ClaudeSettings; label: string; description: string; placeholder: string; saveLabel: string; clearLabel: string }[] = [
    {
      key: 'plansDirectory',
      label: t('settings.advanced.plansDirectory.label'),
      description: t('settings.advanced.plansDirectory.description'),
      placeholder: t('settings.advanced.plansDirectory.placeholder'),
      saveLabel: t('settings.advanced.plansDirectory.save'),
      clearLabel: t('settings.advanced.plansDirectory.clear'),
    },
    {
      key: 'apiKeyHelper',
      label: t('settings.advanced.apiKeyHelper.label'),
      description: t('settings.advanced.apiKeyHelper.description'),
      placeholder: t('settings.advanced.apiKeyHelper.placeholder'),
      saveLabel: t('settings.advanced.apiKeyHelper.save'),
      clearLabel: t('settings.advanced.apiKeyHelper.clear'),
    },
    {
      key: 'otelHeadersHelper',
      label: t('settings.advanced.otelHeadersHelper.label'),
      description: t('settings.advanced.otelHeadersHelper.description'),
      placeholder: t('settings.advanced.otelHeadersHelper.placeholder'),
      saveLabel: t('settings.advanced.otelHeadersHelper.save'),
      clearLabel: t('settings.advanced.otelHeadersHelper.clear'),
    },
    {
      key: 'awsCredentialExport',
      label: t('settings.advanced.awsCredentialExport.label'),
      description: t('settings.advanced.awsCredentialExport.description'),
      placeholder: t('settings.advanced.awsCredentialExport.placeholder'),
      saveLabel: t('settings.advanced.awsCredentialExport.save'),
      clearLabel: t('settings.advanced.awsCredentialExport.clear'),
    },
    {
      key: 'awsAuthRefresh',
      label: t('settings.advanced.awsAuthRefresh.label'),
      description: t('settings.advanced.awsAuthRefresh.description'),
      placeholder: t('settings.advanced.awsAuthRefresh.placeholder'),
      saveLabel: t('settings.advanced.awsAuthRefresh.save'),
      clearLabel: t('settings.advanced.awsAuthRefresh.clear'),
    },
  ];

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.advanced')}</h3>

      {textFields.map(({ key, label, description, placeholder, saveLabel, clearLabel }) => (
        <TextSetting
          key={key}
          label={label}
          description={description}
          value={settings[key] as string | undefined}
          placeholder={placeholder}
          saveLabel={saveLabel}
          clearLabel={clearLabel}
          settingKey={key}
          scope={scope}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
