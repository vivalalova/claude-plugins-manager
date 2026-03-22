import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ClaudeSettings } from '../../../../shared/types';
import { SettingLabelText } from './SettingControls';
import { useSettingSave } from '../hooks/useSettingSave';

interface AttributionEditorProps {
  attribution: ClaudeSettings['attribution'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function AttributionEditor({ attribution, onSave, onDelete }: AttributionEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();
  const [commit, setCommit] = useState(attribution?.commit ?? '');
  const [pr, setPr] = useState(attribution?.pr ?? '');

  useEffect(() => {
    setCommit(attribution?.commit ?? '');
    setPr(attribution?.pr ?? '');
  }, [attribution?.commit, attribution?.pr]);

  const handleSave = (): void => {
    void withSave(async () => {
      const obj: { commit?: string; pr?: string } = {};
      if (commit.trim()) obj.commit = commit.trim();
      if (pr.trim()) obj.pr = pr.trim();

      if (Object.keys(obj).length === 0) {
        await onDelete('attribution');
      } else {
        await onSave('attribution', obj);
      }
    });
  };

  return (
    <div className="settings-field">
      <label className="settings-label">
        <SettingLabelText label={t('settings.advanced.attribution.label')} settingKey="attribution" />
      </label>
      <p className="settings-field-description">{t('settings.advanced.attribution.description')}</p>
      <div className="settings-subfield">
        <label className="settings-label" htmlFor="attribution-commit">
          {t('settings.advanced.attribution.commit.label')}
        </label>
        <input
          id="attribution-commit"
          className="input"
          type="text"
          value={commit}
          onChange={(e) => setCommit(e.target.value)}
          placeholder={t('settings.advanced.attribution.commit.placeholder')}
          disabled={saving}
        />
      </div>
      <div className="settings-subfield">
        <label className="settings-label" htmlFor="attribution-pr">
          {t('settings.advanced.attribution.pr.label')}
        </label>
        <input
          id="attribution-pr"
          className="input"
          type="text"
          value={pr}
          onChange={(e) => setPr(e.target.value)}
          placeholder={t('settings.advanced.attribution.pr.placeholder')}
          disabled={saving}
        />
      </div>
      <div className="settings-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          type="button"
        >
          {t('settings.advanced.attribution.save')}
        </button>
      </div>
    </div>
  );
}
