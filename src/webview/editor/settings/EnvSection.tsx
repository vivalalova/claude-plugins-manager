import React, { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useSettingSave } from './hooks/useSettingSave';
import type { PluginScope } from '../../../shared/types';
import { getKnownEnvVar, getKnownEnvVarNames, getKnownEnvVarsByValueType } from '../../../shared/known-env-vars';
import type { KnownEnvVar, EnvVarValueType } from '../../../shared/known-env-vars';
import { BooleanToggle, TextSetting, NumberSetting } from './components/SettingControls';
import { ObjectSetting } from './components/ObjectSetting';
import { SchemaSection, type SectionProps } from './components/SchemaSection';

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
  onSave: (key: string, value: unknown) => Promise<boolean>;
  onDelete: (key: string) => Promise<boolean>;
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
      const deleted = await onDelete(envKey);
      if (deleted) {
        setDraft((current) => ({ ...current, inputValue: '' }));
      }
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
  onSave: (key: string, value: unknown) => Promise<boolean>;
  onRename: (oldKey: string, newKey: string, value: string) => Promise<boolean>;
  onDelete: (key: string) => Promise<boolean>;
  disabled: boolean;
}

function EnvCustomField({
  envKey,
  value,
  existingKeys,
  scope,
  onSave,
  onRename,
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
        await onRename(envKey, normalizedDraft.key, normalizedDraft.value);
      } else {
        await onSave(envKey, normalizedDraft.value);
      }
    });
  };

  const handleClear = async (): Promise<void> => {
    setError('');
    await runWithSaving(async () => {
      const deleted = await onDelete(envKey);
      if (deleted) {
        setDraft((current) => ({ ...current, inputValue: '' }));
      }
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
  onAdd: (key: string, value: string) => Promise<boolean>;
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
      const saved = await onAdd(normalizedDraft.key, normalizedDraft.value);
      if (saved) {
        setKeyInput('');
        setValueInput('');
        setError('');
      }
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

interface EnvObjectEditorProps {
  scope: PluginScope;
  currentEnv: Record<string, string>;
  onSaveEnv: (updatedEnv: Record<string, string>) => Promise<void>;
}

function EnvObjectEditor({ scope, currentEnv, onSaveEnv }: EnvObjectEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();
  const knownVarsByType = useMemo(() => getKnownEnvVarsByValueType(), []);
  const knownNames = useMemo(() => new Set(getKnownEnvVarNames()), []);

  const customEntries = useMemo(
    () => Object.entries(currentEnv).filter(([key]) => !knownNames.has(key)),
    [currentEnv, knownNames],
  );

  const updateEnv = async (updatedEnv: Record<string, string>): Promise<boolean> => {
    let saved = false;
    await withSave(async () => {
      await onSaveEnv(updatedEnv);
      saved = true;
    });
    return saved;
  };

  // Adapter: bridge per-key save/delete to whole-env-object update
  const envOnSave = async (key: string, value: unknown): Promise<boolean> => {
    const strVal = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    return updateEnv({ ...currentEnv, [key]: strVal });
  };

  const envOnRename = async (oldKey: string, newKey: string, value: string): Promise<boolean> => {
    const { [oldKey]: _, ...rest } = currentEnv;
    return updateEnv({ ...rest, [newKey]: value });
  };

  const envOnDelete = async (key: string): Promise<boolean> => {
    const { [key]: _, ...rest } = currentEnv;
    return updateEnv(rest);
  };

  const envOnSaveVoid = async (key: string, value: unknown): Promise<void> => {
    await envOnSave(key, value);
  };

  const envOnDeleteVoid = async (key: string): Promise<void> => {
    await envOnDelete(key);
  };

  const handleAdd = async (key: string, value: string): Promise<boolean> => {
    return updateEnv({ ...currentEnv, [key]: value });
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
        disabled={saving}
        onSave={envOnSaveVoid}
        onDelete={envOnDeleteVoid}
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
        disabled={saving}
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
        disabled={saving}
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
    <ObjectSetting
      label={t('settings.env.env.label')}
      description={t('settings.env.env.description')}
      settingKey="env"
    >
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
            onRename={envOnRename}
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
    </ObjectSetting>
  );
}

export function EnvSection({ scope, settings, onSave, onDelete }: SectionProps): React.ReactElement {
  const currentEnv = useMemo<Record<string, string>>(
    () => (settings.env as Record<string, string>) ?? {},
    [settings.env],
  );

  return (
    <SchemaSection
      section="env"
      scope={scope}
      settings={settings}
      onSave={onSave}
      onDelete={onDelete}
      renderCustom={(key) => {
        if (key !== 'env') return null;
        return (
          <EnvObjectEditor
            scope={scope}
            currentEnv={currentEnv}
            onSaveEnv={(updatedEnv) => onSave('env', updatedEnv)}
          />
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// EnvFieldRenderer — for use in search results
// ---------------------------------------------------------------------------

export interface EnvFieldRendererProps {
  envKey: string;
  currentEnv: Record<string, string>;
  scope: PluginScope;
  onEnvChange: (updatedEnv: Record<string, string>) => Promise<void>;
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

  const envOnSave = async (key: string, value: unknown): Promise<boolean> => {
    const strVal = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    await onEnvChange({ ...currentEnv, [key]: strVal });
    return true;
  };

  const envOnDelete = async (key: string): Promise<boolean> => {
    const { [key]: _, ...rest } = currentEnv;
    await onEnvChange(rest);
    return true;
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
        onSave={async (key, value) => {
          return envOnSave(key, value);
        }}
        onDelete={async (key) => {
          return envOnDelete(key);
        }}
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

// ---------------------------------------------------------------------------
// CustomizedEnvEditor — per-entry inline editor for the Customized tab
// Renders ONLY env vars already set in the current scope: known vars via
// EnvFieldRenderer, custom (unknown) vars via EnvCustomField. No AddEnvForm,
// no listing of unset known vars.
// ---------------------------------------------------------------------------

interface CustomizedEnvEditorProps {
  scope: PluginScope;
  currentEnv: Record<string, string>;
  onSaveEnv: (updatedEnv: Record<string, string>) => Promise<void>;
}

export function CustomizedEnvEditor({ scope, currentEnv, onSaveEnv }: CustomizedEnvEditorProps): React.ReactElement {
  const { saving, withSave } = useSettingSave();

  const updateEnv = async (updatedEnv: Record<string, string>): Promise<boolean> => {
    let saved = false;
    await withSave(async () => {
      await onSaveEnv(updatedEnv);
      saved = true;
    });
    return saved;
  };

  const envOnSave = async (key: string, value: unknown): Promise<boolean> => {
    const strVal = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    return updateEnv({ ...currentEnv, [key]: strVal });
  };

  const envOnRename = async (oldKey: string, newKey: string, value: string): Promise<boolean> => {
    const { [oldKey]: _, ...rest } = currentEnv;
    return updateEnv({ ...rest, [newKey]: value });
  };

  const envOnDelete = async (key: string): Promise<boolean> => {
    const { [key]: _, ...rest } = currentEnv;
    return updateEnv(rest);
  };

  const existingKeys = Object.keys(currentEnv);

  return (
    <EnvCategoryGroup>
      {existingKeys.map((key) =>
        getKnownEnvVar(key) ? (
          <EnvFieldRenderer
            key={key}
            envKey={key}
            currentEnv={currentEnv}
            scope={scope}
            onEnvChange={onSaveEnv}
            saving={saving}
          />
        ) : (
          <EnvCustomField
            key={key}
            envKey={key}
            value={currentEnv[key]}
            existingKeys={existingKeys}
            scope={scope}
            onSave={envOnSave}
            onRename={envOnRename}
            onDelete={envOnDelete}
            disabled={saving}
          />
        ),
      )}
    </EnvCategoryGroup>
  );
}
