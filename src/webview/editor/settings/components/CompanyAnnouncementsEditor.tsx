import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope } from '../../../../shared/types';
import { SettingLabelText } from './SettingControls';
import { useToast } from '../../../components/Toast';

interface CompanyAnnouncementsEditorProps {
  scope: PluginScope;
  announcements: string[];
  onSave: (key: string, value: unknown) => Promise<void>;
}

export function CompanyAnnouncementsEditor({ scope, announcements, onSave }: CompanyAnnouncementsEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInputValue('');
    setError('');
  }, [scope]);

  const handleAdd = async (): Promise<void> => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (announcements.includes(trimmed)) {
      setError(t('settings.advanced.companyAnnouncements.duplicate'));
      return;
    }
    setSaving(true);
    try {
      await onSave('companyAnnouncements', [...announcements, trimmed]);
      setInputValue('');
      setError('');
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (announcement: string): Promise<void> => {
    setSaving(true);
    try {
      await onSave('companyAnnouncements', announcements.filter((a) => a !== announcement));
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <label className="settings-label">
        <SettingLabelText label={t('settings.advanced.companyAnnouncements.label')} settingKey="companyAnnouncements" />
      </label>
      <p className="settings-field-description">{t('settings.advanced.companyAnnouncements.description')}</p>
      <div className="general-tag-list">
        {announcements.length === 0 ? (
          <span className="perm-empty">{t('settings.advanced.companyAnnouncements.empty')}</span>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement} className="perm-rule-tag">
              <textarea
                className="input"
                rows={2}
                value={announcement}
                readOnly
              />
              <button
                className="perm-rule-tag-delete"
                onClick={() => void handleDelete(announcement)}
                aria-label={`Remove "${announcement}"`}
                type="button"
                disabled={saving}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div className="general-tag-add-row">
        <textarea
          className="input"
          rows={2}
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setError(''); }}
          placeholder={t('settings.advanced.companyAnnouncements.placeholder')}
          disabled={saving}
        />
        <button
          className="btn btn-primary"
          onClick={() => void handleAdd()}
          disabled={saving || !inputValue.trim()}
          type="button"
        >
          {t('settings.advanced.companyAnnouncements.add')}
        </button>
        {error && <p className="settings-field-description" role="alert" style={{ color: 'var(--vscode-errorForeground, red)' }}>{error}</p>}
      </div>
    </div>
  );
}
