import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { TagListSetting } from './components/SettingControls';
import { CLAUDE_SETTINGS_SCHEMA } from '../../../shared/claude-settings-schema';
import { SchemaFieldRenderer } from './components/SchemaFieldRenderer';
import { getOverriddenScope } from './components/SettingControls';
import { useToast } from '../../components/Toast';
import { DISPLAY_FIELD_ORDER } from '../../../shared/field-orders';

interface DisplaySectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  userSettings?: ClaudeSettings;
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode(value?.mode ?? 'append');
    setVerbs(value?.verbs ?? []);
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

  const handleClear = async (): Promise<void> => {
    setSaving(true);
    try {
      await onDelete('spinnerVerbs');
      setVerbs([]);
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TagListSetting
      label={t('settings.display.spinnerVerbs.label')}
      description={t('settings.display.spinnerVerbs.description')}
      scope={scope}
      resetTrigger={value}
      items={verbs}
      emptyPlaceholder={t('settings.display.spinnerVerbs.verbs.empty')}
      inputPlaceholder={t('settings.display.spinnerVerbs.verbs.placeholder')}
      addLabel={t('settings.display.spinnerVerbs.verbs.add')}
      duplicateError={t('settings.display.spinnerVerbs.verbs.duplicate')}
      clearLabel={t('settings.display.spinnerVerbs.clear')}
      settingKey="spinnerVerbs"
      disabled={saving}
      showClear={verbs.length > 0 || value !== undefined}
      beforeList={(
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
      )}
      onAddItem={(verb) => {
        const newVerbs = [...verbs, verb];
        setVerbs(newVerbs);
        void save(mode, newVerbs);
      }}
      onDeleteItem={(verb) => {
        const newVerbs = verbs.filter((v) => v !== verb);
        setVerbs(newVerbs);
        void save(mode, newVerbs);
      }}
      onClear={() => void handleClear()}
    />
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTips(value?.tips ?? []);
    setExcludeDefault(value?.excludeDefault ?? false);
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
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TagListSetting
      label={t('settings.display.spinnerTipsOverride.label')}
      description={t('settings.display.spinnerTipsOverride.description')}
      scope={scope}
      resetTrigger={value}
      items={tips}
      emptyPlaceholder={t('settings.display.spinnerTipsOverride.tips.empty')}
      inputPlaceholder={t('settings.display.spinnerTipsOverride.tips.placeholder')}
      addLabel={t('settings.display.spinnerTipsOverride.tips.add')}
      duplicateError={t('settings.display.spinnerTipsOverride.tips.duplicate')}
      clearLabel={t('settings.display.spinnerTipsOverride.clear')}
      settingKey="spinnerTipsOverride"
      disabled={saving}
      showClear={tips.length > 0 || value !== undefined}
      afterInput={(
        <label className="hooks-toggle-label" style={{ marginTop: '0.5rem' }}>
          <input
            type="checkbox"
            checked={excludeDefault}
            onChange={() => handleExcludeDefaultToggle()}
            disabled={saving}
          />
          {t('settings.display.spinnerTipsOverride.excludeDefault')}
        </label>
      )}
      onAddItem={(tip) => {
        const newTips = [...tips, tip];
        setTips(newTips);
        void save(newTips, excludeDefault);
      }}
      onDeleteItem={(tip) => {
        const newTips = tips.filter((item) => item !== tip);
        setTips(newTips);
        void save(newTips, excludeDefault);
      }}
      onClear={() => void handleClear()}
    />
  );
}

// ---------------------------------------------------------------------------
// DisplaySection
// ---------------------------------------------------------------------------

export function DisplaySection({ scope, settings, userSettings, onSave, onDelete }: DisplaySectionProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.display')}</h3>

      {DISPLAY_FIELD_ORDER.map((key) => {
        const schema = CLAUDE_SETTINGS_SCHEMA[key];
        if (!schema) return null;
        const overriddenScope = getOverriddenScope(scope, userSettings as Record<string, unknown>, key);

        if (schema.controlType === Object) {
          switch (key) {
            case 'spinnerVerbs':
              return (
                <SpinnerVerbsEditor
                  key={key}
                  scope={scope}
                  value={settings.spinnerVerbs}
                  onSave={onSave}
                  onDelete={onDelete}
                />
              );
            case 'spinnerTipsOverride':
              return (
                <SpinnerTipsOverrideEditor
                  key={key}
                  scope={scope}
                  value={settings.spinnerTipsOverride}
                  onSave={onSave}
                  onDelete={onDelete}
                />
              );
            default:
              return null;
          }
        }

        return (
          <SchemaFieldRenderer
            key={key}
            settingKey={key}
            schema={schema}
            value={(settings as Record<string, unknown>)[key]}
            scope={scope}
            overriddenScope={overriddenScope}
            onSave={onSave}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}
