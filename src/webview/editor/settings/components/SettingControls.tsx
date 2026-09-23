import React, { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import { useSettingSave } from '../hooks/useSettingSave';
import type { PluginScope } from '../../../../shared/types';
import { getFlatFieldSchema, isScopeEffective } from '../../../../shared/claude-settings-schema';

// ---------------------------------------------------------------------------
// Override helpers
// ---------------------------------------------------------------------------

/**
 * 各 scope 的「父層」鏈，依優先序由近到遠（local 蓋過 project 蓋過 user）。
 * override badge 找的是「本層往下覆寫的最近一層」。
 */
export const PARENT_SCOPES: Record<PluginScope, readonly PluginScope[]> = {
  user: [],
  project: ['user'],
  local: ['project', 'user'],
};

/**
 * 本層 key 從父層繼承到的值。
 * none＝沒有生效中的父層設了此 key；unknown＝父層快照尚未就緒（載入中／失敗／屬於別的 scope）；
 * known＝最近一個有設此 key 的生效父層與其值。
 */
export type Inherited =
  | { kind: 'none' }
  | { kind: 'unknown' }
  | { kind: 'known'; scope: PluginScope; value: unknown };

/**
 * 沿 PARENT_SCOPES 找最近一個有設 key 的父層。
 * parents 已 drill 到對照層級（巢狀欄位傳父物件，頂層欄位傳 scope 根）；undefined＝未知。
 * 該 key 在父層 scope 不生效（見 isScopeEffective）時跳過該層：那份值 Claude Code 不讀。
 * 沒有生效父層時（如 user scope）不看 parents 是否就緒，直接 none。非物件的父層值視為沒設。
 * schemaKey 供巢狀欄位以父 key 查 schema（如 attribution.sessionUrl 用 'attribution'）。
 */
export function resolveInherited(
  scope: PluginScope,
  parents: Partial<Record<PluginScope, unknown>> | undefined,
  key: string,
  schemaKey: string = key,
): Inherited {
  const schema = getFlatFieldSchema(schemaKey);
  const effective = PARENT_SCOPES[scope].filter((p) => !schema || isScopeEffective(schema, p));
  if (effective.length === 0) return { kind: 'none' };
  if (parents === undefined) return { kind: 'unknown' };
  for (const parent of effective) {
    const ps = parents[parent];
    if (ps === null || typeof ps !== 'object' || Array.isArray(ps)) continue;
    if (key in ps) return { kind: 'known', scope: parent, value: (ps as Record<string, unknown>)[key] };
  }
  return { kind: 'none' };
}

/**
 * 判斷本層 key 覆寫了哪個父層。
 * 僅當本層實際有設定值（value !== undefined）才算覆寫——與 shouldShowReset 同一口徑：
 * 本層沒值＝沒設定（不顯示 Reset 鈕），是繼承而非覆寫，不該掛 override badge。
 */
export function getOverriddenScope(
  scope: PluginScope,
  parentSettings: Partial<Record<PluginScope, unknown>> | undefined,
  key: string,
  value: unknown,
): PluginScope | undefined {
  if (value === undefined) return undefined;
  const inherited = resolveInherited(scope, parentSettings, key);
  return inherited.kind === 'known' ? inherited.scope : undefined;
}

/**
 * 選值時是否改為刪 key：只有選到 schema default 且確定沒有父層設此 key 才刪。
 * 父層有設（即便同值）或狀態未知一律寫入，避免刪掉後改吃父層值。
 * globalConfigFallback（schema 靜態旗標）的 key 一律寫入：刪掉後 Claude Code 會改吃 ~/.claude.json 的值，
 * 與備援快照是否就緒無關。
 */
export function shouldDeleteOnChoose(
  chosen: unknown,
  defaultValue: unknown,
  inherited: Inherited,
  globalConfigFallback = false,
): boolean {
  return !globalConfigFallback && defaultValue !== undefined && chosen === defaultValue && inherited.kind === 'none';
}

/** ~/.claude.json 備援值的唯讀提示；放在欄位最後，與 description 同樣式。 */
function GlobalConfigFallbackHint({ valueLabel }: { valueLabel: string }): React.ReactElement {
  const { t } = useI18n();
  return <p className="settings-field-description">{t('settings.common.globalConfigFallback', { value: valueLabel })}</p>;
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

export function OverrideBadge({ scope }: OverrideBadgeProps): React.ReactElement {
  const { t } = useI18n();
  const scopeLabel = t(`settings.scope.${scope}` as Parameters<typeof t>[0]);
  const label = t('settings.common.overrides', { scope: scopeLabel });
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
  inherited: Inherited;
  disabled?: boolean;
  /** schema 靜態旗標：選到預設值也寫入、不刪 key（見 shouldDeleteOnChoose）。 */
  globalConfigFallback?: boolean;
  /**
   * ~/.claude.json 的備援值；呼叫端只在「本層未設、inherited 為 none、快照就緒、值合法」時傳入。
   * 有值時顯示值取它並顯示唯讀提示。
   */
  fallbackValue?: boolean;
  onSave: (key: string, value: unknown) => Promise<void | boolean>;
  onDelete: (key: string) => Promise<void | boolean>;
}

export function BooleanToggle({ label, description, value, settingKey, defaultValue, overriddenScope, inherited, disabled = false, globalConfigFallback = false, fallbackValue, onSave, onDelete }: BooleanToggleProps): React.ReactElement {
  const { saving, withSave } = useSettingSave();
  const { t } = useI18n();
  const inheritedValue = inherited.kind === 'known' && typeof inherited.value === 'boolean' ? inherited.value : undefined;
  const checked = value ?? inheritedValue ?? fallbackValue ?? defaultValue ?? false;
  const resetLabel = t('settings.common.reset');
  const isDisabled = disabled || saving;

  const handleChange = (): void => {
    if (isDisabled) return;
    const newVal = !checked;
    void withSave(() =>
      shouldDeleteOnChoose(newVal, defaultValue, inherited, globalConfigFallback)
        ? onDelete(settingKey)
        : onSave(settingKey, newVal),
    );
  };

  const handleReset = (): void => {
    if (isDisabled) return;
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
            disabled={isDisabled}
          />
          <SettingLabelText label={label} settingKey={settingKey} defaultValue={defaultValue} overriddenScope={overriddenScope} />
        </label>
        {shouldShowReset(value) && (
          <button
            className="btn btn-secondary"
            onClick={() => void handleReset()}
            disabled={isDisabled}
            type="button"
            aria-label={`${resetLabel} ${label}`}
          >
            {resetLabel}
          </button>
        )}
      </div>
      {description && <p className="settings-field-description">{description}</p>}
      {fallbackValue !== undefined && (
        <GlobalConfigFallbackHint valueLabel={t(fallbackValue ? 'settings.common.on' : 'settings.common.off')} />
      )}
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
  inherited: Inherited;
  disabled?: boolean;
  /** schema 靜態旗標：選到預設值也寫入、不刪 key（見 shouldDeleteOnChoose）。 */
  globalConfigFallback?: boolean;
  /**
   * ~/.claude.json 的備援值；呼叫端只在「本層未設、inherited 為 none、快照就緒、值在 knownValues 內」時傳入。
   * 有值時 '' 選項文字改為備援值並顯示唯讀提示（selectValue 不變）。
   */
  fallbackValue?: string;
  onSave: (key: string, value: unknown) => Promise<void | boolean>;
  onDelete: (key: string) => Promise<void | boolean>;
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
  inherited,
  disabled = false,
  globalConfigFallback = false,
  fallbackValue,
  onSave,
  onDelete,
}: EnumDropdownProps): React.ReactElement {
  const { saving, withSave } = useSettingSave();
  const { t } = useI18n();
  const resetLabel = t('settings.common.reset');
  const isDisabled = disabled || saving;

  const isUnknown = value !== undefined && !knownValues.includes(value);
  const selectValue = isUnknown ? '__unknown__' : (value ?? '');
  const inheritedLabel = inherited.kind === 'known'
    ? t('settings.common.inheritedFrom', {
      scope: t(`settings.scope.${inherited.scope}` as Parameters<typeof t>[0]),
      value: typeof inherited.value === 'string' && Object.prototype.hasOwnProperty.call(knownLabels, inherited.value)
        ? knownLabels[inherited.value]
        : String(inherited.value),
    })
    : undefined;
  const fallbackValueLabel = fallbackValue !== undefined ? (knownLabels[fallbackValue] ?? fallbackValue) : undefined;
  const fallbackLabel = fallbackValueLabel !== undefined
    ? t('settings.common.globalConfigFallback', { value: fallbackValueLabel })
    : undefined;

  const handleChange = (val: string): void => {
    if (val === '__unknown__' || isDisabled) return;
    void withSave(async () => {
      if (val === '' || shouldDeleteOnChoose(val, defaultValue, inherited, globalConfigFallback)) {
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
          disabled={isDisabled}
        >
          <option value="">{inheritedLabel ?? fallbackLabel ?? notSetLabel}</option>
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
            disabled={isDisabled}
            type="button"
            aria-label={`${resetLabel} ${label}`}
          >
            {resetLabel}
          </button>
        )}
      </div>
      {fallbackValueLabel !== undefined && <GlobalConfigFallbackHint valueLabel={fallbackValueLabel} />}
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
  inherited: Inherited;
  scope: PluginScope;
  disabled?: boolean;
  onSave: (key: string, value: unknown) => Promise<void | boolean>;
  onDelete: (key: string) => Promise<void | boolean>;
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
  inherited,
  scope,
  disabled = false,
  onSave,
  onDelete,
}: TextSettingProps): React.ReactElement {
  const { saving, withSave } = useSettingSave();
  const { t } = useI18n();
  const [inputValue, setInputValue] = useScopedInputValue(scope, value ?? '');
  const resetLabel = t('settings.common.reset');
  const isDisabled = disabled || saving;

  const handleSave = (): void => {
    if (isDisabled) return;
    void withSave(async () => {
      const trimmed = inputValue.trim();
      if (!trimmed || shouldDeleteOnChoose(trimmed, defaultValue, inherited)) {
        const deleted = await onDelete(settingKey);
        if (deleted !== false) {
          setInputValue('');
        }
      } else {
        await onSave(settingKey, trimmed);
      }
    });
  };

  const handleClear = (): void => {
    if (isDisabled) return;
    void withSave(async () => {
      const deleted = await onDelete(settingKey);
      if (deleted !== false) {
        setInputValue('');
      }
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
          disabled={isDisabled}
        />
        <ResetOrClearButton
          value={value}
          resetLabel={resetLabel}
          label={label}
          disabled={isDisabled}
          onClick={() => void handleClear()}
        />
        <button
          className="btn btn-primary"
          onClick={() => void handleSave()}
          disabled={isDisabled}
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
  disabled?: boolean;
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
  disabled = false,
  onSave,
}: TagInputProps): React.ReactElement {
  const { saving, withSave } = useSettingSave();
  const [inputValue, setInputValue] = useScopedInputValue(scope, '');
  const [error, setError] = useState('');
  const isDisabled = disabled || saving;
  useEffect(() => {
    setError('');
  }, [scope]);

  const handleAdd = (): void => {
    const trimmed = inputValue.trim();
    if (!trimmed || isDisabled) return;
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
    if (isDisabled) return;
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
        disabled={isDisabled}
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
          disabled={isDisabled}
        />
        <button
          className="btn btn-primary"
          onClick={() => void handleAdd()}
          disabled={isDisabled || !inputValue.trim()}
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
  inherited: Inherited;
  disabled?: boolean;
  onSave: (key: string, value: unknown) => Promise<void | boolean>;
  onDelete: (key: string) => Promise<void | boolean>;
}

function isStepAligned(value: number, step: number, base: number): boolean {
  const quotient = (value - base) / step;
  return Math.abs(quotient - Math.round(quotient)) < 1e-9;
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
  inherited,
  disabled = false,
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
  const isDisabled = disabled || saving;

  const parsedValue = Number(inputValue);
  const isEmpty = inputValue === '';
  const belowMin = !isEmpty && !isNaN(parsedValue) && min !== undefined && parsedValue < min;
  const aboveMax = !isEmpty && !isNaN(parsedValue) && max !== undefined && parsedValue > max;
  const stepMismatch = !isEmpty && !isNaN(parsedValue) && step !== undefined && !isStepAligned(parsedValue, step, min ?? 0);
  const validationError = belowMin
    ? (minError ?? `Must be at least ${min}`)
    : aboveMax
      ? (maxError ?? `Must be at most ${max}`)
      : stepMismatch
        ? `Must match step ${step}`
      : null;
  const saveDisabled = isDisabled || belowMin || aboveMax || stepMismatch || (!isEmpty && isNaN(parsedValue));

  const handleSave = (): void => {
    if (saveDisabled) return;
    void withSave(async () => {
      if (isEmpty || shouldDeleteOnChoose(parsedValue, defaultValue, inherited)) {
        const deleted = await onDelete(settingKey);
        if (deleted !== false) {
          setInputValue('');
        }
      } else {
        await onSave(settingKey, parsedValue);
      }
    });
  };

  const handleClear = (): void => {
    void withSave(async () => {
      const deleted = await onDelete(settingKey);
      if (deleted !== false) {
        setInputValue('');
      }
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
          disabled={isDisabled}
        />
        <ResetOrClearButton
          value={value}
          resetLabel={resetLabel}
          label={label}
          disabled={isDisabled}
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
