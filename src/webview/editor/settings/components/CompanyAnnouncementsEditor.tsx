import React from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope } from '../../../../shared/types';
import { TagListSetting } from './SettingControls';
import { useSettingSave } from '../hooks/useSettingSave';

interface CompanyAnnouncementsEditorProps {
  scope: PluginScope;
  announcements: string[];
  onSave: (key: string, value: unknown) => Promise<void>;
}

export function CompanyAnnouncementsEditor({ scope, announcements, onSave }: CompanyAnnouncementsEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();

  return (
    <TagListSetting
      label={t('settings.advanced.companyAnnouncements.label')}
      description={t('settings.advanced.companyAnnouncements.description')}
      scope={scope}
      items={announcements}
      emptyPlaceholder={t('settings.advanced.companyAnnouncements.empty')}
      inputPlaceholder={t('settings.advanced.companyAnnouncements.placeholder')}
      addLabel={t('settings.advanced.companyAnnouncements.add')}
      duplicateError={t('settings.advanced.companyAnnouncements.duplicate')}
      settingKey="companyAnnouncements"
      disabled={saving}
      inputVariant="multi-line"
      inputRows={2}
      renderItem={(announcement, { disabled: itemDisabled, onDelete }) => (
        <div className="perm-rule-tag">
          <textarea
            className="input"
            rows={2}
            value={announcement}
            readOnly
          />
          <button
            className="perm-rule-tag-delete"
            onClick={onDelete}
            aria-label={`Remove "${announcement}"`}
            type="button"
            disabled={itemDisabled}
          >
            ×
          </button>
        </div>
      )}
      onAddItem={(announcement) => {
        void withSave(() => onSave('companyAnnouncements', [...announcements, announcement]));
      }}
      onDeleteItem={(announcement) => {
        void withSave(() => onSave('companyAnnouncements', announcements.filter((item) => item !== announcement)));
      }}
    />
  );
}
