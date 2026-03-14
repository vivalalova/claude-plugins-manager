import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { TextSetting } from './components/SettingControls';
import { AttributionEditor } from './components/AttributionEditor';
import { StatusLineEditor } from './components/StatusLineEditor';
import { SandboxEditor } from './components/SandboxEditor';
import { CompanyAnnouncementsEditor } from './components/CompanyAnnouncementsEditor';
import { CLAUDE_SETTINGS_SCHEMA } from '../../../shared/claude-settings-schema';
import { SchemaFieldRenderer } from './components/SchemaFieldRenderer';

// ---------------------------------------------------------------------------
// AdvancedSection
// ---------------------------------------------------------------------------

/** 欄位渲染順序（與改造前一致） */
export const ADVANCED_FIELD_ORDER: (keyof ClaudeSettings)[] = [
  'forceLoginMethod',
  'attribution',
  'statusLine',
  'fileSuggestion',
  'sandbox',
  'companyAnnouncements',
  'forceLoginOrgUUID',
  'plansDirectory',
  'apiKeyHelper',
  'otelHeadersHelper',
  'awsCredentialExport',
  'awsAuthRefresh',
  'skipWebFetchPreflight',
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

      {ADVANCED_FIELD_ORDER.map((key) => {
        const schema = CLAUDE_SETTINGS_SCHEMA[key];
        if (!schema) return null;

        if (schema.controlType === 'custom') {
          switch (key) {
            case 'attribution':
              return <AttributionEditor key={key} attribution={settings.attribution} onSave={onSave} onDelete={onDelete} />;
            case 'statusLine':
              return <StatusLineEditor key={key} statusLine={settings.statusLine} onSave={onSave} onDelete={onDelete} />;
            case 'fileSuggestion':
              return (
                <TextSetting
                  key={key}
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
              );
            case 'sandbox':
              return <SandboxEditor key={key} sandbox={settings.sandbox} onSave={onSave} onDelete={onDelete} />;
            case 'companyAnnouncements':
              return <CompanyAnnouncementsEditor key={key} scope={scope} announcements={settings.companyAnnouncements ?? []} onSave={onSave} />;
            default:
              return null;
          }
        }

        return (
          <SchemaFieldRenderer
            key={key}
            settingKey={key}
            schema={schema}
            value={(settings as Record<string, unknown>)[key]}
            scope={scope}
            onSave={onSave}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}
