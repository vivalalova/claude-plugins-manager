import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { SchemaSection } from './components/SchemaSection';
import type { SectionProps } from './components/SchemaSection';

export function GeneralSection(props: SectionProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <SchemaSection
      titleKey="settings.nav.general"
      section="general"
      headerContent={
        <p className="settings-field-description">
          {t('settings.general.docsHint')}
          <a href="https://code.claude.com/docs/en/settings" target="_blank" rel="noreferrer" className="settings-docs-link">
            {t('settings.general.docsLinkText')}
          </a>
        </p>
      }
      {...props}
    />
  );
}
