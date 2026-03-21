import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { getKnownEnvVar, getKnownEnvVarNames } from '../../../shared/known-env-vars';

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

// ---------------------------------------------------------------------------
// EnvRow
// ---------------------------------------------------------------------------

interface EnvRowProps {
  envKey: string;
  value: string;
  isEditing: boolean;
  onStartEdit: (key: string) => void;
  onCancelEdit: () => void;
  onConfirmEdit: (key: string, newValue: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  disabled: boolean;
}

function EnvRow({
  envKey,
  value,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onConfirmEdit,
  onDelete,
  disabled,
}: EnvRowProps): React.ReactElement {
  const { t } = useI18n();
  const sensitive = isSensitiveKey(envKey);
  const [isRevealed, setIsRevealed] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const description = useEnvVarDescription(envKey);

  const handleStartEdit = (): void => {
    setEditValue(sensitive ? '' : value);
    onStartEdit(envKey);
  };

  const handleConfirm = async (): Promise<void> => {
    setSaving(true);
    try {
      await onConfirmEdit(envKey, editValue);
    } finally {
      setSaving(false);
    }
  };

  const displayValue = sensitive && !isRevealed ? '••••••••' : value;

  return (
    <div className="env-entry">
      <div className="env-row">
        <span className="env-key">{envKey}</span>

        {isEditing ? (
        <div className="env-inline-edit">
          <input
            className="input"
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={sensitive ? t('settings.env.valuePlaceholder') : value}
            disabled={saving}
            autoFocus
          />
          <button
            className="btn btn-primary"
            onClick={() => void handleConfirm()}
            disabled={saving || editValue === ''}
            type="button"
          >
            {t('settings.env.confirm')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onCancelEdit}
            disabled={saving}
            type="button"
          >
            {t('settings.env.cancel')}
          </button>
        </div>
      ) : (
        <>
          <span className="env-value">
            {displayValue}
          </span>
          <div className="env-row-actions">
            {sensitive && (
              <button
                className="btn btn-secondary"
                onClick={() => setIsRevealed((r) => !r)}
                type="button"
                aria-label={t('settings.env.toggleReveal')}
                title={t('settings.env.toggleReveal')}
                disabled={disabled}
              >
                {isRevealed ? '🙈' : '👁'}
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={handleStartEdit}
              type="button"
              disabled={disabled}
            >
              {t('settings.env.edit')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => void onDelete(envKey)}
              type="button"
              disabled={disabled}
            >
              {t('settings.env.delete')}
            </button>
          </div>
        </>
      )}
      </div>
      {description && <span className="env-key-description">{description}</span>}
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
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const valueRef = useRef<HTMLInputElement>(null);
  // Precompute suggestions for keyboard handling
  const suggestions = useMemo(() => {
    if (!keyInput.trim()) return [];
    const upper = keyInput.toUpperCase();
    return getKnownEnvVarNames()
      .filter((name) => name.includes(upper) && !existingKeys.includes(name))
      .slice(0, 8);
  }, [keyInput, existingKeys]);

  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    setSelectedIdx(0);
  }, [suggestions.length, keyInput]);

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
      setShowAutocomplete(false);
    } finally {
      setAdding(false);
    }
  };

  const handleSelectSuggestion = (name: string): void => {
    setKeyInput(name);
    setError('');
    setShowAutocomplete(false);
    valueRef.current?.focus();
  };

  const handleKeyInputKeyDown = (e: React.KeyboardEvent): void => {
    if (!showAutocomplete || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && suggestions[selectedIdx]) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedIdx]);
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  const isAddDisabled = disabled || adding || !keyInput.trim() || !valueInput.trim();

  return (
    <div className="env-add-form">
      <div className="env-add-key-wrapper">
        <input
          className="input"
          type="text"
          value={keyInput}
          onChange={(e) => { setKeyInput(e.target.value); setError(''); setShowAutocomplete(true); }}
          onFocus={() => setShowAutocomplete(true)}
          onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
          onKeyDown={handleKeyInputKeyDown}
          placeholder={t('settings.env.keyPlaceholder')}
          disabled={disabled || adding}
          role="combobox"
          aria-expanded={showAutocomplete && suggestions.length > 0}
          aria-autocomplete="list"
        />
        {showAutocomplete && suggestions.length > 0 && (
          <div className="env-autocomplete" role="listbox">
            {suggestions.map((name, i) => {
              const known = getKnownEnvVar(name);
              const i18nKey = `settings.env.knownVars.${name}.description` as Parameters<typeof t>[0];
              const localDesc = t(i18nKey);
              const desc = localDesc !== i18nKey ? localDesc : known?.description ?? '';
              const catKey = `settings.env.category.${known?.category}` as Parameters<typeof t>[0];
              return (
                <div
                  key={name}
                  className={`env-autocomplete-item${i === selectedIdx ? ' env-autocomplete-item--selected' : ''}`}
                  role="option"
                  aria-selected={i === selectedIdx}
                  onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(name); }}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span className="env-autocomplete-name">{name}</span>
                  {known && <span className="env-autocomplete-category">{t(catKey)}</span>}
                  {desc && <span className="env-autocomplete-desc">{desc}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <input
        ref={valueRef}
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
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Reset editing state when scope changes
  useEffect(() => {
    setEditingKey(null);
  }, [scope]);

  const currentEnv: Record<string, string> = (settings.env as Record<string, string>) ?? {};
  const entries = Object.entries(currentEnv);

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

  const handleConfirmEdit = async (key: string, newValue: string): Promise<void> => {
    await updateEnv({ ...currentEnv, [key]: newValue });
    setEditingKey(null);
  };

  const handleDelete = async (key: string): Promise<void> => {
    const updated = { ...currentEnv };
    delete updated[key];
    await updateEnv(updated);
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.env')}</h3>

      <div className="env-list">
        {entries.length === 0 ? (
          <p className="env-empty">{t('settings.env.emptyState')}</p>
        ) : (
          entries.map(([key, val]) => (
            <EnvRow
              key={key}
              envKey={key}
              value={val}
              isEditing={editingKey === key}
              onStartEdit={setEditingKey}
              onCancelEdit={() => setEditingKey(null)}
              onConfirmEdit={handleConfirmEdit}
              onDelete={handleDelete}
              disabled={saving || (editingKey !== null && editingKey !== key)}
            />
          ))
        )}
      </div>

      <AddEnvForm
        existingKeys={Object.keys(currentEnv)}
        onAdd={handleAdd}
        disabled={saving || editingKey !== null}
      />
    </div>
  );
}
