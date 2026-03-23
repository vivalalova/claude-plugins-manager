import React, { useCallback } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ClaudeSettings } from '../../../../shared/types';
import { useSettingSave } from '../hooks/useSettingSave';
import { ObjectSetting, useObjectEditorState } from './ObjectSetting';

interface StatusLineEditorProps {
  statusLine: ClaudeSettings['statusLine'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function StatusLineEditor({ statusLine, onSave, onDelete }: StatusLineEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();
  const createDraft = useCallback(() => ({
    command: statusLine?.command ?? '',
    paddingStr: statusLine?.padding !== undefined ? String(statusLine.padding) : '',
  }), [statusLine?.command, statusLine?.padding]);
  const [draft, setDraft] = useObjectEditorState(createDraft);

  const handleSave = (): void => {
    void withSave(async () => {
      const trimmedCommand = draft.command.trim();
      if (!trimmedCommand) {
        await onDelete('statusLine');
        return;
      }
      const obj: { type: 'command'; command: string; padding?: number } = { type: 'command', command: trimmedCommand };
      const trimmedPadding = draft.paddingStr.trim();
      if (trimmedPadding !== '' && /^\d+$/.test(trimmedPadding)) {
        obj.padding = parseInt(trimmedPadding, 10);
      }
      await onSave('statusLine', obj);
    });
  };

  const handleDelete = (): void => {
    void withSave(() => onDelete('statusLine'));
  };

  return (
    <ObjectSetting
      label={t('settings.advanced.statusLine.label')}
      description={t('settings.advanced.statusLine.description')}
      settingKey="statusLine"
      actions={(
        <>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            type="button"
          >
            {t('settings.advanced.statusLine.save')}
          </button>
          {statusLine && (
            <button
              className="btn btn-secondary"
              onClick={handleDelete}
              disabled={saving}
              type="button"
            >
              {t('settings.advanced.statusLine.clear')}
            </button>
          )}
        </>
      )}
    >
      <div className="settings-subfield">
        <label className="settings-label" htmlFor="statusLine-command">
          {t('settings.advanced.statusLine.command.label')}
        </label>
        <input
          id="statusLine-command"
          className="input"
          type="text"
          value={draft.command}
          onChange={(e) => setDraft((prev) => ({ ...prev, command: e.target.value }))}
          placeholder={t('settings.advanced.statusLine.command.placeholder')}
          disabled={saving}
        />
      </div>
      <div className="settings-subfield">
        <label className="settings-label" htmlFor="statusLine-padding">
          {t('settings.advanced.statusLine.padding.label')}
        </label>
        <input
          id="statusLine-padding"
          className="input"
          type="number"
          value={draft.paddingStr}
          onChange={(e) => setDraft((prev) => ({ ...prev, paddingStr: e.target.value }))}
          placeholder={t('settings.advanced.statusLine.padding.placeholder')}
          min="0"
          step="1"
          disabled={saving}
        />
      </div>
    </ObjectSetting>
  );
}
