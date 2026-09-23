import React, { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useSettingSave } from './hooks/useSettingSave';
import type { PluginScope } from '../../../shared/types';
import { getKnownEnvVar, getKnownEnvVarNames, getKnownEnvVarsByValueType } from '../../../shared/known-env-vars';
import type { KnownEnvVar, EnvVarValueType } from '../../../shared/known-env-vars';
import { BooleanToggle, TextSetting, NumberSetting, resolveInherited, type Inherited } from './components/SettingControls';
import { ObjectSetting } from './components/ObjectSetting';
import { SchemaSection, drillParents, type ParentSettings, type SectionProps } from './components/SchemaSection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENSITIVE_KEY_RE = /_SECRET$|_TOKEN$|_KEY$|_PASSWORD$|_CREDENTIAL$|^SECRET$|^TOKEN$|^PASSWORD$/i;
type EnvEntryValidationResult = 'ok' | 'empty' | 'invalid' | 'duplicate';

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

/**
 * 已知 env 變數從父層繼承到的值：比對單位是 env[varName]，schema 以 'env' 查生效 scope。
 * 父層值是字串，依控制項型別轉值（布林：'1'／'true' 為 true，與本層取值同規則；數字：Number）。
 */
function resolveEnvInherited(
  scope: PluginScope,
  parentSettings: ParentSettings | undefined,
  knownVar: KnownEnvVar,
): Inherited {
  const inherited = resolveInherited(scope, drillParents(parentSettings, 'env'), knownVar.name, 'env');
  if (inherited.kind !== 'known') return inherited;
  const raw = inherited.value;
  if (knownVar.valueType === Boolean) return { ...inherited, value: raw === '1' || raw === 'true' };
  if (knownVar.valueType === Number) return { ...inherited, value: Number(raw) };
  return inherited;
}

/** env 變數寫入只帶該變數名的一格（F1→A）；兩個函式都取自同一次 render，scope 綁在發出當下 */
type EnvNestedWriters = Pick<SectionProps, 'onSaveNested' | 'onDeleteNested'>;

/** 包住一次寫入並回報是否成功（控制項據此決定要不要清草稿） */
type EnvWriteRunner = (write: () => Promise<void>) => Promise<boolean>;

function createEnvWriters({ onSaveNested, onDeleteNested }: EnvNestedWriters, run: EnvWriteRunner) {
  return {
    save: (key: string, value: unknown): Promise<boolean> =>
      run(() => onSaveNested('env', key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))),
    // 先寫新名再刪舊名：中間態是新舊並存；新名失敗就不刪舊名
    rename: (oldKey: string, newKey: string, value: string): Promise<boolean> =>
      run(async () => {
        await onSaveNested('env', newKey, value);
        await onDeleteNested('env', oldKey);
      }),
    remove: (key: string): Promise<boolean> => run(() => onDeleteNested('env', key)),
  };
}

/** withSave 版的 runner：成功才回 true（失敗已由 withSave 顯示 toast） */
function useEnvWriteRunner(): { saving: boolean; run: EnvWriteRunner } {
  const { saving, withSave } = useSettingSave();
  const run: EnvWriteRunner = async (write) => {
    let saved = false;
    await withSave(async () => {
      await write();
      saved = true;
    });
    return saved;
  };
  return { saving, run };
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

interface EnvObjectEditorProps extends EnvNestedWriters {
  scope: PluginScope;
  parentSettings: ParentSettings | undefined;
  currentEnv: Record<string, string>;
}

function EnvObjectEditor({ scope, parentSettings, currentEnv, onSaveNested, onDeleteNested }: EnvObjectEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, run } = useEnvWriteRunner();
  const knownVarsByType = useMemo(() => getKnownEnvVarsByValueType(), []);
  const knownNames = useMemo(() => new Set(getKnownEnvVarNames()), []);

  const customEntries = useMemo(
    () => Object.entries(currentEnv).filter(([key]) => !knownNames.has(key)),
    [currentEnv, knownNames],
  );

  const { save: envOnSave, rename: envOnRename, remove: envOnDelete } = createEnvWriters({ onSaveNested, onDeleteNested }, run);

  const envOnSaveVoid = async (key: string, value: unknown): Promise<void> => {
    await envOnSave(key, value);
  };

  const envOnDeleteVoid = async (key: string): Promise<void> => {
    await envOnDelete(key);
  };

  const handleAdd = (key: string, value: string): Promise<boolean> => envOnSave(key, value);

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
        inherited={resolveEnvInherited(scope, parentSettings, knownVar)}
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
        inherited={resolveEnvInherited(scope, parentSettings, knownVar)}
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
        inherited={resolveEnvInherited(scope, parentSettings, knownVar)}
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

export function EnvSection({ scope, settings, parentSettings, onSave, onDelete, onSaveNested, onDeleteNested }: SectionProps): React.ReactElement {
  const currentEnv = useMemo<Record<string, string>>(
    () => (settings.env as Record<string, string>) ?? {},
    [settings.env],
  );

  return (
    <SchemaSection
      section="env"
      scope={scope}
      settings={settings}
      parentSettings={parentSettings}
      onSave={onSave}
      onDelete={onDelete}
      onSaveNested={onSaveNested}
      onDeleteNested={onDeleteNested}
      renderCustom={(key) => {
        if (key !== 'env') return null;
        return (
          <EnvObjectEditor
            scope={scope}
            parentSettings={parentSettings}
            currentEnv={currentEnv}
            onSaveNested={onSaveNested}
            onDeleteNested={onDeleteNested}
          />
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// EnvFieldRenderer — for use in search results
// ---------------------------------------------------------------------------

export interface EnvFieldRendererProps extends EnvNestedWriters {
  envKey: string;
  currentEnv: Record<string, string>;
  scope: PluginScope;
  parentSettings: ParentSettings | undefined;
  saving?: boolean;
}

/** 搜尋列與已自訂的已知變數列不上鎖：錯誤直接拋回控制項 */
const runUnlocked: EnvWriteRunner = async (write) => {
  await write();
  return true;
};

export function EnvFieldRenderer({
  envKey,
  currentEnv,
  scope,
  parentSettings,
  onSaveNested,
  onDeleteNested,
  saving = false,
}: EnvFieldRendererProps): React.ReactElement | null {
  const { t } = useI18n();
  const knownVar = getKnownEnvVar(envKey);
  const { save: envOnSave, remove: envOnDelete } = createEnvWriters({ onSaveNested, onDeleteNested }, runUnlocked);

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
  const inherited = resolveEnvInherited(scope, parentSettings, knownVar);

  if (knownVar.valueType === Boolean) {
    const boolVal = envVal !== undefined ? (envVal === '1' || envVal === 'true') : undefined;
    const defaultBool = knownVar.default !== undefined
      ? (knownVar.default === '1' || knownVar.default === 'true')
      : undefined;
    return (
      <BooleanToggle
        inherited={inherited}
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
        inherited={inherited}
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
      inherited={inherited}
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

interface CustomizedEnvEditorProps extends EnvNestedWriters {
  scope: PluginScope;
  parentSettings: ParentSettings | undefined;
  currentEnv: Record<string, string>;
}

export function CustomizedEnvEditor({ scope, parentSettings, currentEnv, onSaveNested, onDeleteNested }: CustomizedEnvEditorProps): React.ReactElement {
  const { saving, run } = useEnvWriteRunner();
  const { save: envOnSave, rename: envOnRename, remove: envOnDelete } = createEnvWriters({ onSaveNested, onDeleteNested }, run);

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
            parentSettings={parentSettings}
            onSaveNested={onSaveNested}
            onDeleteNested={onDeleteNested}
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
