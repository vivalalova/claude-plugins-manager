import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { BooleanToggle, EnumDropdown, SettingLabelText } from './components/SettingControls';
import { useToast } from '../../components/Toast';

const KNOWN_TEAMMATE_MODES = ['auto', 'inline', 'tmux', 'iterm2'] as const;

interface DisplaySectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// SpinnerVerbsEditor
// ---------------------------------------------------------------------------

interface SpinnerVerbsEditorProps {
  scope: PluginScope;
  value: ClaudeSettings['spinnerVerbs'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function SpinnerVerbsEditor({ scope, value, onSave, onDelete }: SpinnerVerbsEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [mode, setMode] = useState<'append' | 'replace'>(value?.mode ?? 'append');
  const [verbs, setVerbs] = useState<string[]>(value?.verbs ?? []);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode(value?.mode ?? 'append');
    setVerbs(value?.verbs ?? []);
    setInputValue('');
    setError('');
  }, [scope, value]);

  const save = async (newMode: 'append' | 'replace', newVerbs: string[]): Promise<void> => {
    setSaving(true);
    try {
      await onSave('spinnerVerbs', { mode: newMode, verbs: newVerbs });
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (newMode: string): void => {
    const m = newMode as 'append' | 'replace';
    setMode(m);
    void save(m, verbs);
  };

  const handleAdd = (): void => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (verbs.includes(trimmed)) {
      setError(t('settings.display.spinnerVerbs.verbs.duplicate'));
      return;
    }
    setError('');
    const newVerbs = [...verbs, trimmed];
    setVerbs(newVerbs);
    setInputValue('');
    void save(mode, newVerbs);
  };

  const handleDelete = (verb: string): void => {
    const newVerbs = verbs.filter((v) => v !== verb);
    setVerbs(newVerbs);
    void save(mode, newVerbs);
  };

  const handleClear = async (): Promise<void> => {
    setSaving(true);
    try {
      await onDelete('spinnerVerbs');
      setVerbs([]);
      setInputValue('');
      setError('');
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="settings-field">
      <label className="settings-label">
        <SettingLabelText label={t('settings.display.spinnerVerbs.label')} settingKey="spinnerVerbs" />
      </label>
      <p className="settings-field-description">{t('settings.display.spinnerVerbs.description')}</p>

      <div className="settings-model-row" style={{ marginBottom: '0.5rem' }}>
        <label className="settings-label" htmlFor="spinnerVerbs-mode" style={{ marginBottom: 0 }}>
          {t('settings.display.spinnerVerbs.mode.label')}
        </label>
        <select
          id="spinnerVerbs-mode"
          className="select"
          value={mode}
          onChange={(e) => handleModeChange(e.target.value)}
          disabled={saving}
          aria-label={t('settings.display.spinnerVerbs.mode.label')}
        >
          <option value="append">{t('settings.display.spinnerVerbs.mode.append')}</option>
          <option value="replace">{t('settings.display.spinnerVerbs.mode.replace')}</option>
        </select>
      </div>

      <div className="general-tag-list">
        {verbs.length === 0 ? (
          <span className="perm-empty">{t('settings.display.spinnerVerbs.verbs.empty')}</span>
        ) : (
          verbs.map((verb) => (
            <span key={verb} className="perm-rule-tag">
              {verb}
              <button
                className="perm-rule-tag-delete"
                onClick={() => handleDelete(verb)}
                aria-label={`Remove ${verb}`}
                type="button"
                disabled={saving}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="general-tag-add-row">
        <input
          className="input"
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder={t('settings.display.spinnerVerbs.verbs.placeholder')}
          disabled={saving}
        />
        <button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={saving || !inputValue.trim()}
          type="button"
          aria-label={t('settings.display.spinnerVerbs.verbs.add')}
        >
          {t('settings.display.spinnerVerbs.verbs.add')}
        </button>
        {error && <span className="perm-add-error" role="alert">{error}</span>}
      </div>

      {(verbs.length > 0 || value) && (
        <div className="settings-actions">
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={saving}
            type="button"
          >
            {t('settings.display.spinnerVerbs.clear')}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpinnerTipsOverrideEditor
// ---------------------------------------------------------------------------

interface SpinnerTipsOverrideEditorProps {
  scope: PluginScope;
  value: ClaudeSettings['spinnerTipsOverride'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function SpinnerTipsOverrideEditor({ scope, value, onSave, onDelete }: SpinnerTipsOverrideEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [tips, setTips] = useState<string[]>(value?.tips ?? []);
  const [excludeDefault, setExcludeDefault] = useState<boolean>(value?.excludeDefault ?? false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTips(value?.tips ?? []);
    setExcludeDefault(value?.excludeDefault ?? false);
    setInputValue('');
    setError('');
  }, [scope, value]);

  const save = async (newTips: string[], newExcludeDefault: boolean): Promise<void> => {
    setSaving(true);
    try {
      await onSave('spinnerTipsOverride', { tips: newTips, excludeDefault: newExcludeDefault });
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (): void => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (tips.includes(trimmed)) {
      setError(t('settings.display.spinnerTipsOverride.tips.duplicate'));
      return;
    }
    setError('');
    const newTips = [...tips, trimmed];
    setTips(newTips);
    setInputValue('');
    void save(newTips, excludeDefault);
  };

  const handleDelete = (tip: string): void => {
    const newTips = tips.filter((item) => item !== tip);
    setTips(newTips);
    void save(newTips, excludeDefault);
  };

  const handleExcludeDefaultToggle = (): void => {
    const newVal = !excludeDefault;
    setExcludeDefault(newVal);
    void save(tips, newVal);
  };

  const handleClear = async (): Promise<void> => {
    setSaving(true);
    try {
      await onDelete('spinnerTipsOverride');
      setTips([]);
      setExcludeDefault(false);
      setInputValue('');
      setError('');
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="settings-field">
      <label className="settings-label">
        <SettingLabelText label={t('settings.display.spinnerTipsOverride.label')} settingKey="spinnerTipsOverride" />
      </label>
      <p className="settings-field-description">{t('settings.display.spinnerTipsOverride.description')}</p>

      <div className="general-tag-list">
        {tips.length === 0 ? (
          <span className="perm-empty">{t('settings.display.spinnerTipsOverride.tips.empty')}</span>
        ) : (
          tips.map((tip) => (
            <span key={tip} className="perm-rule-tag">
              {tip}
              <button
                className="perm-rule-tag-delete"
                onClick={() => handleDelete(tip)}
                aria-label={`Remove ${tip}`}
                type="button"
                disabled={saving}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="general-tag-add-row">
        <input
          className="input"
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder={t('settings.display.spinnerTipsOverride.tips.placeholder')}
          disabled={saving}
        />
        <button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={saving || !inputValue.trim()}
          type="button"
          aria-label={t('settings.display.spinnerTipsOverride.tips.add')}
        >
          {t('settings.display.spinnerTipsOverride.tips.add')}
        </button>
        {error && <span className="perm-add-error" role="alert">{error}</span>}
      </div>

      <label className="hooks-toggle-label" style={{ marginTop: '0.5rem' }}>
        <input
          type="checkbox"
          checked={excludeDefault}
          onChange={() => handleExcludeDefaultToggle()}
          disabled={saving}
        />
        {t('settings.display.spinnerTipsOverride.excludeDefault')}
      </label>

      {(tips.length > 0 || value) && (
        <div className="settings-actions">
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={saving}
            type="button"
          >
            {t('settings.display.spinnerTipsOverride.clear')}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DisplaySection
// ---------------------------------------------------------------------------

export function DisplaySection({ scope, settings, onSave, onDelete }: DisplaySectionProps): React.ReactElement {
  const { t } = useI18n();

  // Defaults mirror Claude Code's published settings schema.
  const booleanFields: { key: keyof ClaudeSettings; label: string; description: string }[] = [
    { key: 'showTurnDuration', label: t('settings.display.showTurnDuration.label'), description: t('settings.display.showTurnDuration.description') },
    { key: 'spinnerTipsEnabled', label: t('settings.display.spinnerTipsEnabled.label'), description: t('settings.display.spinnerTipsEnabled.description') },
    { key: 'terminalProgressBarEnabled', label: t('settings.display.terminalProgressBarEnabled.label'), description: t('settings.display.terminalProgressBarEnabled.description') },
    { key: 'prefersReducedMotion', label: t('settings.display.prefersReducedMotion.label'), description: t('settings.display.prefersReducedMotion.description') },
  ];

  const teammateModeLabels: Record<string, string> = {
    auto: t('settings.display.teammateMode.auto'),
    inline: t('settings.display.teammateMode.inline'),
    tmux: t('settings.display.teammateMode.tmux'),
    iterm2: t('settings.display.teammateMode.iterm2'),
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.display')}</h3>

      <EnumDropdown
        label={t('settings.display.teammateMode.label')}
        description={t('settings.display.teammateMode.description')}
        value={settings.teammateMode}
        knownValues={KNOWN_TEAMMATE_MODES}
        knownLabels={teammateModeLabels}
        notSetLabel={t('settings.display.teammateMode.notSet')}
        unknownTemplate={t('settings.display.teammateMode.unknown')}
        settingKey="teammateMode"
        defaultValue="auto"
        onSave={onSave}
        onDelete={onDelete}
      />

      {booleanFields.map(({ key, label, description }) => (
        <BooleanToggle
          key={key}
          label={label}
          description={description}
          value={settings[key] as boolean | undefined}
          settingKey={key}
          defaultValue={key === 'prefersReducedMotion' ? false : true}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}

      <SpinnerVerbsEditor
        scope={scope}
        value={settings.spinnerVerbs}
        onSave={onSave}
        onDelete={onDelete}
      />

      <SpinnerTipsOverrideEditor
        scope={scope}
        value={settings.spinnerTipsOverride}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}
