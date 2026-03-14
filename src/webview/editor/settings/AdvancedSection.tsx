import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { BooleanToggle, TextSetting } from './components/SettingControls';
import { AttributionEditor } from './components/AttributionEditor';
import { StatusLineEditor } from './components/StatusLineEditor';
import { SandboxEditor } from './components/SandboxEditor';
import { CompanyAnnouncementsEditor } from './components/CompanyAnnouncementsEditor';
import { CLAUDE_SETTINGS_SCHEMA, getSchemaDefault } from '../../../shared/claude-settings-schema';
import { SchemaFieldRenderer } from './components/SchemaFieldRenderer';

const TEXT_FIELD_KEYS: (keyof ClaudeSettings)[] = [
  'forceLoginOrgUUID', 'plansDirectory', 'apiKeyHelper',
  'otelHeadersHelper', 'awsCredentialExport', 'awsAuthRefresh',
];

interface AdvancedSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function AdvancedSection({ scope, settings, onSave, onDelete }: AdvancedSectionProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.advanced')}</h3>
      <SchemaFieldRenderer
        settingKey="forceLoginMethod"
        schema={CLAUDE_SETTINGS_SCHEMA.forceLoginMethod}
        value={settings.forceLoginMethod}
        scope={scope}
        onSave={onSave}
        onDelete={onDelete}
      />
      <AttributionEditor attribution={settings.attribution} onSave={onSave} onDelete={onDelete} />
      <StatusLineEditor statusLine={settings.statusLine} onSave={onSave} onDelete={onDelete} />
      <TextSetting
        label={t('settings.advanced.fileSuggestion.label')}
        description={t('settings.advanced.fileSuggestion.description')}
        value={settings.fileSuggestion?.command}
        placeholder={t('settings.advanced.fileSuggestion.command.placeholder')}
        saveLabel={t('settings.advanced.fileSuggestion.save')}
        clearLabel={t('settings.advanced.fileSuggestion.clear')}
        settingKey="fileSuggestion"
        scope={scope}
        onSave={async (_key, value) => onSave('fileSuggestion', { type: 'command', command: value as string })}
        onDelete={async () => onDelete('fileSuggestion')}
      />
      <SandboxEditor sandbox={settings.sandbox} onSave={onSave} onDelete={onDelete} />
      <CompanyAnnouncementsEditor scope={scope} announcements={settings.companyAnnouncements ?? []} onSave={onSave} />
      {TEXT_FIELD_KEYS.map((key) => {
        const tk = (suffix: string) => t(`settings.advanced.${key}.${suffix}` as Parameters<typeof t>[0]);
        return (
          <TextSetting
            key={key}
            label={tk('label')}
            description={tk('description')}
            value={settings[key] as string | undefined}
            placeholder={tk('placeholder')}
            saveLabel={tk('save')}
            clearLabel={tk('clear')}
            settingKey={key}
            defaultValue={getSchemaDefault<string>(key)}
            scope={scope}
            onSave={onSave}
            onDelete={onDelete}
          />
        );
      })}
      <BooleanToggle
        label={t('settings.advanced.skipWebFetchPreflight.label')}
        description={t('settings.advanced.skipWebFetchPreflight.description')}
        value={settings.skipWebFetchPreflight}
        settingKey="skipWebFetchPreflight"
        defaultValue={getSchemaDefault<boolean>('skipWebFetchPreflight')}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}
