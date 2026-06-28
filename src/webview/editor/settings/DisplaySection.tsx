import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { TextSetting } from './components/SettingControls';
import { SchemaSection } from './components/SchemaSection';
import type { SectionProps } from './components/SchemaSection';
import { ObjectFieldEditor, OBJECT_EDITOR_KEYS } from './components/ObjectFieldEditor';

export function DisplaySection(props: SectionProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <SchemaSection
      section="display"
      renderCustom={(key, ctx) => {
        if (OBJECT_EDITOR_KEYS.has(key)) {
          return <ObjectFieldEditor settingKey={key} {...ctx} />;
        }
        // teammateDefaultModel is controlType String (controlTypeOverride), not Object,
        // so it is not part of OBJECT_EDITOR_KEYS — keep its bespoke editor here.
        if (key === 'teammateDefaultModel') {
          const { scope, settings, overriddenScope, onSave, onDelete } = ctx;
          return (
            <TextSetting
              label={t('settings.display.teammateDefaultModel.label')}
              description={t('settings.display.teammateDefaultModel.description')}
              value={settings.teammateDefaultModel === null ? 'null' : settings.teammateDefaultModel}
              placeholder={t('settings.display.teammateDefaultModel.placeholder')}
              saveLabel={t('settings.common.save')}
              clearLabel={t('settings.common.clear')}
              settingKey="teammateDefaultModel"
              scope={scope}
              overriddenScope={overriddenScope}
              onSave={async (_key, value) => onSave('teammateDefaultModel', value === 'null' ? null : value)}
              onDelete={async () => onDelete('teammateDefaultModel')}
            />
          );
        }
        return null;
      }}
      {...props}
    />
  );
}
