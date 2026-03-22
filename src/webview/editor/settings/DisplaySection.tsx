import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { TagListSetting } from './components/SettingControls';
import { SchemaSection } from './components/SchemaSection';
import type { SectionProps } from './components/SchemaSection';
import { useSettingSave } from './hooks/useSettingSave';
import { DISPLAY_FIELD_ORDER } from '../../../shared/field-orders';

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
  const { saving, withSave } = useSettingSave();
  const [mode, setMode] = useState<'append' | 'replace'>(value?.mode ?? 'append');
  const [verbs, setVerbs] = useState<string[]>(value?.verbs ?? []);

  useEffect(() => {
    setMode(value?.mode ?? 'append');
    setVerbs(value?.verbs ?? []);
  }, [scope, value]);

  const save = (newMode: 'append' | 'replace', newVerbs: string[]): void => {
    void withSave(() => onSave('spinnerVerbs', { mode: newMode, verbs: newVerbs }));
  };

  const handleModeChange = (newMode: string): void => {
    const m = newMode as 'append' | 'replace';
    setMode(m);
    void save(m, verbs);
  };

  const handleClear = (): void => {
    void withSave(async () => {
      await onDelete('spinnerVerbs');
      setVerbs([]);
    });
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
  const { saving, withSave } = useSettingSave();
  const [tips, setTips] = useState<string[]>(value?.tips ?? []);
  const [excludeDefault, setExcludeDefault] = useState<boolean>(value?.excludeDefault ?? false);

  useEffect(() => {
    setTips(value?.tips ?? []);
    setExcludeDefault(value?.excludeDefault ?? false);
  }, [scope, value]);

  const save = (newTips: string[], newExcludeDefault: boolean): void => {
    void withSave(() => onSave('spinnerTipsOverride', { tips: newTips, excludeDefault: newExcludeDefault }));
  };

  const handleExcludeDefaultToggle = (): void => {
    const newVal = !excludeDefault;
    setExcludeDefault(newVal);
    void save(tips, newVal);
  };

  const handleClear = (): void => {
    void withSave(async () => {
      await onDelete('spinnerTipsOverride');
      setTips([]);
      setExcludeDefault(false);
    });
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

export function DisplaySection(props: SectionProps): React.ReactElement {
  return (
    <SchemaSection
      titleKey="settings.nav.display"
      fieldOrder={DISPLAY_FIELD_ORDER}
      renderCustom={(key, { scope, settings, onSave, onDelete }) => {
        switch (key) {
          case 'spinnerVerbs':
            return <SpinnerVerbsEditor scope={scope} value={settings.spinnerVerbs} onSave={onSave} onDelete={onDelete} />;
          case 'spinnerTipsOverride':
            return <SpinnerTipsOverrideEditor scope={scope} value={settings.spinnerTipsOverride} onSave={onSave} onDelete={onDelete} />;
          default:
            return null;
        }
      }}
      {...props}
    />
  );
}
