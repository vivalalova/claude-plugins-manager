import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { TagListSetting } from './components/SettingControls';
import { SchemaSection } from './components/SchemaSection';
import type { SectionProps } from './components/SchemaSection';
import { useSettingSave } from './hooks/useSettingSave';
import { DISPLAY_FIELD_ORDER } from '../../../shared/field-orders';

interface SpinnerTagListEditorState<TExtra> {
  items: string[];
  extra: TExtra;
}

interface SpinnerTagListEditorProps<TValue, TExtra> {
  scope: PluginScope;
  value: TValue | undefined;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  settingKey: string;
  label: string;
  description: string;
  emptyPlaceholder: string;
  inputPlaceholder: string;
  addLabel: string;
  duplicateError: string;
  clearLabel: string;
  buildState: (value: TValue | undefined) => SpinnerTagListEditorState<TExtra>;
  buildValue: (state: SpinnerTagListEditorState<TExtra>) => TValue;
  renderBeforeList?: (
    context: {
      saving: boolean;
      state: SpinnerTagListEditorState<TExtra>;
      updateState: (updater: (current: SpinnerTagListEditorState<TExtra>) => SpinnerTagListEditorState<TExtra>) => void;
    },
  ) => React.ReactNode;
  renderAfterInput?: (
    context: {
      saving: boolean;
      state: SpinnerTagListEditorState<TExtra>;
      updateState: (updater: (current: SpinnerTagListEditorState<TExtra>) => SpinnerTagListEditorState<TExtra>) => void;
    },
  ) => React.ReactNode;
}

function SpinnerTagListEditor<TValue, TExtra>({
  scope,
  value,
  onSave,
  onDelete,
  settingKey,
  label,
  description,
  emptyPlaceholder,
  inputPlaceholder,
  addLabel,
  duplicateError,
  clearLabel,
  buildState,
  buildValue,
  renderBeforeList,
  renderAfterInput,
}: SpinnerTagListEditorProps<TValue, TExtra>): React.ReactElement {
  const { saving, withSave } = useSettingSave();
  const [state, setState] = useState<SpinnerTagListEditorState<TExtra>>(() => buildState(value));

  useEffect(() => {
    setState(buildState(value));
  }, [buildState, scope, value]);

  const persistState = useCallback((nextState: SpinnerTagListEditorState<TExtra>): void => {
    void withSave(() => onSave(settingKey, buildValue(nextState)));
  }, [buildValue, onSave, settingKey, withSave]);

  const updateState = useCallback((
    updater: (current: SpinnerTagListEditorState<TExtra>) => SpinnerTagListEditorState<TExtra>,
  ): void => {
    setState((current) => {
      const nextState = updater(current);
      persistState(nextState);
      return nextState;
    });
  }, [persistState]);

  const handleClear = useCallback((): void => {
    void withSave(async () => {
      await onDelete(settingKey);
      setState(buildState(undefined));
    });
  }, [buildState, onDelete, settingKey, withSave]);

  return (
    <TagListSetting
      label={label}
      description={description}
      scope={scope}
      resetTrigger={value}
      items={state.items}
      emptyPlaceholder={emptyPlaceholder}
      inputPlaceholder={inputPlaceholder}
      addLabel={addLabel}
      duplicateError={duplicateError}
      clearLabel={clearLabel}
      settingKey={settingKey}
      disabled={saving}
      showClear={state.items.length > 0 || value !== undefined}
      beforeList={renderBeforeList?.({ saving, state, updateState })}
      afterInput={renderAfterInput?.({ saving, state, updateState })}
      onAddItem={(item) => {
        updateState((current) => ({
          ...current,
          items: [...current.items, item],
        }));
      }}
      onDeleteItem={(item) => {
        updateState((current) => ({
          ...current,
          items: current.items.filter((currentItem) => currentItem !== item),
        }));
      }}
      onClear={handleClear}
    />
  );
}

interface SpinnerVerbsEditorProps {
  scope: PluginScope;
  value: ClaudeSettings['spinnerVerbs'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function SpinnerVerbsEditor({ scope, value, onSave, onDelete }: SpinnerVerbsEditorProps): React.ReactElement {
  const { t } = useI18n();
  const buildState = useCallback((nextValue: ClaudeSettings['spinnerVerbs'] | undefined) => ({
    items: nextValue?.verbs ?? [],
    extra: { mode: (nextValue?.mode ?? 'append') as 'append' | 'replace' },
  }), []);
  const buildValue = useCallback((state: SpinnerTagListEditorState<{ mode: 'append' | 'replace' }>) => ({
    mode: state.extra.mode,
    verbs: state.items,
  }), []);

  return (
    <SpinnerTagListEditor
      scope={scope}
      value={value}
      onSave={onSave}
      onDelete={onDelete}
      settingKey="spinnerVerbs"
      label={t('settings.display.spinnerVerbs.label')}
      description={t('settings.display.spinnerVerbs.description')}
      emptyPlaceholder={t('settings.display.spinnerVerbs.verbs.empty')}
      inputPlaceholder={t('settings.display.spinnerVerbs.verbs.placeholder')}
      addLabel={t('settings.display.spinnerVerbs.verbs.add')}
      duplicateError={t('settings.display.spinnerVerbs.verbs.duplicate')}
      clearLabel={t('settings.display.spinnerVerbs.clear')}
      buildState={buildState}
      buildValue={buildValue}
      renderBeforeList={({ saving, state, updateState }) => (
        <div className="settings-model-row" style={{ marginBottom: '0.5rem' }}>
          <label className="settings-label" htmlFor="spinnerVerbs-mode" style={{ marginBottom: 0 }}>
            {t('settings.display.spinnerVerbs.mode.label')}
          </label>
          <select
            id="spinnerVerbs-mode"
            className="select"
            value={state.extra.mode}
            onChange={(e) => {
              const mode = e.target.value as 'append' | 'replace';
              updateState((current) => ({
                ...current,
                extra: { mode },
              }));
            }}
            disabled={saving}
            aria-label={t('settings.display.spinnerVerbs.mode.label')}
          >
            <option value="append">{t('settings.display.spinnerVerbs.mode.append')}</option>
            <option value="replace">{t('settings.display.spinnerVerbs.mode.replace')}</option>
          </select>
        </div>
      )}
    />
  );
}

interface SpinnerTipsOverrideEditorProps {
  scope: PluginScope;
  value: ClaudeSettings['spinnerTipsOverride'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function SpinnerTipsOverrideEditor({ scope, value, onSave, onDelete }: SpinnerTipsOverrideEditorProps): React.ReactElement {
  const { t } = useI18n();
  const buildState = useCallback((nextValue: ClaudeSettings['spinnerTipsOverride'] | undefined) => ({
    items: nextValue?.tips ?? [],
    extra: { excludeDefault: nextValue?.excludeDefault ?? false },
  }), []);
  const buildValue = useCallback((state: SpinnerTagListEditorState<{ excludeDefault: boolean }>) => ({
    tips: state.items,
    excludeDefault: state.extra.excludeDefault,
  }), []);

  return (
    <SpinnerTagListEditor
      scope={scope}
      value={value}
      onSave={onSave}
      onDelete={onDelete}
      settingKey="spinnerTipsOverride"
      label={t('settings.display.spinnerTipsOverride.label')}
      description={t('settings.display.spinnerTipsOverride.description')}
      emptyPlaceholder={t('settings.display.spinnerTipsOverride.tips.empty')}
      inputPlaceholder={t('settings.display.spinnerTipsOverride.tips.placeholder')}
      addLabel={t('settings.display.spinnerTipsOverride.tips.add')}
      duplicateError={t('settings.display.spinnerTipsOverride.tips.duplicate')}
      clearLabel={t('settings.display.spinnerTipsOverride.clear')}
      buildState={buildState}
      buildValue={buildValue}
      renderAfterInput={({ saving, state, updateState }) => (
        <label className="hooks-toggle-label" style={{ marginTop: '0.5rem' }}>
          <input
            type="checkbox"
            checked={state.extra.excludeDefault}
            onChange={() => {
              updateState((current) => ({
                ...current,
                extra: { excludeDefault: !current.extra.excludeDefault },
              }));
            }}
            disabled={saving}
          />
          {t('settings.display.spinnerTipsOverride.excludeDefault')}
        </label>
      )}
    />
  );
}

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
