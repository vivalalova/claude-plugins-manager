import React, { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useSettingSave } from './hooks/useSettingSave';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { getKnownEnvVar, getKnownEnvVarNames, getKnownEnvVarsByValueType } from '../../../shared/known-env-vars';
import type { KnownEnvVar, EnvVarValueType } from '../../../shared/known-env-vars';
import { BooleanToggle, TextSetting, NumberSetting } from './components/SettingControls';
import { SettingsSectionWrapper } from './components/SettingsSectionWrapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENSITIVE_KEY_RE = /_SECRET$|_TOKEN$|_KEY$|_PASSWORD$|_CREDENTIAL$|^SECRET$|^TOKEN$|^PASSWORD$/i;
type EnvEntryValidationResult = 'ok' | 'empty' | 'invalid' | 'duplicate';

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

const VALID_KEY_RE = /^[A-Z0-9_]+$/;

function normalizeEnvEntryDraft(key: string, value: string): { key: string; value: string } {
  return {
    key: key.trim(),
    value: value.trim(),
  };
}

function validateEnvEntryKey(key: string, existingKeys: string[]): EnvEntryValidationResult {
  if (!key) {
    return 'empty';
  }
  if (!VALID_KEY_RE.test(key)) {
    return 'invalid';
  }
  if (existingKeys.includes(key)) {
    return 'duplicate';
  }
  return 'ok';
}

function getEnvEntryErrorMessage(
  validation: EnvEntryValidationResult,
  t: ReturnType<typeof useI18n>['t'],
): string {
  if (validation === 'invalid') {
    return t('settings.env.invalidKey');
  }
  if (validation === 'duplicate') {
    return t('settings.env.duplicateKey');
  }
  return '';
}

function useEnvVarDescription(envKey: string): string | null {
  const { t } = useI18n();
  const known = getKnownEnvVar(envKey);
  if (!known) return null;
  const i18nKey = `settings.env.knownVars.${envKey}.description` as Parameters<typeof t>[0];
  const localized = t(i18nKey);
  return localized !== i18nKey ? localized : null;
}

function useEnvFieldDraft<T>(
  createDraft: () => T,
  resetKey: string,
): {
  draft: T;
  setDraft: Dispatch<SetStateAction<T>>;
  saving: boolean;
  runWithSaving: (action: () => Promise<void>) => Promise<void>;
} {
  const [draft, setDraft] = useState<T>(() => createDraft());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(createDraft());
  }, [createDraft, resetKey]);

  const runWithSaving = useCallback(async (action: () => Promise<void>): Promise<void> => {
    setSaving(true);
    try {
      await action();
    } finally {
      setSaving(false);
    }
  }, []);

  return { draft, setDraft, saving, runWithSaving };
}

// ---------------------------------------------------------------------------
// EnvSensitiveField (password + reveal — TextSetting doesn't support this)
// ---------------------------------------------------------------------------

interface EnvSensitiveFieldProps {
  envKey: string;
  knownVar?: KnownEnvVar;
  value: string | undefined;
  scope: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  disabled: boolean;
}

function EnvSensitiveField({ envKey, knownVar, value, scope, onSave, onDelete, disabled }: EnvSensitiveFieldProps): React.ReactElement {
  const { t } = useI18n();
  const description = useEnvVarDescription(envKey);
  const saveLabel = t('settings.common.save');
  const clearLabel = t('settings.common.clear');
  const defaultVal = knownVar?.default;
  const createDraft = useCallback(() => ({
    inputValue: '',
    isRevealed: false,
  }), []);
  const resetKey = `${scope}:${value ?? ''}`;
  const { draft, setDraft, saving, runWithSaving } = useEnvFieldDraft(createDraft, resetKey);

  const handleSave = async (): Promise<void> => {
    const trimmed = draft.inputValue.trim();
    await runWithSaving(async () => {
      if (!trimmed) {
        await onDelete(envKey);
      } else {
        await onSave(envKey, trimmed);
      }
    });
  };

  const handleClear = async (): Promise<void> => {
    await runWithSaving(async () => {
      await onDelete(envKey);
      setDraft((current) => ({ ...current, inputValue: '' }));
    });
  };

  const inputType = !draft.isRevealed ? 'password' : 'text';

  return (
    <div className="settings-field">
      <label className="settings-label" htmlFor={`env-${envKey}`}>
        <span>{envKey}</span>
        {defaultVal && (
          <span className="settings-key-hint" aria-hidden="true">
            ({envKey}: {defaultVal})
          </span>
        )}
      </label>
      {description && <p className="settings-field-description">{description}</p>}
      <div className="settings-model-row">
        <div className="env-sensitive-row">
          <input
            id={`env-${envKey}`}
            className="input"
            type={inputType}
            value={draft.inputValue}
            onChange={(e) => setDraft((current) => ({ ...current, inputValue: e.target.value }))}
            placeholder={value ? '••••••••' : t('settings.env.valuePlaceholder')}
            disabled={disabled || saving}
          />
          <button
            className="btn btn-secondary"
            onClick={() => setDraft((current) => ({ ...current, isRevealed: !current.isRevealed }))}
            type="button"
            disabled={disabled || saving}
          >
            {draft.isRevealed ? '🙈' : '👁'}
          </button>
        </div>
        {value !== undefined ? (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={disabled || saving}
            type="button"
          >
            {clearLabel}
          </button>
        ) : null}
        <button
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={disabled || saving}
          type="button"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnvCustomField (single-row: [key] [value] [clear] [save])
// ---------------------------------------------------------------------------

interface EnvCustomFieldProps {
  envKey: string;
  value: string | undefined;
  existingKeys: string[];
  scope: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  disabled: boolean;
}

function EnvCustomField({
  envKey,
  value,
  existingKeys,
  scope,
  onSave,
  onDelete,
  disabled,
}: EnvCustomFieldProps): React.ReactElement {
  const { t } = useI18n();
  const createDraft = useCallback(() => ({
    keyInput: envKey,
    inputValue: value ?? '',
  }), [envKey, value]);
  const resetKey = `${scope}:${envKey}:${value ?? ''}`;
  const { draft, setDraft, saving, runWithSaving } = useEnvFieldDraft(createDraft, resetKey);
  const [error, setError] = useState('');

  const handleSave = async (): Promise<void> => {
    const normalizedDraft = normalizeEnvEntryDraft(draft.keyInput, draft.inputValue);
    if (!normalizedDraft.value) {
      setError('');
      await runWithSaving(async () => {
        await onDelete(envKey);
      });
      return;
    }
    if (!normalizedDraft.key) {
      setError(t('settings.env.invalidKey'));
      return;
    }

    const validation = validateEnvEntryKey(
      normalizedDraft.key,
      existingKeys.filter((key) => key !== envKey),
    );
    const validationError = getEnvEntryErrorMessage(validation, t);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    await runWithSaving(async () => {
      if (normalizedDraft.key !== envKey) {
        await onDelete(envKey);
        await onSave(normalizedDraft.key, normalizedDraft.value);
      } else {
        await onSave(envKey, normalizedDraft.value);
      }
    });
  };

  const handleClear = async (): Promise<void> => {
    setError('');
    await runWithSaving(async () => {
      await onDelete(envKey);
      setDraft((current) => ({ ...current, inputValue: '' }));
    });
  };

  return (
    <div>
      <div className="env-custom-row">
        <input
          className="input env-custom-key"
          type="text"
          value={draft.keyInput}
          onChange={(e) => {
            setDraft((current) => ({ ...current, keyInput: e.target.value }));
            setError('');
          }}
          disabled={disabled || saving}
        />
        <input
          className="input"
          type="text"
          value={draft.inputValue}
          onChange={(e) => {
            setDraft((current) => ({ ...current, inputValue: e.target.value }));
            setError('');
          }}
          disabled={disabled || saving}
        />
        {value !== undefined && (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={disabled || saving}
            type="button"
          >
            {t('settings.common.clear')}
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={disabled || saving}
          type="button"
        >
          {t('settings.common.save')}
        </button>
      </div>
      {error && <span className="env-add-error">{error}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnvCategoryGroup
// ---------------------------------------------------------------------------

function EnvCategoryGroup({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="env-category-group">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddEnvForm
// ---------------------------------------------------------------------------

interface AddEnvFormProps {
  existingKeys: string[];
  onAdd: (key: string, value: string) => Promise<void>;
  disabled: boolean;
}

function AddEnvForm({ existingKeys, onAdd, disabled }: AddEnvFormProps): React.ReactElement {
  const { t } = useI18n();
  const [keyInput, setKeyInput] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const validate = (key: string): string => {
    const normalizedDraft = normalizeEnvEntryDraft(key, valueInput);
    if (!normalizedDraft.key || !normalizedDraft.value) {
      return '';
    }
    return getEnvEntryErrorMessage(
      validateEnvEntryKey(normalizedDraft.key, existingKeys),
      t,
    );
  };

  const handleAdd = async (): Promise<void> => {
    const err = validate(keyInput);
    if (err) { setError(err); return; }
    const normalizedDraft = normalizeEnvEntryDraft(keyInput, valueInput);
    if (!normalizedDraft.key || !normalizedDraft.value) return;
    setAdding(true);
    try {
      await onAdd(normalizedDraft.key, normalizedDraft.value);
      setKeyInput('');
      setValueInput('');
      setError('');
    } finally {
      setAdding(false);
    }
  };

  const isAddDisabled = disabled || adding || !keyInput.trim() || !valueInput.trim();

  return (
    <div className="env-add-form">
      <input
        className="input"
        type="text"
        value={keyInput}
        onChange={(e) => { setKeyInput(e.target.value); setError(''); }}
        placeholder={t('settings.env.keyPlaceholder')}
        disabled={disabled || adding}
      />
      <input
        className="input"
        type="text"
        value={valueInput}
        onChange={(e) => { setValueInput(e.target.value); setError(''); }}
        placeholder={t('settings.env.valuePlaceholder')}
        disabled={disabled || adding}
        onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
      />
      <button
        className="btn btn-primary"
        onClick={() => void handleAdd()}
        disabled={isAddDisabled}
        type="button"
      >
        {t('settings.env.add')}
      </button>
      {error && <span className="env-add-error">{error}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnvSection
// ---------------------------------------------------------------------------

interface EnvSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
}

export function EnvSection({ scope, settings, onSave }: EnvSectionProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();

  const currentEnv = useMemo<Record<string, string>>(
    () => (settings.env as Record<string, string>) ?? {},
    [settings.env],
  );

  const knownVarsByType = useMemo(() => getKnownEnvVarsByValueType(), []);
  const knownNames = useMemo(() => new Set(getKnownEnvVarNames()), []);

  const customEntries = useMemo(
    () => Object.entries(currentEnv).filter(([key]) => !knownNames.has(key)),
    [currentEnv, knownNames],
  );

  const updateEnv = (updatedEnv: Record<string, string>): void => {
    void withSave(() => onSave('env', updatedEnv));
  };

  // Adapter: bridge per-key save/delete to whole-env-object update
  const envOnSave = async (key: string, value: unknown): Promise<void> => {
    const strVal = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    updateEnv({ ...currentEnv, [key]: strVal });
  };

  const envOnDelete = async (key: string): Promise<void> => {
    const { [key]: _, ...rest } = currentEnv;
    updateEnv(rest);
  };

  const handleAdd = async (key: string, value: string): Promise<void> => {
    updateEnv({ ...currentEnv, [key]: value });
  };

  // --- Render helpers per valueType ---

  const renderBoolean = (knownVar: KnownEnvVar): React.ReactElement => {
    const envVal = currentEnv[knownVar.name];
    const boolVal = envVal !== undefined ? (envVal === '1' || envVal === 'true') : undefined;
    const defaultBool = knownVar.default !== undefined
      ? (knownVar.default === '1' || knownVar.default === 'true')
      : undefined;
    const desc = getDescription(knownVar.name);
    return (
      <BooleanToggle
        key={knownVar.name}
        label={knownVar.name}
        description={desc ?? undefined}
        value={boolVal}
        settingKey={knownVar.name}
        defaultValue={defaultBool}
        onSave={envOnSave}
        onDelete={envOnDelete}
      />
    );
  };

  const renderNumber = (knownVar: KnownEnvVar): React.ReactElement => {
    const envVal = currentEnv[knownVar.name];
    const numVal = envVal !== undefined ? Number(envVal) : undefined;
    const defaultNum = knownVar.default !== undefined ? Number(knownVar.default) : undefined;
    const desc = getDescription(knownVar.name);
    return (
      <NumberSetting
        key={knownVar.name}
        label={knownVar.name}
        description={desc ?? undefined}
        value={numVal}
        placeholder={t('settings.env.valuePlaceholder')}
        saveLabel={t('settings.common.save')}
        clearLabel={t('settings.common.clear')}
        settingKey={knownVar.name}
        scope={scope}
        defaultValue={defaultNum}
        onSave={envOnSave}
        onDelete={envOnDelete}
      />
    );
  };

  const renderString = (knownVar: KnownEnvVar): React.ReactElement => {
    const sensitive = knownVar.sensitive ?? isSensitiveKey(knownVar.name);
    if (sensitive) {
      return (
        <EnvSensitiveField
          key={knownVar.name}
          envKey={knownVar.name}
          knownVar={knownVar}
          value={currentEnv[knownVar.name]}
          scope={scope}
          onSave={envOnSave}
          onDelete={envOnDelete}
          disabled={saving}
        />
      );
    }
    const desc = getDescription(knownVar.name);
    return (
      <TextSetting
        key={knownVar.name}
        label={knownVar.name}
        description={desc ?? undefined}
        value={currentEnv[knownVar.name]}
        placeholder={t('settings.env.valuePlaceholder')}
        saveLabel={t('settings.common.save')}
        clearLabel={t('settings.common.clear')}
        settingKey={knownVar.name}
        scope={scope}
        defaultValue={knownVar.default}
        onSave={envOnSave}
        onDelete={envOnDelete}
      />
    );
  };

  // i18n description helper (can't use hook in render helper, so inline)
  const getDescription = (envKey: string): string | null => {
    const known = getKnownEnvVar(envKey);
    if (!known) return null;
    const i18nKey = `settings.env.knownVars.${envKey}.description` as Parameters<typeof t>[0];
    const localized = t(i18nKey);
    return localized !== i18nKey ? localized : null;
  };

  const typeGroups: [EnvVarValueType, string, (v: KnownEnvVar) => React.ReactElement][] = [
    [Boolean, 'boolean', renderBoolean],
    [Number, 'number', renderNumber],
    [String, 'string', renderString],
  ];

  return (
    <SettingsSectionWrapper>
      {typeGroups.map(([vt, groupKey, renderer]) => {
        const vars = knownVarsByType.get(vt);
        if (!vars || vars.length === 0) return null;
        return (
          <EnvCategoryGroup key={groupKey}>
            {vars.map(renderer)}
          </EnvCategoryGroup>
        );
      })}

      <EnvCategoryGroup>
        {customEntries.map(([key]) => (
          <EnvCustomField
            key={key}
            envKey={key}
            value={currentEnv[key]}
            existingKeys={Object.keys(currentEnv)}
            scope={scope}
            onSave={envOnSave}
            onDelete={envOnDelete}
            disabled={saving}
          />
        ))}
        <AddEnvForm
          existingKeys={Object.keys(currentEnv)}
          onAdd={handleAdd}
          disabled={saving}
        />
      </EnvCategoryGroup>
    </SettingsSectionWrapper>
  );
}

// ---------------------------------------------------------------------------
// EnvFieldRenderer — for use in search results
// ---------------------------------------------------------------------------

export interface EnvFieldRendererProps {
  envKey: string;
  currentEnv: Record<string, string>;
  scope: PluginScope;
  onEnvChange: (updatedEnv: Record<string, string>) => void;
  saving?: boolean;
}

export function EnvFieldRenderer({
  envKey,
  currentEnv,
  scope,
  onEnvChange,
  saving = false,
}: EnvFieldRendererProps): React.ReactElement | null {
  const { t } = useI18n();
  const knownVar = getKnownEnvVar(envKey);

  const envOnSave = async (key: string, value: unknown): Promise<void> => {
    const strVal = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    onEnvChange({ ...currentEnv, [key]: strVal });
  };

  const envOnDelete = async (key: string): Promise<void> => {
    const { [key]: _, ...rest } = currentEnv;
    onEnvChange(rest);
  };

  const getDescription = (key: string): string | null => {
    const known = getKnownEnvVar(key);
    if (!known) return null;
    const i18nKey = `settings.env.knownVars.${key}.description` as Parameters<typeof t>[0];
    const localized = t(i18nKey);
    return localized !== i18nKey ? localized : null;
  };

  if (!knownVar) {
    // Custom env var - shouldn't happen in search since we only index known vars
    return null;
  }

  const envVal = currentEnv[envKey];
  const desc = getDescription(envKey);

  if (knownVar.valueType === Boolean) {
    const boolVal = envVal !== undefined ? (envVal === '1' || envVal === 'true') : undefined;
    const defaultBool = knownVar.default !== undefined
      ? (knownVar.default === '1' || knownVar.default === 'true')
      : undefined;
    return (
      <BooleanToggle
        label={envKey}
        description={desc ?? undefined}
        value={boolVal}
        settingKey={envKey}
        defaultValue={defaultBool}
        onSave={envOnSave}
        onDelete={envOnDelete}
      />
    );
  }

  if (knownVar.valueType === Number) {
    const numVal = envVal !== undefined ? Number(envVal) : undefined;
    const defaultNum = knownVar.default !== undefined ? Number(knownVar.default) : undefined;
    return (
      <NumberSetting
        label={envKey}
        description={desc ?? undefined}
        value={numVal}
        placeholder={t('settings.env.valuePlaceholder')}
        saveLabel={t('settings.common.save')}
        clearLabel={t('settings.common.clear')}
        settingKey={envKey}
        scope={scope}
        defaultValue={defaultNum}
        onSave={envOnSave}
        onDelete={envOnDelete}
      />
    );
  }

  // String type
  const sensitive = knownVar.sensitive ?? isSensitiveKey(envKey);
  if (sensitive) {
    return (
      <EnvSensitiveField
        envKey={envKey}
        knownVar={knownVar}
        value={envVal}
        scope={scope}
        onSave={envOnSave}
        onDelete={envOnDelete}
        disabled={saving}
      />
    );
  }

  return (
    <TextSetting
      label={envKey}
      description={desc ?? undefined}
      value={envVal}
      placeholder={t('settings.env.valuePlaceholder')}
      saveLabel={t('settings.common.save')}
      clearLabel={t('settings.common.clear')}
      settingKey={envKey}
      scope={scope}
      defaultValue={knownVar.default}
      onSave={envOnSave}
      onDelete={envOnDelete}
    />
  );
}
