import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { getKnownEnvVar, getKnownEnvVarNames, getKnownEnvVarsByValueType } from '../../../shared/known-env-vars';
import type { KnownEnvVar, EnvVarValueType } from '../../../shared/known-env-vars';
import { BooleanToggle, TextSetting, NumberSetting } from './components/SettingControls';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENSITIVE_KEY_RE = /_SECRET$|_TOKEN$|_KEY$|_PASSWORD$|_CREDENTIAL$|^SECRET$|^TOKEN$|^PASSWORD$/i;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

const VALID_KEY_RE = /^[A-Z0-9_]+$/i;

function useEnvVarDescription(envKey: string): string | null {
  const { t } = useI18n();
  const known = getKnownEnvVar(envKey);
  if (!known) return null;
  const i18nKey = `settings.env.knownVars.${envKey}.description` as Parameters<typeof t>[0];
  const localized = t(i18nKey);
  return localized !== i18nKey ? localized : null;
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
  const [inputValue, setInputValue] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLabel = t('settings.common.save');
  const clearLabel = t('settings.common.clear');
  const defaultVal = knownVar?.default;

  useEffect(() => {
    setInputValue('');
    setIsRevealed(false);
  }, [scope, value]);

  const handleSave = async (): Promise<void> => {
    const trimmed = inputValue.trim();
    setSaving(true);
    try {
      if (!trimmed) {
        await onDelete(envKey);
      } else {
        await onSave(envKey, trimmed);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (): Promise<void> => {
    setSaving(true);
    try {
      await onDelete(envKey);
      setInputValue('');
    } finally {
      setSaving(false);
    }
  };

  const inputType = !isRevealed ? 'password' : 'text';

  return (
    <div className="settings-field">
      <label className="settings-label" htmlFor={`env-${envKey}`}>
        <span>{envKey}</span>
        <span className="settings-key-hint" aria-hidden="true">
          ({envKey}{defaultVal ? `: ${defaultVal}` : ''})
        </span>
      </label>
      {description && <p className="settings-field-description">{description}</p>}
      <div className="settings-model-row">
        <div className="env-sensitive-row">
          <input
            id={`env-${envKey}`}
            className="input"
            type={inputType}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={value ? '••••••••' : t('settings.env.valuePlaceholder')}
            disabled={disabled || saving}
          />
          <button
            className="btn btn-secondary"
            onClick={() => setIsRevealed((r) => !r)}
            type="button"
            disabled={disabled || saving}
          >
            {isRevealed ? '🙈' : '👁'}
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
// EnvCategoryGroup
// ---------------------------------------------------------------------------

function EnvCategoryGroup({ groupKey, children }: { groupKey: string; children: React.ReactNode }): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="env-category-group">
      <h4 className="env-category-title">{t(groupKey as Parameters<typeof t>[0])}</h4>
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
    if (!key.trim() || !valueInput.trim()) return '';
    if (!VALID_KEY_RE.test(key)) return t('settings.env.invalidKey');
    if (existingKeys.includes(key)) return t('settings.env.duplicateKey');
    return '';
  };

  const handleAdd = async (): Promise<void> => {
    const err = validate(keyInput);
    if (err) { setError(err); return; }
    if (!keyInput.trim() || !valueInput.trim()) return;
    setAdding(true);
    try {
      await onAdd(keyInput.trim(), valueInput.trim());
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
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

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

  const updateEnv = async (updatedEnv: Record<string, string>): Promise<void> => {
    setSaving(true);
    try {
      await onSave('env', updatedEnv);
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Adapter: bridge per-key save/delete to whole-env-object update
  const envOnSave = async (key: string, value: unknown): Promise<void> => {
    const strVal = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    await updateEnv({ ...currentEnv, [key]: strVal });
  };

  const envOnDelete = async (key: string): Promise<void> => {
    const { [key]: _, ...rest } = currentEnv;
    await updateEnv(rest);
  };

  const handleAdd = async (key: string, value: string): Promise<void> => {
    await updateEnv({ ...currentEnv, [key]: value });
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

  const typeGroupKeys: Record<EnvVarValueType, string> = {
    boolean: 'settings.env.group.boolean',
    number: 'settings.env.group.number',
    string: 'settings.env.group.string',
  };

  const typeRenderers: Record<EnvVarValueType, (v: KnownEnvVar) => React.ReactElement> = {
    boolean: renderBoolean,
    number: renderNumber,
    string: renderString,
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.env')}</h3>

      {(['boolean', 'number', 'string'] as EnvVarValueType[]).map((vt) => {
        const vars = knownVarsByType.get(vt);
        if (!vars || vars.length === 0) return null;
        return (
          <EnvCategoryGroup key={vt} groupKey={typeGroupKeys[vt]}>
            {vars.map(typeRenderers[vt])}
          </EnvCategoryGroup>
        );
      })}

      <EnvCategoryGroup groupKey="settings.env.customCategory">
        {customEntries.map(([key]) => (
          <TextSetting
            key={key}
            label={key}
            value={currentEnv[key]}
            placeholder={t('settings.env.valuePlaceholder')}
            saveLabel={t('settings.common.save')}
            clearLabel={t('settings.common.clear')}
            settingKey={key}
            scope={scope}
            onSave={envOnSave}
            onDelete={envOnDelete}
          />
        ))}
        <AddEnvForm
          existingKeys={Object.keys(currentEnv)}
          onAdd={handleAdd}
          disabled={saving}
        />
      </EnvCategoryGroup>
    </div>
  );
}
