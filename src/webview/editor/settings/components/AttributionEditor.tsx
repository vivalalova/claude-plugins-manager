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
  // sessionUrl default is true: undefined means checked (session URL shown)
  const createDraft = useCallback(() => ({
    commit: attribution?.commit ?? '',
    pr: attribution?.pr ?? '',
    sessionUrl: attribution?.sessionUrl ?? true,
  }), [attribution?.commit, attribution?.pr, attribution?.sessionUrl]);
  const [draft, setDraft] = useObjectEditorState(createDraft);

  const handleSave = (): void => {
    void withSave(async () => {
      const obj: { commit?: string; pr?: string; sessionUrl?: boolean } = {};
      if (draft.commit.trim()) obj.commit = draft.commit.trim();
      if (draft.pr.trim()) obj.pr = draft.pr.trim();
      // Only write sessionUrl when it's explicitly false (hiding session URL)
      if (draft.sessionUrl === false) obj.sessionUrl = false;

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
      <div className="settings-subfield">
        <label className="hooks-toggle-label" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input
            id="attribution-sessionUrl"
            type="checkbox"
            checked={draft.sessionUrl}
            onChange={(e) => setDraft((prev) => ({ ...prev, sessionUrl: e.target.checked }))}
            disabled={saving}
            aria-label={t('settings.advanced.attribution.sessionUrl.label')}
          />
          {t('settings.advanced.attribution.sessionUrl.label')}
        </label>
        <p className="settings-field-description" style={{ marginTop: 2 }}>
          {t('settings.advanced.attribution.sessionUrl.description')}
        </p>
      </div>
    </ObjectSetting>
  );
}
