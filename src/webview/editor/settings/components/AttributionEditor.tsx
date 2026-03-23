import React, { useCallback } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ClaudeSettings } from '../../../../shared/types';
import { useSettingSave } from '../hooks/useSettingSave';
import { ObjectSetting, useObjectEditorState } from './ObjectSetting';

interface AttributionEditorProps {
  attribution: ClaudeSettings['attribution'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function AttributionEditor({ attribution, onSave, onDelete }: AttributionEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();
  const createDraft = useCallback(() => ({
    commit: attribution?.commit ?? '',
    pr: attribution?.pr ?? '',
  }), [attribution?.commit, attribution?.pr]);
  const [draft, setDraft] = useObjectEditorState(createDraft);

  const handleSave = (): void => {
    void withSave(async () => {
      const obj: { commit?: string; pr?: string } = {};
      if (draft.commit.trim()) obj.commit = draft.commit.trim();
      if (draft.pr.trim()) obj.pr = draft.pr.trim();

      if (Object.keys(obj).length === 0) {
        await onDelete('attribution');
      } else {
        await onSave('attribution', obj);
      }
    });
  };

  return (
    <ObjectSetting
      label={t('settings.advanced.attribution.label')}
      description={t('settings.advanced.attribution.description')}
      settingKey="attribution"
      actions={(
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          type="button"
        >
          {t('settings.advanced.attribution.save')}
        </button>
      )}
    >
      <div className="settings-subfield">
        <label className="settings-label" htmlFor="attribution-commit">
          {t('settings.advanced.attribution.commit.label')}
        </label>
        <input
          id="attribution-commit"
          className="input"
          type="text"
          value={draft.commit}
          onChange={(e) => setDraft((prev) => ({ ...prev, commit: e.target.value }))}
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
          value={draft.pr}
          onChange={(e) => setDraft((prev) => ({ ...prev, pr: e.target.value }))}
          placeholder={t('settings.advanced.attribution.pr.placeholder')}
          disabled={saving}
        />
      </div>
    </ObjectSetting>
  );
}
