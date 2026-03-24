import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { TextSetting } from './components/SettingControls';
import { AttributionEditor } from './components/AttributionEditor';
import { StatusLineEditor } from './components/StatusLineEditor';
import { SandboxEditor } from './components/SandboxEditor';
import { CompanyAnnouncementsEditor } from './components/CompanyAnnouncementsEditor';
import { SchemaSection } from './components/SchemaSection';
import type { SectionProps } from './components/SchemaSection';

export function AdvancedSection(props: SectionProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <SchemaSection
      titleKey="settings.nav.advanced"
      section="advanced"
      renderCustom={(key, { scope, settings, overriddenScope, onSave, onDelete }) => {
        switch (key) {
          case 'attribution':
            return <AttributionEditor attribution={settings.attribution} onSave={onSave} onDelete={onDelete} />;
          case 'statusLine':
            return <StatusLineEditor statusLine={settings.statusLine} onSave={onSave} onDelete={onDelete} />;
          case 'fileSuggestion':
            return (
              <TextSetting
                label={t('settings.advanced.fileSuggestion.label')}
                description={t('settings.advanced.fileSuggestion.description')}
                value={settings.fileSuggestion?.command}
                placeholder={t('settings.advanced.fileSuggestion.command.placeholder')}
                saveLabel={t('settings.common.save')}
                clearLabel={t('settings.common.clear')}
                settingKey="fileSuggestion"
                scope={scope}
                overriddenScope={overriddenScope}
                onSave={async (_key, value) => onSave('fileSuggestion', { type: 'command', command: value as string })}
                onDelete={async () => onDelete('fileSuggestion')}
              />
            );
          case 'sandbox':
            return <SandboxEditor sandbox={settings.sandbox} onSave={onSave} onDelete={onDelete} />;
          case 'companyAnnouncements':
            return <CompanyAnnouncementsEditor scope={scope} announcements={settings.companyAnnouncements ?? []} onSave={onSave} />;
          default:
            return null;
        }
      }}
      {...props}
    />
  );
}
