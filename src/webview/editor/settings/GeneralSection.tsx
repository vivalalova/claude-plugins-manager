import React, { useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_EFFORT_LEVELS = ['high', 'medium', 'low'] as const;
const KNOWN_OUTPUT_STYLES = ['auto', 'stream-json'] as const;

// ---------------------------------------------------------------------------
// BooleanToggle
// ---------------------------------------------------------------------------

interface BooleanToggleProps {
  label: string;
  description?: string;
  value: boolean | undefined;
  settingKey: string;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function BooleanToggle({ label, description, value, settingKey, onSave, onDelete }: BooleanToggleProps): React.ReactElement {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const checked = value ?? false;

  const handleChange = async (): Promise<void> => {
    setSaving(true);
    try {
      if (checked) {
        await onDelete(settingKey);
      } else {
        await onSave(settingKey, true);
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <label className="hooks-toggle-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => void handleChange()}
          disabled={saving}
        />
        {label}
      </label>
      {description && <p className="settings-field-description">{description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnumDropdown
// ---------------------------------------------------------------------------

interface EnumDropdownProps {
  label: string;
  description?: string;
  value: string | undefined;
  knownValues: readonly string[];
  knownLabels: Record<string, string>;
  notSetLabel: string;
  unknownTemplate: string;
  settingKey: string;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function EnumDropdown({
  label,
  description,
  value,
  knownValues,
  knownLabels,
  notSetLabel,
  unknownTemplate,
  settingKey,
  onSave,
  onDelete,
}: EnumDropdownProps): React.ReactElement {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const isUnknown = value !== undefined && !knownValues.includes(value);
  const selectValue = isUnknown ? '__unknown__' : (value ?? '');

  const handleChange = async (val: string): Promise<void> => {
    if (val === '__unknown__') return;
    setSaving(true);
    try {
      if (val === '') {
        await onDelete(settingKey);
      } else {
        await onSave(settingKey, val);
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <label className="settings-label" htmlFor={settingKey}>{label}</label>
      {description && <p className="settings-field-description">{description}</p>}
      <select
        id={settingKey}
        className="select"
        value={selectValue}
        onChange={(e) => void handleChange(e.target.value)}
        disabled={saving}
      >
        <option value="">{notSetLabel}</option>
        {isUnknown && (
          <option value="__unknown__" disabled>
            {unknownTemplate.replace('{value}', value!)}
          </option>
        )}
        {knownValues.map((v) => (
          <option key={v} value={v}>{knownLabels[v] ?? v}</option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TextSetting
// ---------------------------------------------------------------------------

interface TextSettingProps {
  label: string;
  description?: string;
  value: string | undefined;
  placeholder: string;
  saveLabel: string;
  clearLabel: string;
  settingKey: string;
  scope: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function TextSetting({
  label,
  description,
  value,
  placeholder,
  saveLabel,
  clearLabel,
  settingKey,
  scope,
  onSave,
  onDelete,
}: TextSettingProps): React.ReactElement {
  const { addToast } = useToast();
  const [inputValue, setInputValue] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInputValue(value ?? '');
  }, [scope, value]);

  const handleSave = async (): Promise<void> => {
    const trimmed = inputValue.trim();
    setSaving(true);
    try {
      if (!trimmed) {
        await onDelete(settingKey);
      } else {
        await onSave(settingKey, trimmed);
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (): Promise<void> => {
    setSaving(true);
    try {
      await onDelete(settingKey);
      setInputValue('');
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <label className="settings-label" htmlFor={settingKey}>{label}</label>
      {description && <p className="settings-field-description">{description}</p>}
      <div className="settings-model-row">
        <input
          id={settingKey}
          className="input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          disabled={saving}
        />
        {value && (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={saving}
            type="button"
          >
            {clearLabel}
          </button>
        )}
      </div>
      <div className="settings-actions">
        <button
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={saving}
          type="button"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TagInput
// ---------------------------------------------------------------------------

interface TagInputProps {
  label: string;
  description?: string;
  scope: PluginScope;
  tags: string[];
  emptyPlaceholder: string;
  inputPlaceholder: string;
  addLabel: string;
  duplicateError: string;
  settingKey: string;
  onSave: (key: string, value: unknown) => Promise<void>;
}

function TagInput({
  label,
  description,
  scope,
  tags,
  emptyPlaceholder,
  inputPlaceholder,
  addLabel,
  duplicateError,
  settingKey,
  onSave,
}: TagInputProps): React.ReactElement {
  const { addToast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInputValue('');
    setError('');
  }, [scope]);

  const handleAdd = async (): Promise<void> => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setError(duplicateError);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave(settingKey, [...tags, trimmed]);
      setInputValue('');
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: string): Promise<void> => {
    setSaving(true);
    try {
      await onSave(settingKey, tags.filter((t) => t !== tag));
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') void handleAdd();
  };

  return (
    <div className="settings-field">
      <label className="settings-label">{label}</label>
      {description && <p className="settings-field-description">{description}</p>}
      <div className="general-tag-list">
        {tags.length === 0 ? (
          <span className="perm-empty">{emptyPlaceholder}</span>
        ) : (
          tags.map((tag) => (
            <span key={tag} className="perm-rule-tag">
              {tag}
              <button
                className="perm-rule-tag-delete"
                onClick={() => void handleDelete(tag)}
                aria-label={`Remove ${tag}`}
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
          placeholder={inputPlaceholder}
          disabled={saving}
        />
        <button
          className="btn btn-primary"
          onClick={() => void handleAdd()}
          disabled={saving || !inputValue.trim()}
          type="button"
        >
          {addLabel}
        </button>
        {error && <span className="perm-add-error" role="alert">{error}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GeneralSection
// ---------------------------------------------------------------------------

interface GeneralSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function GeneralSection({ scope, settings, onSave, onDelete }: GeneralSectionProps): React.ReactElement {
  const { t } = useI18n();

  const effortLabels: Record<string, string> = {
    high: t('settings.general.effortLevel.high'),
    medium: t('settings.general.effortLevel.medium'),
    low: t('settings.general.effortLevel.low'),
  };

  const outputLabels: Record<string, string> = {
    auto: t('settings.general.outputStyle.auto'),
    'stream-json': t('settings.general.outputStyle.streamJson'),
  };

  const booleanFields: { key: keyof ClaudeSettings; label: string; description: string }[] = [
    { key: 'enableAllProjectMcpServers', label: t('settings.general.enableAllProjectMcpServers.label'), description: t('settings.general.enableAllProjectMcpServers.description') },
    { key: 'includeGitInstructions', label: t('settings.general.includeGitInstructions.label'), description: t('settings.general.includeGitInstructions.description') },
    { key: 'respectGitignore', label: t('settings.general.respectGitignore.label'), description: t('settings.general.respectGitignore.description') },
    { key: 'fastMode', label: t('settings.general.fastMode.label'), description: t('settings.general.fastMode.description') },
    { key: 'alwaysThinkingEnabled', label: t('settings.general.alwaysThinkingEnabled.label'), description: t('settings.general.alwaysThinkingEnabled.description') },
  ];

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.general')}</h3>

      <EnumDropdown
        label={t('settings.general.effortLevel.label')}
        description={t('settings.general.effortLevel.description')}
        value={settings.effortLevel}
        knownValues={KNOWN_EFFORT_LEVELS}
        knownLabels={effortLabels}
        notSetLabel={t('settings.general.effortLevel.notSet')}
        unknownTemplate={t('settings.general.effortLevel.unknown')}
        settingKey="effortLevel"
        onSave={onSave}
        onDelete={onDelete}
      />

      <TextSetting
        label={t('settings.general.language.label')}
        description={t('settings.general.language.description')}
        value={settings.language}
        placeholder={t('settings.general.language.placeholder')}
        saveLabel={t('settings.general.language.save')}
        clearLabel={t('settings.general.language.clear')}
        settingKey="language"
        scope={scope}
        onSave={onSave}
        onDelete={onDelete}
      />

      <TagInput
        label={t('settings.general.availableModels.label')}
        description={t('settings.general.availableModels.description')}
        scope={scope}
        tags={settings.availableModels ?? []}
        emptyPlaceholder={t('settings.general.availableModels.empty')}
        inputPlaceholder={t('settings.general.availableModels.placeholder')}
        addLabel={t('settings.general.availableModels.add')}
        duplicateError={t('settings.general.availableModels.duplicate')}
        settingKey="availableModels"
        onSave={onSave}
      />

      {booleanFields.map(({ key, label, description }) => (
        <BooleanToggle
          key={key}
          label={label}
          description={description}
          value={settings[key] as boolean | undefined}
          settingKey={key}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}

      <EnumDropdown
        label={t('settings.general.outputStyle.label')}
        value={settings.outputStyle}
        description={t('settings.general.outputStyle.description')}
        knownValues={KNOWN_OUTPUT_STYLES}
        knownLabels={outputLabels}
        notSetLabel={t('settings.general.outputStyle.notSet')}
        unknownTemplate={t('settings.general.outputStyle.unknown')}
        settingKey="outputStyle"
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}
