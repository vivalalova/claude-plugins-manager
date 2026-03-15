import React, { useState, useEffect } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ClaudeSettings } from '../../../../shared/types';
import { SettingLabelText } from './SettingControls';
import { useToast } from '../../../components/Toast';

interface SandboxEditorProps {
  sandbox: ClaudeSettings['sandbox'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function SandboxEditor({ sandbox, onSave, onDelete }: SandboxEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [jsonText, setJsonText] = useState(sandbox ? JSON.stringify(sandbox, null, 2) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const sandboxJson = sandbox ? JSON.stringify(sandbox, null, 2) : '';
  useEffect(() => {
    setJsonText(sandboxJson);
    setError('');
  }, [sandboxJson]);

  const handleSave = async (): Promise<void> => {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setSaving(true);
      try {
        await onDelete('sandbox');
      } catch (e) {
        addToast(e instanceof Error ? e.message : String(e), 'error');
      } finally {
        setSaving(false);
      }
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      setError(t('settings.advanced.sandbox.invalidJson' as Parameters<typeof t>[0], { error: e instanceof Error ? e.message : String(e) }));
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setError(t('settings.advanced.sandbox.invalidObject'));
      return;
    }
    setSaving(true);
    try {
      await onSave('sandbox', parsed);
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setSaving(true);
    try {
      await onDelete('sandbox');
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <label className="settings-label" htmlFor="sandbox-json">
        <SettingLabelText label={t('settings.advanced.sandbox.label')} settingKey="sandbox" />
      </label>
      <p className="settings-field-description">{t('settings.advanced.sandbox.description')}</p>
      <textarea
        id="sandbox-json"
        className="input"
        rows={10}
        value={jsonText}
        onChange={(e) => { setJsonText(e.target.value); setError(''); }}
        placeholder={t('settings.advanced.sandbox.placeholder')}
        disabled={saving}
        spellCheck={false}
      />
      {error && <p className="settings-field-description" role="alert" style={{ color: 'var(--vscode-errorForeground, red)' }}>{error}</p>}
      <div className="settings-actions">
        <button
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={saving}
          type="button"
        >
          {t('settings.advanced.sandbox.save')}
        </button>
        {sandbox && (
          <button
            className="btn btn-secondary"
            onClick={() => void handleDelete()}
            disabled={saving}
            type="button"
          >
            {t('settings.advanced.sandbox.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
