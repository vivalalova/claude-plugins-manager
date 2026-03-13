import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ClaudeSettings } from '../../../../shared/types';
import { SettingLabelText } from './SettingControls';
import { useToast } from '../../../components/Toast';

interface StatusLineEditorProps {
  statusLine: ClaudeSettings['statusLine'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function StatusLineEditor({ statusLine, onSave, onDelete }: StatusLineEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [command, setCommand] = useState(statusLine?.command ?? '');
  const [paddingStr, setPaddingStr] = useState(statusLine?.padding !== undefined ? String(statusLine.padding) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCommand(statusLine?.command ?? '');
    setPaddingStr(statusLine?.padding !== undefined ? String(statusLine.padding) : '');
  }, [statusLine?.command, statusLine?.padding]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const trimmedCommand = command.trim();
      if (!trimmedCommand) {
        await onDelete('statusLine');
        return;
      }
      const obj: { type: 'command'; command: string; padding?: number } = { type: 'command', command: trimmedCommand };
      const trimmedPadding = paddingStr.trim();
      if (trimmedPadding !== '' && /^\d+$/.test(trimmedPadding)) {
        obj.padding = parseInt(trimmedPadding, 10);
      }
      await onSave('statusLine', obj);
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setSaving(true);
    try {
      await onDelete('statusLine');
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <label className="settings-label">
        <SettingLabelText label={t('settings.advanced.statusLine.label')} settingKey="statusLine" />
      </label>
      <p className="settings-field-description">{t('settings.advanced.statusLine.description')}</p>
      <div className="settings-subfield">
        <label className="settings-label" htmlFor="statusLine-command">
          {t('settings.advanced.statusLine.command.label')}
        </label>
        <input
          id="statusLine-command"
          className="input"
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
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
          value={paddingStr}
          onChange={(e) => setPaddingStr(e.target.value)}
          placeholder={t('settings.advanced.statusLine.padding.placeholder')}
          min="0"
          step="1"
          disabled={saving}
        />
      </div>
      <div className="settings-actions">
        <button
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={saving}
          type="button"
        >
          {t('settings.advanced.statusLine.save')}
        </button>
        {statusLine && (
          <button
            className="btn btn-secondary"
            onClick={() => void handleDelete()}
            disabled={saving}
            type="button"
          >
            {t('settings.advanced.statusLine.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
