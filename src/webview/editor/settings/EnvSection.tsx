import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { getKnownEnvVar, getKnownEnvVarNames, getKnownEnvVarsByCategory, CATEGORY_ORDER } from '../../../shared/known-env-vars';
import type { KnownEnvVar } from '../../../shared/known-env-vars';

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
  return localized !== i18nKey ? localized : known.description;
}

function formatDefaultHint(envKey: string, defaultValue?: string): string {
  if (!defaultValue) return `(${envKey})`;
  return `(${envKey}: ${defaultValue})`;
}

// ---------------------------------------------------------------------------
// EnvBooleanField
// ---------------------------------------------------------------------------

interface EnvFieldProps {
  envKey: string;
  knownVar?: KnownEnvVar;
  value: string | undefined;
  currentEnv: Record<string, string>;
  onUpdateEnv: (env: Record<string, string>) => Promise<void>;
  disabled: boolean;
}

function EnvBooleanField({ envKey, knownVar, value, currentEnv, onUpdateEnv, disabled }: EnvFieldProps): React.ReactElement {
  const { t } = useI18n();
  const description = useEnvVarDescription(envKey);
  const [saving, setSaving] = useState(false);
  const resetLabel = t('settings.common.reset');

  const checked = value === '1' || value === 'true';
  const hasValue = value !== undefined;
  const defaultVal = knownVar?.default;
  const defaultChecked = defaultVal === '1' || defaultVal === 'true';
  const showReset = hasValue && defaultVal !== undefined && checked !== defaultChecked;

  const handleToggle = async (): Promise<void> => {
    setSaving(true);
    try {
      await onUpdateEnv({ ...currentEnv, [envKey]: checked ? '0' : '1' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    setSaving(true);
    try {
      const updated = { ...currentEnv };
      delete updated[envKey];
      await onUpdateEnv(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <div className="settings-toggle-row">
        <label className="hooks-toggle-label">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => void handleToggle()}
            disabled={disabled || saving}
          />
          <span>{envKey}</span>
          <span className="settings-key-hint" aria-hidden="true">
            {formatDefaultHint(envKey, defaultVal)}
          </span>
        </label>
        {showReset && (
          <button
            className="btn btn-secondary"
            onClick={() => void handleReset()}
            disabled={disabled || saving}
            type="button"
          >
            {resetLabel}
          </button>
        )}
      </div>
      {description && <p className="settings-field-description">{description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnvNumberField
// ---------------------------------------------------------------------------

interface EnvNumberFieldProps extends EnvFieldProps {
  scope: PluginScope;
}

function EnvNumberField({ envKey, knownVar, value, currentEnv, onUpdateEnv, disabled, scope }: EnvNumberFieldProps): React.ReactElement {
  const { t } = useI18n();
  const description = useEnvVarDescription(envKey);
  const [inputValue, setInputValue] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const saveLabel = t('settings.common.save');
  const clearLabel = t('settings.common.clear');
  const resetLabel = t('settings.common.reset');
  const defaultVal = knownVar?.default;

  useEffect(() => {
    setInputValue(value ?? '');
  }, [scope, value]);

  const showReset = defaultVal !== undefined && value !== undefined && value !== defaultVal;

  const handleSave = async (): Promise<void> => {
    const trimmed = inputValue.trim();
    setSaving(true);
    try {
      if (!trimmed) {
        const updated = { ...currentEnv };
        delete updated[envKey];
        await onUpdateEnv(updated);
      } else {
        await onUpdateEnv({ ...currentEnv, [envKey]: trimmed });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (): Promise<void> => {
    setSaving(true);
    try {
      const updated = { ...currentEnv };
      delete updated[envKey];
      await onUpdateEnv(updated);
      setInputValue('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <label className="settings-label" htmlFor={`env-${envKey}`}>
        <span>{envKey}</span>
        <span className="settings-key-hint" aria-hidden="true">
          {formatDefaultHint(envKey, defaultVal)}
        </span>
      </label>
      {description && <p className="settings-field-description">{description}</p>}
      <div className="settings-model-row">
        <input
          id={`env-${envKey}`}
          className="input"
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t('settings.env.valuePlaceholder')}
          disabled={disabled || saving}
        />
        {showReset ? (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={disabled || saving}
            type="button"
          >
            {resetLabel}
          </button>
        ) : value !== undefined ? (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={disabled || saving}
            type="button"
          >
            {clearLabel}
          </button>
        ) : null}
      </div>
      <div className="settings-actions">
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
// EnvStringField
// ---------------------------------------------------------------------------

interface EnvStringFieldProps extends EnvFieldProps {
  scope: PluginScope;
}

function EnvStringField({ envKey, knownVar, value, currentEnv, onUpdateEnv, disabled, scope }: EnvStringFieldProps): React.ReactElement {
  const { t } = useI18n();
  const description = useEnvVarDescription(envKey);
  const sensitive = knownVar?.sensitive ?? isSensitiveKey(envKey);
  const [inputValue, setInputValue] = useState(sensitive ? '' : (value ?? ''));
  const [isRevealed, setIsRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLabel = t('settings.common.save');
  const clearLabel = t('settings.common.clear');
  const resetLabel = t('settings.common.reset');
  const defaultVal = knownVar?.default;

  useEffect(() => {
    setInputValue(sensitive ? '' : (value ?? ''));
    setIsRevealed(false);
  }, [scope, value, sensitive]);

  const showReset = defaultVal !== undefined && value !== undefined && value !== defaultVal;

  const handleSave = async (): Promise<void> => {
    const trimmed = inputValue.trim();
    setSaving(true);
    try {
      if (!trimmed) {
        const updated = { ...currentEnv };
        delete updated[envKey];
        await onUpdateEnv(updated);
      } else {
        await onUpdateEnv({ ...currentEnv, [envKey]: trimmed });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (): Promise<void> => {
    setSaving(true);
    try {
      const updated = { ...currentEnv };
      delete updated[envKey];
      await onUpdateEnv(updated);
      setInputValue('');
    } finally {
      setSaving(false);
    }
  };

  const inputType = sensitive && !isRevealed ? 'password' : 'text';

  return (
    <div className="settings-field">
      <label className="settings-label" htmlFor={`env-${envKey}`}>
        <span>{envKey}</span>
        <span className="settings-key-hint" aria-hidden="true">
          {formatDefaultHint(envKey, defaultVal)}
        </span>
      </label>
      {description && <p className="settings-field-description">{description}</p>}
      <div className="settings-model-row">
        {sensitive ? (
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
        ) : (
          <input
            id={`env-${envKey}`}
            className="input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('settings.env.valuePlaceholder')}
            disabled={disabled || saving}
          />
        )}
        {showReset ? (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={disabled || saving}
            type="button"
          >
            {resetLabel}
          </button>
        ) : value !== undefined ? (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={disabled || saving}
            type="button"
          >
            {clearLabel}
          </button>
        ) : null}
      </div>
      <div className="settings-actions">
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

function EnvCategoryGroup({ category, children }: { category: string; children: React.ReactNode }): React.ReactElement {
  const { t } = useI18n();
  const catKey = category === 'custom'
    ? 'settings.env.customCategory'
    : `settings.env.category.${category}`;
  return (
    <div className="env-category-group">
      <h4 className="env-category-title">{t(catKey as Parameters<typeof t>[0])}</h4>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddEnvForm (simplified — no autocomplete, known vars already listed)
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

  const knownVarsByCategory = useMemo(() => getKnownEnvVarsByCategory(), []);
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

  const handleAdd = async (key: string, value: string): Promise<void> => {
    await updateEnv({ ...currentEnv, [key]: value });
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.env')}</h3>

      {CATEGORY_ORDER.map((category) => {
        const vars = knownVarsByCategory.get(category);
        if (!vars || vars.length === 0) return null;
        return (
          <EnvCategoryGroup key={category} category={category}>
            {vars.map((knownVar) => {
              const value = currentEnv[knownVar.name];
              switch (knownVar.valueType) {
                case 'boolean':
                  return (
                    <EnvBooleanField
                      key={knownVar.name}
                      envKey={knownVar.name}
                      knownVar={knownVar}
                      value={value}
                      currentEnv={currentEnv}
                      onUpdateEnv={updateEnv}
                      disabled={saving}
                    />
                  );
                case 'number':
                  return (
                    <EnvNumberField
                      key={knownVar.name}
                      envKey={knownVar.name}
                      knownVar={knownVar}
                      value={value}
                      currentEnv={currentEnv}
                      onUpdateEnv={updateEnv}
                      disabled={saving}
                      scope={scope}
                    />
                  );
                default:
                  return (
                    <EnvStringField
                      key={knownVar.name}
                      envKey={knownVar.name}
                      knownVar={knownVar}
                      value={value}
                      currentEnv={currentEnv}
                      onUpdateEnv={updateEnv}
                      disabled={saving}
                      scope={scope}
                    />
                  );
              }
            })}
          </EnvCategoryGroup>
        );
      })}

      <EnvCategoryGroup category="custom">
        {customEntries.map(([key]) => (
          <EnvStringField
            key={key}
            envKey={key}
            value={currentEnv[key]}
            currentEnv={currentEnv}
            onUpdateEnv={updateEnv}
            disabled={saving}
            scope={scope}
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
