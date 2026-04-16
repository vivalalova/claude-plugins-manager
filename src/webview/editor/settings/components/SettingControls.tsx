import React, { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import { useSettingSave } from '../hooks/useSettingSave';
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

/** 判斷是否應顯示 Reset 按鈕：有值即顯示 */
export function shouldShowReset(value: unknown): boolean {
  return value !== undefined;
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
  const hint = formatSettingKeyHint(settingKey, defaultValue);
  const showHint = label !== settingKey || hint !== `(${settingKey})`;
  return (
    <>
      <span>{label}</span>
      {showHint && (
        <span className="settings-key-hint" aria-hidden="true">
          {hint}
        </span>
      )}
      {overriddenScope && <OverrideBadge scope={overriddenScope} />}
    </>
  );
}

interface SettingFieldShellProps {
  label: string;
  description?: string;
  settingKey: string;
  defaultValue?: unknown;
  overriddenScope?: PluginScope;
  htmlFor?: string;
  children: React.ReactNode;
}

function SettingFieldShell({
  label,
  description,
  settingKey,
  defaultValue,
  overriddenScope,
  htmlFor,
  children,
}: SettingFieldShellProps): React.ReactElement {
  const labelContent = (
    <SettingLabelText
      label={label}
      settingKey={settingKey}
      defaultValue={defaultValue}
      overriddenScope={overriddenScope}
    />
  );

  return (
    <div className="settings-field">
      {htmlFor ? (
        <label className="settings-label" htmlFor={htmlFor}>
          {labelContent}
        </label>
      ) : (
        <label className="settings-label">
          {labelContent}
        </label>
      )}
      {description && <p className="settings-field-description">{description}</p>}
      {children}
    </div>
  );
}

function useScopedInputValue(
  scope: PluginScope,
  value: string,
): [string, React.Dispatch<React.SetStateAction<string>>] {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [scope, value]);

  return [inputValue, setInputValue];
}

interface SecondaryActionButtonProps {
  label: string;
  onClick: () => void;
  disabled: boolean;
  ariaLabel?: string;
}

function SecondaryActionButton({
  label,
  onClick,
  disabled,
  ariaLabel,
}: SecondaryActionButtonProps): React.ReactElement {
  return (
    <button
      className="btn btn-secondary"
      onClick={onClick}
      disabled={disabled}
      type="button"
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}

interface ResetOrClearButtonProps {
  value: unknown;
  resetLabel: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}

function ResetOrClearButton({
  value,
  resetLabel,
  label,
  disabled,
  onClick,
}: ResetOrClearButtonProps): React.ReactElement | null {
  if (!shouldShowReset(value)) return null;

  return (
    <SecondaryActionButton
      label={resetLabel}
      onClick={onClick}
      disabled={disabled}
      ariaLabel={`${resetLabel} ${label}`}
    />
  );
}

interface TagListProps {
  items: string[];
  emptyPlaceholder: string;
  disabled: boolean;
  renderItem?: (item: string, context: { disabled: boolean; onDelete: () => void }) => React.ReactNode;
  onDeleteItem: (item: string) => void;
}

function TagList({
  items,
  emptyPlaceholder,
  disabled,
  renderItem,
  onDeleteItem,
}: TagListProps): React.ReactElement {
  return (
    <div className="general-tag-list">
      {items.length === 0 ? (
        <span className="perm-empty">{emptyPlaceholder}</span>
      ) : (
        items.map((item) => (
          <React.Fragment key={item}>
            {renderItem
              ? renderItem(item, { disabled, onDelete: () => onDeleteItem(item) })
              : (
                <span className="perm-rule-tag">
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
              )}
          </React.Fragment>
        ))
      )}
    </div>
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
  const { saving, withSave } = useSettingSave();
  const { t } = useI18n();
  const checked = value ?? defaultValue ?? false;
  const resetLabel = t('settings.common.reset');

  const handleChange = (): void => {
    const newVal = !checked;
    void withSave(() =>
      defaultValue !== undefined && newVal === defaultValue
        ? onDelete(settingKey)
        : onSave(settingKey, newVal),
    );
  };

  const handleReset = (): void => {
    void withSave(() => onDelete(settingKey));
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
        {shouldShowReset(value) && (
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
  const { saving, withSave } = useSettingSave();
  const { t } = useI18n();
  const resetLabel = t('settings.common.reset');

  const isUnknown = value !== undefined && !knownValues.includes(value);
  const selectValue = isUnknown ? '__unknown__' : (value ?? '');

  const handleChange = (val: string): void => {
    if (val === '__unknown__') return;
    void withSave(async () => {
      if (val === '' || (defaultValue !== undefined && val === defaultValue)) {
        await onDelete(settingKey);
      } else {
        await onSave(settingKey, val);
      }
    });
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
        {shouldShowReset(value) && (
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
  clearLabel?: string;
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
  settingKey,
  defaultValue,
  overriddenScope,
  scope,
  onSave,
  onDelete,
}: TextSettingProps): React.ReactElement {
  const { saving, withSave } = useSettingSave();
  const { t } = useI18n();
  const [inputValue, setInputValue] = useScopedInputValue(scope, value ?? '');
  const resetLabel = t('settings.common.reset');

  const handleSave = (): void => {
    void withSave(async () => {
      const trimmed = inputValue.trim();
      if (!trimmed || (defaultValue !== undefined && trimmed === defaultValue)) {
        await onDelete(settingKey);
        setInputValue('');
      } else {
        await onSave(settingKey, trimmed);
      }
    });
  };

  const handleClear = (): void => {
    void withSave(async () => {
      await onDelete(settingKey);
      setInputValue('');
    });
  };

  return (
    <SettingFieldShell
      label={label}
      description={description}
      settingKey={settingKey}
      defaultValue={defaultValue}
      overriddenScope={overriddenScope}
      htmlFor={settingKey}
    >
      <div className="settings-model-row">
        <input
          id={settingKey}
          className="input settings-text-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          disabled={saving}
        />
        <ResetOrClearButton
          value={value}
          resetLabel={resetLabel}
          label={label}
          disabled={saving}
          onClick={() => void handleClear()}
        />
        <button
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={saving}
          type="button"
        >
          {saveLabel}
        </button>
      </div>
    </SettingFieldShell>
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
  const { saving, withSave } = useSettingSave();
  const [inputValue, setInputValue] = useScopedInputValue(scope, '');
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
  }, [scope]);

  const handleAdd = (): void => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setError(duplicateError);
      return;
    }
    setError('');
    void withSave(async () => {
      await onSave(settingKey, [...tags, trimmed]);
      setInputValue('');
    });
  };

  const handleDelete = (tag: string): void => {
    void withSave(() => onSave(settingKey, tags.filter((t) => t !== tag)));
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') void handleAdd();
  };

  return (
    <SettingFieldShell
      label={label}
      description={description}
      settingKey={settingKey}
      defaultValue={defaultValue}
      overriddenScope={overriddenScope}
    >
      <TagList
        items={tags}
        emptyPlaceholder={emptyPlaceholder}
        disabled={saving}
        onDeleteItem={(tag) => void handleDelete(tag)}
      />
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
    </SettingFieldShell>
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
  inputVariant?: 'single-line' | 'multi-line';
  inputRows?: number;
  renderItem?: (item: string, context: { disabled: boolean; onDelete: () => void }) => React.ReactNode;
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
  inputVariant = 'single-line',
  inputRows = 2,
  renderItem,
  onAddItem,
  onDeleteItem,
  onClear,
}: TagListSettingProps): React.ReactElement {
  const [inputValue, setInputValue] = useScopedInputValue(scope, '');
  const [error, setError] = useState('');

  useEffect(() => {
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
    <SettingFieldShell
      label={label}
      description={description}
      settingKey={settingKey}
    >
      {beforeList}
      <TagList
        items={items}
        emptyPlaceholder={emptyPlaceholder}
        disabled={disabled}
        renderItem={renderItem}
        onDeleteItem={onDeleteItem}
      />
      <div className="general-tag-add-row">
        {inputVariant === 'multi-line' ? (
          <textarea
            className="input"
            rows={inputRows}
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setError(''); }}
            placeholder={inputPlaceholder}
            disabled={disabled}
          />
        ) : (
          <input
            className="input"
            type="text"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            disabled={disabled}
          />
        )}
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
    </SettingFieldShell>
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
  clearLabel?: string;
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
  const { saving, withSave } = useSettingSave();
  const { t } = useI18n();
  const [inputValue, setInputValue] = useScopedInputValue(
    scope,
    value !== undefined ? String(value) : '',
  );
  const resetLabel = t('settings.common.reset');

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

  const handleSave = (): void => {
    if (saveDisabled) return;
    void withSave(async () => {
      if (isEmpty || (defaultValue !== undefined && parsedValue === defaultValue)) {
        await onDelete(settingKey);
        setInputValue('');
      } else {
        await onSave(settingKey, parsedValue);
      }
    });
  };

  const handleClear = (): void => {
    void withSave(async () => {
      await onDelete(settingKey);
      setInputValue('');
    });
  };

  return (
    <SettingFieldShell
      label={label}
      description={description}
      settingKey={settingKey}
      defaultValue={defaultValue}
      overriddenScope={overriddenScope}
      htmlFor={settingKey}
    >
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
        <ResetOrClearButton
          value={value}
          resetLabel={resetLabel}
          label={label}
          disabled={saving}
          onClick={() => void handleClear()}
        />
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
    </SettingFieldShell>
  );
}
