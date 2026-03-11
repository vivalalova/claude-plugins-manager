import React, { useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENSITIVE_KEY_RE = /_SECRET$|_TOKEN$|_KEY$|_PASSWORD$|_CREDENTIAL$|^SECRET$|^TOKEN$|^PASSWORD$/i;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

const VALID_KEY_RE = /^[A-Z0-9_]+$/i;

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
