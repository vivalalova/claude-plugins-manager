import React, { useCallback } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ClaudeSettings } from '../../../../shared/types';
import { SPELLCHECK_CHECKER_OPTIONS } from '../../../../shared/claude-settings-schema';
import { useSettingSave } from '../hooks/useSettingSave';
import { ObjectSetting, useObjectEditorState } from './ObjectSetting';

type SpellcheckValue = NonNullable<ClaudeSettings['spellcheck']>;
type SpellcheckChecker = NonNullable<SpellcheckValue['checker']>;

interface SpellcheckEditorProps {
  spellcheck: ClaudeSettings['spellcheck'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function SpellcheckEditor({ spellcheck, onSave, onDelete }: SpellcheckEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();
  const tk = useCallback(
    (suffix: string) => t(`settings.display.spellcheck.${suffix}` as Parameters<typeof t>[0]),
    [t],
  );

  const createDraft = useCallback(() => ({
    enabled: spellcheck?.enabled ?? false,
    checker: (spellcheck?.checker ?? '') as SpellcheckChecker | '',
    language: spellcheck?.language ?? '',
    color: spellcheck?.color ?? '',
  }), [spellcheck?.enabled, spellcheck?.checker, spellcheck?.language, spellcheck?.color]);
  const [draft, setDraft] = useObjectEditorState(createDraft);

  const handleSave = (): void => {
    void withSave(async () => {
      const obj: SpellcheckValue = {};
      if (draft.enabled) obj.enabled = true;
      if (draft.checker) obj.checker = draft.checker;
      if (draft.language.trim()) obj.language = draft.language.trim();
      if (draft.color.trim()) obj.color = draft.color.trim();

      if (Object.keys(obj).length === 0) {
        await onDelete('spellcheck');
      } else {
        await onSave('spellcheck', obj);
      }
    });
  };

  const handleClear = (): void => {
    void withSave(() => onDelete('spellcheck'));
  };

  return (
    <ObjectSetting
      label={tk('label')}
      description={tk('description')}
      settingKey="spellcheck"
      actions={(
        <>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} type="button">
            {t('settings.common.save')}
          </button>
          {spellcheck && (
            <button className="btn btn-secondary" onClick={handleClear} disabled={saving} type="button">
              {t('settings.common.clear')}
            </button>
          )}
        </>
      )}
    >
      <div className="settings-subfield">
        <label className="hooks-toggle-label" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input
            id="spellcheck-enabled"
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
            disabled={saving}
            aria-label={tk('enabled.label')}
          />
          {tk('enabled.label')}
        </label>
      </div>
      <div className="settings-subfield">
        <label className="settings-label" htmlFor="spellcheck-checker">
          {tk('checker.label')}
        </label>
        <select
          id="spellcheck-checker"
          className="select"
          value={draft.checker}
          onChange={(e) => setDraft((prev) => ({ ...prev, checker: e.target.value as SpellcheckChecker | '' }))}
          disabled={saving}
        >
          <option value="">{tk('checker.auto')}</option>
          {SPELLCHECK_CHECKER_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{tk(`checker.${opt}`)}</option>
          ))}
        </select>
      </div>
      <div className="settings-subfield">
        <label className="settings-label" htmlFor="spellcheck-language">
          {tk('language.label')}
        </label>
        <input
          id="spellcheck-language"
          className="input"
          type="text"
          value={draft.language}
          onChange={(e) => setDraft((prev) => ({ ...prev, language: e.target.value }))}
          placeholder={tk('language.placeholder')}
          disabled={saving}
        />
      </div>
      <div className="settings-subfield">
        <label className="settings-label" htmlFor="spellcheck-color">
          {tk('color.label')}
        </label>
        <input
          id="spellcheck-color"
          className="input"
          type="text"
          value={draft.color}
          onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
          placeholder={tk('color.placeholder')}
          disabled={saving}
        />
      </div>
    </ObjectSetting>
  );
}
