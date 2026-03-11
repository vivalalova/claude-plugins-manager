import React, { useMemo, useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { BooleanToggle, EnumDropdown, TextSetting } from './components/SettingControls';
import { useToast } from '../../components/Toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_FORCE_LOGIN_METHODS = ['claudeai', 'console'] as const satisfies readonly (NonNullable<ClaudeSettings['forceLoginMethod']>)[];

// ---------------------------------------------------------------------------
// AttributionEditor
// ---------------------------------------------------------------------------

interface AttributionEditorProps {
  attribution: ClaudeSettings['attribution'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function AttributionEditor({ attribution, onSave, onDelete }: AttributionEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [commit, setCommit] = useState(attribution?.commit ?? '');
  const [pr, setPr] = useState(attribution?.pr ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCommit(attribution?.commit ?? '');
    setPr(attribution?.pr ?? '');
  }, [attribution?.commit, attribution?.pr]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const obj: { commit?: string; pr?: string } = {};
      if (commit.trim()) obj.commit = commit.trim();
      if (pr.trim()) obj.pr = pr.trim();

      if (Object.keys(obj).length === 0) {
        await onDelete('attribution');
      } else {
        await onSave('attribution', obj);
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <label className="settings-label">{t('settings.advanced.attribution.label')}</label>
      <p className="settings-field-description">{t('settings.advanced.attribution.description')}</p>
      <div className="settings-model-row">
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
      <div className="settings-model-row">
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
          onClick={() => void handleSave()}
          disabled={saving}
          type="button"
        >
          {t('settings.advanced.attribution.save')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusLineEditor
// ---------------------------------------------------------------------------

interface StatusLineEditorProps {
  statusLine: ClaudeSettings['statusLine'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function StatusLineEditor({ statusLine, onSave, onDelete }: StatusLineEditorProps): React.ReactElement {
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
      <label className="settings-label">{t('settings.advanced.statusLine.label')}</label>
      <p className="settings-field-description">{t('settings.advanced.statusLine.description')}</p>
      <div className="settings-model-row">
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
      <div className="settings-model-row">
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

// ---------------------------------------------------------------------------
// FileSuggestionEditor
// ---------------------------------------------------------------------------

interface FileSuggestionEditorProps {
  fileSuggestion: ClaudeSettings['fileSuggestion'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function FileSuggestionEditor({ fileSuggestion, onSave, onDelete }: FileSuggestionEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [command, setCommand] = useState(fileSuggestion?.command ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCommand(fileSuggestion?.command ?? '');
  }, [fileSuggestion?.command]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const trimmed = command.trim();
      if (!trimmed) {
        await onDelete('fileSuggestion');
      } else {
        await onSave('fileSuggestion', { type: 'command', command: trimmed });
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setSaving(true);
    try {
      await onDelete('fileSuggestion');
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <label className="settings-label">{t('settings.advanced.fileSuggestion.label')}</label>
      <p className="settings-field-description">{t('settings.advanced.fileSuggestion.description')}</p>
      <div className="settings-model-row">
        <label className="settings-label" htmlFor="fileSuggestion-command">
          {t('settings.advanced.fileSuggestion.command.label')}
        </label>
        <input
          id="fileSuggestion-command"
          className="input"
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={t('settings.advanced.fileSuggestion.command.placeholder')}
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
          {t('settings.advanced.fileSuggestion.save')}
        </button>
        {fileSuggestion?.command && (
          <button
            className="btn btn-secondary"
            onClick={() => void handleDelete()}
            disabled={saving}
            type="button"
          >
            {t('settings.advanced.fileSuggestion.clear')}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SandboxEditor
// ---------------------------------------------------------------------------

interface SandboxEditorProps {
  sandbox: ClaudeSettings['sandbox'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function SandboxEditor({ sandbox, onSave, onDelete }: SandboxEditorProps): React.ReactElement {
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
      setError(t('settings.advanced.sandbox.invalidJson').replace('{error}', e instanceof Error ? e.message : String(e)));
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
      <label className="settings-label" htmlFor="sandbox-json">{t('settings.advanced.sandbox.label')}</label>
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

// ---------------------------------------------------------------------------
// CompanyAnnouncementsEditor
// ---------------------------------------------------------------------------

interface CompanyAnnouncementsEditorProps {
  scope: PluginScope;
  announcements: string[];
  onSave: (key: string, value: unknown) => Promise<void>;
}

function CompanyAnnouncementsEditor({ scope, announcements, onSave }: CompanyAnnouncementsEditorProps): React.ReactElement {
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
      <label className="settings-label">{t('settings.advanced.companyAnnouncements.label')}</label>
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

// ---------------------------------------------------------------------------
// AdvancedSection
// ---------------------------------------------------------------------------

interface AdvancedSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function AdvancedSection({ scope, settings, onSave, onDelete }: AdvancedSectionProps): React.ReactElement {
  const { t } = useI18n();

  const forceLoginMethodLabels = useMemo<Record<string, string>>(
    () => ({
      claudeai: t('settings.advanced.forceLoginMethod.claudeai'),
      console: t('settings.advanced.forceLoginMethod.console'),
    }),
    [t],
  );

  const textFields: { key: keyof ClaudeSettings; label: string; description: string; placeholder: string; saveLabel: string; clearLabel: string }[] = [
    {
      key: 'forceLoginOrgUUID',
      label: t('settings.advanced.forceLoginOrgUUID.label'),
      description: t('settings.advanced.forceLoginOrgUUID.description'),
      placeholder: t('settings.advanced.forceLoginOrgUUID.placeholder'),
      saveLabel: t('settings.advanced.forceLoginOrgUUID.save'),
      clearLabel: t('settings.advanced.forceLoginOrgUUID.clear'),
    },
    {
      key: 'plansDirectory',
      label: t('settings.advanced.plansDirectory.label'),
      description: t('settings.advanced.plansDirectory.description'),
      placeholder: t('settings.advanced.plansDirectory.placeholder'),
      saveLabel: t('settings.advanced.plansDirectory.save'),
      clearLabel: t('settings.advanced.plansDirectory.clear'),
    },
    {
      key: 'apiKeyHelper',
      label: t('settings.advanced.apiKeyHelper.label'),
      description: t('settings.advanced.apiKeyHelper.description'),
      placeholder: t('settings.advanced.apiKeyHelper.placeholder'),
      saveLabel: t('settings.advanced.apiKeyHelper.save'),
      clearLabel: t('settings.advanced.apiKeyHelper.clear'),
    },
    {
      key: 'otelHeadersHelper',
      label: t('settings.advanced.otelHeadersHelper.label'),
      description: t('settings.advanced.otelHeadersHelper.description'),
      placeholder: t('settings.advanced.otelHeadersHelper.placeholder'),
      saveLabel: t('settings.advanced.otelHeadersHelper.save'),
      clearLabel: t('settings.advanced.otelHeadersHelper.clear'),
    },
    {
      key: 'awsCredentialExport',
      label: t('settings.advanced.awsCredentialExport.label'),
      description: t('settings.advanced.awsCredentialExport.description'),
      placeholder: t('settings.advanced.awsCredentialExport.placeholder'),
      saveLabel: t('settings.advanced.awsCredentialExport.save'),
      clearLabel: t('settings.advanced.awsCredentialExport.clear'),
    },
    {
      key: 'awsAuthRefresh',
      label: t('settings.advanced.awsAuthRefresh.label'),
      description: t('settings.advanced.awsAuthRefresh.description'),
      placeholder: t('settings.advanced.awsAuthRefresh.placeholder'),
      saveLabel: t('settings.advanced.awsAuthRefresh.save'),
      clearLabel: t('settings.advanced.awsAuthRefresh.clear'),
    },
  ];

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.advanced')}</h3>

      <EnumDropdown
        label={t('settings.advanced.forceLoginMethod.label')}
        description={t('settings.advanced.forceLoginMethod.description')}
        value={settings.forceLoginMethod}
        knownValues={KNOWN_FORCE_LOGIN_METHODS}
        knownLabels={forceLoginMethodLabels}
        notSetLabel={t('settings.advanced.forceLoginMethod.notSet')}
        unknownTemplate={t('settings.advanced.forceLoginMethod.unknown')}
        settingKey="forceLoginMethod"
        onSave={onSave}
        onDelete={onDelete}
      />

      <AttributionEditor
        attribution={settings.attribution}
        onSave={onSave}
        onDelete={onDelete}
      />

      <StatusLineEditor
        statusLine={settings.statusLine}
        onSave={onSave}
        onDelete={onDelete}
      />

      <FileSuggestionEditor
        fileSuggestion={settings.fileSuggestion}
        onSave={onSave}
        onDelete={onDelete}
      />

      <SandboxEditor
        sandbox={settings.sandbox}
        onSave={onSave}
        onDelete={onDelete}
      />

      <CompanyAnnouncementsEditor
        scope={scope}
        announcements={settings.companyAnnouncements ?? []}
        onSave={onSave}
      />

      {textFields.map(({ key, label, description, placeholder, saveLabel, clearLabel }) => (
        <TextSetting
          key={key}
          label={label}
          description={description}
          value={settings[key] as string | undefined}
          placeholder={placeholder}
          saveLabel={saveLabel}
          clearLabel={clearLabel}
          settingKey={key}
          scope={scope}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}

      <BooleanToggle
        label={t('settings.advanced.skipWebFetchPreflight.label')}
        description={t('settings.advanced.skipWebFetchPreflight.description')}
        value={settings.skipWebFetchPreflight}
        settingKey="skipWebFetchPreflight"
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}
