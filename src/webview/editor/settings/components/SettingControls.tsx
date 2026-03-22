import React, { useEffect, useState } from 'react';
import { useToast } from '../../../components/Toast';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope } from '../../../../shared/types';

// ---------------------------------------------------------------------------
// Override helpers
// ---------------------------------------------------------------------------

/** 判斷 key 是否覆寫了 parent scope 的值 */
export function getOverriddenScope(
  scope: PluginScope,
  userSettings: Record<string, unknown> | undefined,
  key: string,
): PluginScope | undefined {
  if (scope === 'user' || !userSettings) return undefined;
  return key in userSettings ? 'user' : undefined;
}

// ---------------------------------------------------------------------------
// Reset helper
// ---------------------------------------------------------------------------

/** 判斷是否應顯示 Reset 按鈕：有 default 且值與 default 不同 */
export function shouldShowReset(value: unknown, defaultValue: unknown): boolean {
  return defaultValue !== undefined && value !== undefined && value !== defaultValue;
}

// ---------------------------------------------------------------------------
// OverrideBadge
// ---------------------------------------------------------------------------

interface OverrideBadgeProps {
  scope: PluginScope;
}

function OverrideBadge({ scope }: OverrideBadgeProps): React.ReactElement {
  const { t } = useI18n();
  const scopeLabel = t(`settings.scope.${scope}` as Parameters<typeof t>[0]);
  const label = t('settings.common.overrides' as Parameters<typeof t>[0], { scope: scopeLabel });
  return (
    <span className="settings-override-badge" title={label}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SettingLabelText
// ---------------------------------------------------------------------------

interface SettingLabelTextProps {
  label: string;
  settingKey: string;
  defaultValue?: unknown;
  overriddenScope?: PluginScope;
}

function formatSettingKeyHint(settingKey: string, defaultValue?: unknown): string {
  if (
    defaultValue === '' ||
    defaultValue === undefined ||
    defaultValue === null ||
    Array.isArray(defaultValue) ||
    typeof defaultValue === 'object'
  ) {
    return `(${settingKey})`;
  }

  return `(${settingKey}: ${String(defaultValue)})`;
}

export function SettingLabelText({ label, settingKey, defaultValue, overriddenScope }: SettingLabelTextProps): React.ReactElement {
  return (
    <>
      <span>{label}</span>
      <span className="settings-key-hint" aria-hidden="true">
        {formatSettingKeyHint(settingKey, defaultValue)}
      </span>
      {overriddenScope && <OverrideBadge scope={overriddenScope} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// BooleanToggle
// ---------------------------------------------------------------------------

export interface BooleanToggleProps {
  label: string;
  description?: string;
  value: boolean | undefined;
  settingKey: string;
  defaultValue?: boolean;
  overriddenScope?: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function BooleanToggle({ label, description, value, settingKey, defaultValue, overriddenScope, onSave, onDelete }: BooleanToggleProps): React.ReactElement {
  const { addToast } = useToast();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const checked = value ?? defaultValue ?? false;
  const resetLabel = t('settings.common.reset');

  const handleChange = async (): Promise<void> => {
    setSaving(true);
    try {
      await onSave(settingKey, !checked);
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (): Promise<void> => {
    setSaving(true);
    try {
      await onDelete(settingKey);
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
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
            onChange={() => void handleChange()}
            disabled={saving}
          />
          <SettingLabelText label={label} settingKey={settingKey} defaultValue={defaultValue} overriddenScope={overriddenScope} />
        </label>
        {shouldShowReset(value, defaultValue) && (
          <button
            className="btn btn-secondary"
            onClick={() => void handleReset()}
            disabled={saving}
            type="button"
            aria-label={`${resetLabel} ${label}`}
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
// EnumDropdown
// ---------------------------------------------------------------------------

export interface EnumDropdownProps {
  label: string;
  description?: string;
  value: string | undefined;
  knownValues: readonly string[];
  knownLabels: Record<string, string>;
  notSetLabel: string;
  unknownTemplate: string;
  settingKey: string;
  defaultValue?: unknown;
  overriddenScope?: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function EnumDropdown({
  label,
  description,
  value,
  knownValues,
  knownLabels,
  notSetLabel,
  unknownTemplate,
  settingKey,
  defaultValue,
  overriddenScope,
  onSave,
  onDelete,
}: EnumDropdownProps): React.ReactElement {
  const { addToast } = useToast();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const resetLabel = t('settings.common.reset');

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
      <label className="settings-label" htmlFor={settingKey}>
        <SettingLabelText label={label} settingKey={settingKey} defaultValue={defaultValue} overriddenScope={overriddenScope} />
      </label>
      {description && <p className="settings-field-description">{description}</p>}
      <div className="settings-model-row">
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
        {shouldShowReset(value, defaultValue) && (
          <button
            className="btn btn-secondary"
            onClick={() => void handleChange('')}
            disabled={saving}
            type="button"
            aria-label={`${resetLabel} ${label}`}
          >
            {resetLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TextSetting
// ---------------------------------------------------------------------------

export interface TextSettingProps {
  label: string;
  description?: string;
  value: string | undefined;
  placeholder: string;
  saveLabel: string;
  clearLabel: string;
  settingKey: string;
  defaultValue?: unknown;
  overriddenScope?: PluginScope;
  scope: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function TextSetting({
  label,
  description,
  value,
  placeholder,
  saveLabel,
  clearLabel,
  settingKey,
  defaultValue,
  overriddenScope,
  scope,
  onSave,
  onDelete,
}: TextSettingProps): React.ReactElement {
  const { addToast } = useToast();
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const resetLabel = t('settings.common.reset');

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
      <label className="settings-label" htmlFor={settingKey}>
        <SettingLabelText label={label} settingKey={settingKey} defaultValue={defaultValue} overriddenScope={overriddenScope} />
      </label>
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
        {shouldShowReset(value, defaultValue) ? (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={saving}
            type="button"
            aria-label={`${resetLabel} ${label}`}
          >
            {resetLabel}
          </button>
        ) : value ? (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={saving}
            type="button"
          >
            {clearLabel}
          </button>
        ) : null}
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

export interface TagInputProps {
  label: string;
  description?: string;
  scope: PluginScope;
  tags: string[];
  emptyPlaceholder: string;
  inputPlaceholder: string;
  addLabel: string;
  duplicateError: string;
  settingKey: string;
  defaultValue?: unknown;
  overriddenScope?: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
}

export function TagInput({
  label,
  description,
  scope,
  tags,
  emptyPlaceholder,
  inputPlaceholder,
  addLabel,
  duplicateError,
  settingKey,
  defaultValue,
  overriddenScope,
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
      <label className="settings-label">
        <SettingLabelText label={label} settingKey={settingKey} defaultValue={defaultValue} overriddenScope={overriddenScope} />
      </label>
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
// TagListSetting
// ---------------------------------------------------------------------------

export interface TagListSettingProps {
  label: string;
  description?: string;
  scope: PluginScope;
  resetTrigger?: unknown;
  items: string[];
  emptyPlaceholder: string;
  inputPlaceholder: string;
  addLabel: string;
  duplicateError: string;
  clearLabel?: string;
  settingKey: string;
  disabled?: boolean;
  showClear?: boolean;
  beforeList?: React.ReactNode;
  afterInput?: React.ReactNode;
  onAddItem: (item: string) => void;
  onDeleteItem: (item: string) => void;
  onClear?: () => void;
}

export function TagListSetting({
  label,
  description,
  scope,
  resetTrigger,
  items,
  emptyPlaceholder,
  inputPlaceholder,
  addLabel,
  duplicateError,
  clearLabel,
  settingKey,
  disabled = false,
  showClear = false,
  beforeList,
  afterInput,
  onAddItem,
  onDeleteItem,
  onClear,
}: TagListSettingProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setInputValue('');
    setError('');
  }, [scope, resetTrigger]);

  const handleAdd = (): void => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      setError(duplicateError);
      return;
    }

    setError('');
    setInputValue('');
    onAddItem(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="settings-field">
      <label className="settings-label">
        <SettingLabelText label={label} settingKey={settingKey} />
      </label>
      {description && <p className="settings-field-description">{description}</p>}
      {beforeList}
      <div className="general-tag-list">
        {items.length === 0 ? (
          <span className="perm-empty">{emptyPlaceholder}</span>
        ) : (
          items.map((item) => (
            <span key={item} className="perm-rule-tag">
              {item}
              <button
                className="perm-rule-tag-delete"
                onClick={() => onDeleteItem(item)}
                aria-label={`Remove ${item}`}
                type="button"
                disabled={disabled}
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
          disabled={disabled}
        />
        <button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={disabled || !inputValue.trim()}
          type="button"
          aria-label={addLabel}
        >
          {addLabel}
        </button>
        {error && <span className="perm-add-error" role="alert">{error}</span>}
      </div>
      {afterInput}
      {showClear && onClear && clearLabel && (
        <div className="settings-actions">
          <button
            className="btn btn-secondary"
            onClick={onClear}
            disabled={disabled}
            type="button"
          >
            {clearLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NumberSetting
// ---------------------------------------------------------------------------

export interface NumberSettingProps {
  label: string;
  description?: string;
  value: number | undefined;
  placeholder: string;
  saveLabel: string;
  clearLabel: string;
  settingKey: string;
  scope: PluginScope;
  min?: number;
  max?: number;
  step?: number;
  minError?: string;
  maxError?: string;
  defaultValue?: unknown;
  overriddenScope?: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function NumberSetting({
  label,
  description,
  value,
  placeholder,
  saveLabel,
  clearLabel,
  settingKey,
  scope,
  min,
  max,
  step,
  minError,
  maxError,
  defaultValue,
  overriddenScope,
  onSave,
  onDelete,
}: NumberSettingProps): React.ReactElement {
  const { addToast } = useToast();
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState(value !== undefined ? String(value) : '');
  const resetLabel = t('settings.common.reset');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInputValue(value !== undefined ? String(value) : '');
  }, [scope, value]);

  const parsedValue = Number(inputValue);
  const isEmpty = inputValue === '';
  const belowMin = !isEmpty && !isNaN(parsedValue) && min !== undefined && parsedValue < min;
  const aboveMax = !isEmpty && !isNaN(parsedValue) && max !== undefined && parsedValue > max;
  const validationError = belowMin
    ? (minError ?? `Must be at least ${min}`)
    : aboveMax
      ? (maxError ?? `Must be at most ${max}`)
      : null;
  const saveDisabled = saving || belowMin || aboveMax || (!isEmpty && isNaN(parsedValue));

  const handleSave = async (): Promise<void> => {
    if (saveDisabled) return;
    setSaving(true);
    try {
      if (isEmpty) {
        await onDelete(settingKey);
      } else {
        await onSave(settingKey, parsedValue);
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
      <label className="settings-label" htmlFor={settingKey}>
        <SettingLabelText label={label} settingKey={settingKey} defaultValue={defaultValue} overriddenScope={overriddenScope} />
      </label>
      {description && <p className="settings-field-description">{description}</p>}
      <div className="settings-model-row">
        <input
          id={settingKey}
          className="input"
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          disabled={saving}
        />
        {shouldShowReset(value, defaultValue) ? (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={saving}
            type="button"
            aria-label={`${resetLabel} ${label}`}
          >
            {resetLabel}
          </button>
        ) : value !== undefined ? (
          <button
            className="btn btn-secondary"
            onClick={() => void handleClear()}
            disabled={saving}
            type="button"
          >
            {clearLabel}
          </button>
        ) : null}
        <button
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={saveDisabled}
          type="button"
        >
          {saveLabel}
        </button>
      </div>
      {validationError && <span className="perm-add-error" role="alert">{validationError}</span>}
    </div>
  );
}
