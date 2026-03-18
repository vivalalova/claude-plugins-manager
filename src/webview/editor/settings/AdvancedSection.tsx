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
import { getOverriddenScope } from './components/SettingControls';
import { ADVANCED_FIELD_ORDER } from '../../../shared/field-orders';

// ---------------------------------------------------------------------------
// AdvancedSection
// ---------------------------------------------------------------------------

interface AdvancedSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  userSettings?: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function AdvancedSection({ scope, settings, userSettings, onSave, onDelete }: AdvancedSectionProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.advanced')}</h3>

      {ADVANCED_FIELD_ORDER.map((key) => {
        const schema = CLAUDE_SETTINGS_SCHEMA[key];
        if (!schema) return null;
        const overriddenScope = getOverriddenScope(scope, userSettings as Record<string, unknown>, key);

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
                  saveLabel={t('settings.common.save')}
                  clearLabel={t('settings.common.clear')}
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
              console.warn(`[AdvancedSection] Unhandled custom key: ${key}`);
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
            overriddenScope={overriddenScope}
            onSave={onSave}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}
