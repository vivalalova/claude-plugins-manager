import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useSettingSave } from './hooks/useSettingSave';
import { BooleanToggle, EnumDropdown, TagInput } from './components/SettingControls';
import { SettingsSectionWrapper } from './components/SettingsSectionWrapper';
import { ObjectFieldEditor } from './components/ObjectFieldEditor';
import { getSchemaFieldBindings, type SectionProps } from './components/SchemaSection';
import { getSchemaDefault } from '../../../shared/claude-settings-schema';
import type { PermissionsListKey } from '../../../shared/nestedSettings';

// ---------------------------------------------------------------------------
// Constants（internal only — defaultMode 已移至 schema general section）
// ---------------------------------------------------------------------------

type PermissionsList = 'allow' | 'deny' | 'ask';
type DisableModeKey = 'disableAutoMode' | 'disableBypassPermissionsMode';
type RuleFormat = 'toolName' | 'toolNameArg' | 'mcp';
interface PermissionRuleDraft {
  format: RuleFormat;
  toolName: string;
  pattern: string;
}
type RuleSubmission =
  | { kind: 'empty' }
  | { kind: 'duplicate'; rule: string }
  | { kind: 'ready'; rule: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRuleDraft(draft: PermissionRuleDraft): PermissionRuleDraft {
  return {
    ...draft,
    toolName: draft.toolName.trim(),
    pattern: draft.pattern.trim(),
  };
}

function buildRule(format: RuleFormat, toolName: string, pattern: string): string {
  if (format === 'toolNameArg') return `${toolName}(${pattern})`;
  if (format === 'mcp') return pattern;
  return toolName;
}

function createPermissionRuleDraft(format: RuleFormat = 'toolName'): PermissionRuleDraft {
  return {
    format,
    toolName: '',
    pattern: '',
  };
}

function changeRuleFormat(format: RuleFormat): PermissionRuleDraft {
  return createPermissionRuleDraft(format);
}

function updateRuleDraft(
  draft: PermissionRuleDraft,
  patch: Partial<Pick<PermissionRuleDraft, 'toolName' | 'pattern'>>,
): PermissionRuleDraft {
  return {
    ...draft,
    ...patch,
  };
}

function hasRequiredRuleParts(draft: PermissionRuleDraft): boolean {
  const normalizedDraft = normalizeRuleDraft(draft);
  if (normalizedDraft.format === 'mcp') {
    return normalizedDraft.pattern.length > 0;
  }
  if (normalizedDraft.format === 'toolNameArg') {
    return normalizedDraft.toolName.length > 0 && normalizedDraft.pattern.length > 0;
  }
  return normalizedDraft.toolName.length > 0;
}

function buildRuleSubmission(draft: PermissionRuleDraft, existingRules: string[]): RuleSubmission {
  const normalizedDraft = normalizeRuleDraft(draft);
  if (!hasRequiredRuleParts(normalizedDraft)) {
    return { kind: 'empty' };
  }
  const rule = buildRule(
    normalizedDraft.format,
    normalizedDraft.toolName,
    normalizedDraft.pattern,
  );
  if (!rule) {
    return { kind: 'empty' };
  }
  if (existingRules.includes(rule)) {
    return { kind: 'duplicate', rule };
  }
  return { kind: 'ready', rule };
}

function canSubmitRule(draft: PermissionRuleDraft, disabled = false): boolean {
  if (disabled) {
    return false;
  }
  return hasRequiredRuleParts(draft);
}

// ---------------------------------------------------------------------------
// RuleTag
// ---------------------------------------------------------------------------

interface RuleTagProps {
  rule: string;
  onDelete: () => void;
  disabled?: boolean;
}

function RuleTag({ rule, onDelete, disabled }: RuleTagProps): React.ReactElement {
  return (
    <span className="perm-rule-tag">
      {rule}
      <button
        className="perm-rule-tag-delete"
        onClick={onDelete}
        aria-label={`Remove rule ${rule}`}
        type="button"
        disabled={disabled}
      >
        ×
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// AddRuleForm
// ---------------------------------------------------------------------------

interface AddRuleFormProps {
  listRules: string[];
  /** 寫入成功才 resolve true，失敗 resolve undefined（保留輸入）。 */
  onAdd: (rule: string) => Promise<true | undefined>;
  disabled?: boolean;
}

function AddRuleForm({ listRules, onAdd, disabled }: AddRuleFormProps): React.ReactElement {
  const { t } = useI18n();
  const [draft, setDraft] = useState<PermissionRuleDraft>(() => createPermissionRuleDraft());
  const [error, setError] = useState('');

  const handleAdd = async (): Promise<void> => {
    const submission = buildRuleSubmission(draft, listRules);
    if (submission.kind === 'empty') {
      return;
    }
    if (submission.kind === 'duplicate') {
      setError(t('settings.permissions.duplicateRule'));
      return;
    }
    setError('');
    if (await onAdd(submission.rule)) setDraft(changeRuleFormat(draft.format));
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') void handleAdd();
  };

  const isAddDisabled =
    !canSubmitRule(draft, disabled);

  return (
    <div className="perm-add-form">
      <select
        className="select perm-format-select"
        value={draft.format}
        disabled={disabled}
        onChange={(e) => {
          setDraft(changeRuleFormat(e.target.value as RuleFormat));
          setError('');
        }}
      >
        <option value="toolName">{t('settings.permissions.format.toolName')}</option>
        <option value="toolNameArg">{t('settings.permissions.format.toolNameArg')}</option>
        <option value="mcp">{t('settings.permissions.format.mcp')}</option>
      </select>

      {draft.format === 'toolName' && (
        <input
          className="input"
          type="text"
          value={draft.toolName}
          onChange={(e) => { setDraft(updateRuleDraft(draft, { toolName: e.target.value })); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder={t('settings.permissions.placeholder.toolName')}
          disabled={disabled}
        />
      )}

      {draft.format === 'toolNameArg' && (
        <>
          <input
            className="input"
            type="text"
            value={draft.toolName}
            onChange={(e) => { setDraft(updateRuleDraft(draft, { toolName: e.target.value })); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder={t('settings.permissions.placeholder.toolName')}
            style={{ flex: 1 }}
            disabled={disabled}
          />
          <input
            className="input"
            type="text"
            value={draft.pattern}
            onChange={(e) => { setDraft(updateRuleDraft(draft, { pattern: e.target.value })); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder={t('settings.permissions.placeholder.pattern')}
            style={{ flex: 1 }}
            disabled={disabled}
          />
        </>
      )}

      {draft.format === 'mcp' && (
        <input
          className="input"
          type="text"
          value={draft.pattern}
          onChange={(e) => { setDraft(updateRuleDraft(draft, { pattern: e.target.value })); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder={t('settings.permissions.placeholder.mcp')}
          style={{ flex: 1 }}
          disabled={disabled}
        />
      )}

      <button
        className="btn btn-primary"
        onClick={() => void handleAdd()}
        disabled={isAddDisabled}
        type="button"
      >
        {t('settings.permissions.addRule')}
      </button>

      {error && <span className="perm-add-error">{error}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PermissionRuleListEditor — single-list (allow/deny/ask) rule editor atom
// ---------------------------------------------------------------------------

interface PermissionRuleListEditorProps {
  /** Optional heading rendered above the rule list. Omit when the parent renders its own selector. */
  title?: string;
  rules: string[];
  onAdd: (rule: string) => Promise<true | undefined>;
  onDelete: (rule: string) => void;
  disabled?: boolean;
}

export function PermissionRuleListEditor({
  title,
  rules,
  onAdd,
  onDelete,
  disabled,
}: PermissionRuleListEditorProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="perm-rule-list-editor">
      {title && <h4 className="perm-rule-list-title">{title}</h4>}
      <div className="perm-rule-list">
        {rules.length === 0 ? (
          <span className="perm-empty">{t('settings.permissions.emptyList')}</span>
        ) : (
          rules.map((rule) => (
            <RuleTag
              key={rule}
              rule={rule}
              onDelete={() => onDelete(rule)}
              disabled={disabled}
            />
          ))
        )}
      </div>
      <AddRuleForm
        listRules={rules}
        onAdd={onAdd}
        disabled={disabled}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PermissionsSection
// ---------------------------------------------------------------------------

/** permissions 四份清單只逐條加刪（擴展端在同檔佇列內讀最新檔套用），禁送整份清單 */
export interface PermissionsListWriters {
  onAddPermissionsListItem: (listKey: PermissionsListKey, item: string) => Promise<void>;
  onRemovePermissionsListItem: (listKey: PermissionsListKey, item: string) => Promise<void>;
}

export function PermissionsSection({
  scope,
  settings,
  parentSettings,
  onSave,
  onDelete,
  onSaveNested,
  onDeleteNested,
  onAddPermissionsListItem,
  onRemovePermissionsListItem,
}: SectionProps & PermissionsListWriters): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();

  const [activeList, setActiveList] = useState<PermissionsList>('allow');
  // Reset sub-tab when scope changes
  useEffect(() => {
    setActiveList('allow');
  }, [scope]);

  const perms = settings.permissions ?? {};
  const bindingProps = { scope, settings, parentSettings, onSave, onDelete, onSaveNested, onDeleteNested };
  const mcpServersBinding = getSchemaFieldBindings('enableAllProjectMcpServers', bindingProps);
  // 兩個 disable 下拉：繼承標示與覆寫徽章取自 getSchemaFieldBindings（nestedUnder 'permissions'）；
  // 寫入走本元件的 saveChild／deleteChild（共用 saving 鎖）。兩者在所有 scope 可見，拿不到即 schema 缺格。
  const disableModeBinding = (key: DisableModeKey) => {
    const binding = getSchemaFieldBindings(key, bindingProps);
    if (!binding) throw new Error(`Schema field "${key}" not visible for scope "${scope}"`);
    return binding;
  };
  const disableAutoModeBinding = disableModeBinding('disableAutoMode');
  const disableBypassBinding = disableModeBinding('disableBypassPermissionsMode');
  const additionalDirs: string[] = perms.additionalDirectories ?? [];
  const enabledMcpjsonServers: string[] = settings.enabledMcpjsonServers ?? [];
  const disabledMcpjsonServers: string[] = settings.disabledMcpjsonServers ?? [];
  const listRules: string[] = (perms[activeList] ?? []) as string[];

  // saving 鎖只擋本次掛載內的控制項；跨入口、remount 的並發由清單逐條加刪與子欄位單格寫入在擴展端佇列化解
  const saveChild = (childKey: DisableModeKey, value: unknown): void => {
    void withSave(() => onSaveNested('permissions', childKey, value));
  };

  const deleteChild = (childKey: DisableModeKey): void => {
    void withSave(() => onDeleteNested('permissions', childKey));
  };

  const handleAddRule = (rule: string): Promise<true | undefined> => {
    return withSave(async () => { await onAddPermissionsListItem(activeList, rule); return true as const; });
  };

  const handleDeleteRule = (rule: string): void => {
    void withSave(() => onRemovePermissionsListItem(activeList, rule));
  };

  const listTabs: { id: PermissionsList; label: string }[] = [
    { id: 'allow', label: t('settings.permissions.allow') },
    { id: 'deny', label: t('settings.permissions.deny') },
    { id: 'ask', label: t('settings.permissions.ask') },
  ];

  return (
    <SettingsSectionWrapper>
      {/* Sub-tabs: Allow / Deny / Ask */}
      <div className="perm-sub-tabs">
        {listTabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab${activeList === tab.id ? ' tab-active' : ''}`}
            onClick={() => setActiveList(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Rule list + add form for the active sub-tab */}
      <PermissionRuleListEditor
        rules={listRules}
        onAdd={handleAddRule}
        onDelete={(rule) => void handleDeleteRule(rule)}
        disabled={saving}
      />

      {/* additionalDirectories */}
      <TagInput
        label={t('settings.permissions.additionalDirectories.label')}
        description={t('settings.permissions.additionalDirectories.description')}
        scope={scope}
        tags={additionalDirs}
        emptyPlaceholder={t('settings.permissions.additionalDirectories.empty')}
        inputPlaceholder={t('settings.permissions.additionalDirectories.placeholder')}
        addLabel={t('settings.permissions.additionalDirectories.add')}
        duplicateError={t('settings.permissions.additionalDirectories.duplicate')}
        settingKey="additionalDirectories"
        disabled={saving}
        onAddItem={(item) => onAddPermissionsListItem('additionalDirectories', item)}
        onRemoveItem={(item) => onRemovePermissionsListItem('additionalDirectories', item)}
      />

      {/* enableAllProjectMcpServers */}
      {mcpServersBinding && (
        <BooleanToggle
          label={t('settings.permissions.enableAllProjectMcpServers.label')}
          description={t('settings.permissions.enableAllProjectMcpServers.description')}
          value={mcpServersBinding.value as boolean | undefined}
          settingKey="enableAllProjectMcpServers"
          defaultValue={getSchemaDefault<boolean>('enableAllProjectMcpServers')}
          overriddenScope={mcpServersBinding.overriddenScope}
          inherited={mcpServersBinding.inherited}
          onSave={mcpServersBinding.onSave}
          onDelete={mcpServersBinding.onDelete}
        />
      )}

      <EnumDropdown
        inherited={disableAutoModeBinding.inherited}
        overriddenScope={disableAutoModeBinding.overriddenScope}
        label={t('settings.permissions.disableAutoMode.label')}
        description={t('settings.permissions.disableAutoMode.description')}
        value={perms.disableAutoMode}
        knownValues={['disable']}
        knownLabels={{ disable: t('settings.permissions.disableAutoMode.disable') }}
        notSetLabel={t('settings.permissions.disableAutoMode.notSet')}
        unknownTemplate={t('settings.permissions.disableAutoMode.unknown')}
        settingKey="disableAutoMode"
        disabled={saving}
        onSave={async (_key, value) => {
          saveChild('disableAutoMode', value);
        }}
        onDelete={async () => {
          deleteChild('disableAutoMode');
        }}
      />

      <EnumDropdown
        inherited={disableBypassBinding.inherited}
        overriddenScope={disableBypassBinding.overriddenScope}
        label={t('settings.permissions.disableBypassPermissionsMode.label')}
        description={t('settings.permissions.disableBypassPermissionsMode.description')}
        value={perms.disableBypassPermissionsMode}
        knownValues={['disable']}
        knownLabels={{ disable: t('settings.permissions.disableBypassPermissionsMode.disable') }}
        notSetLabel={t('settings.permissions.disableBypassPermissionsMode.notSet')}
        unknownTemplate={t('settings.permissions.disableBypassPermissionsMode.unknown')}
        settingKey="disableBypassPermissionsMode"
        disabled={saving}
        onSave={async (_key, value) => {
          saveChild('disableBypassPermissionsMode', value);
        }}
        onDelete={async () => {
          deleteChild('disableBypassPermissionsMode');
        }}
      />

      {/* 以下 boolean 經 getSchemaFieldBindings 解析（nestedUnder 與 scope 可見性與 SchemaSection 同一機制），
          僅在該 key 會生效的 scope 顯示 */}
      {(['skipDangerousModePermissionPrompt', 'skipAutoPermissionPrompt', 'useAutoModeDuringPlan', 'classifyAllShell', 'blockReadsOutsideWorkingDirectories'] as const).map((key) => {
        const binding = getSchemaFieldBindings(key, bindingProps);
        if (!binding) return null;
        return (
          <BooleanToggle
            key={key}
            label={t(`settings.permissions.${key}.label`)}
            description={t(`settings.permissions.${key}.description`)}
            value={binding.value as boolean | undefined}
            settingKey={key}
            defaultValue={getSchemaDefault<boolean>(key)}
            overriddenScope={binding.overriddenScope}
            inherited={binding.inherited}
            disabled={saving}
            onSave={binding.onSave}
            onDelete={binding.onDelete}
          />
        );
      })}

      {/* enabledMcpjsonServers */}
      <TagInput
        label={t('settings.permissions.enabledMcpjsonServers.label')}
        description={t('settings.permissions.enabledMcpjsonServers.description')}
        scope={scope}
        tags={enabledMcpjsonServers}
        emptyPlaceholder={t('settings.permissions.enabledMcpjsonServers.empty')}
        inputPlaceholder={t('settings.permissions.enabledMcpjsonServers.placeholder')}
        addLabel={t('settings.permissions.enabledMcpjsonServers.add')}
        duplicateError={t('settings.permissions.enabledMcpjsonServers.duplicate')}
        settingKey="enabledMcpjsonServers"
        onAddItem={(item) => onSave('enabledMcpjsonServers', [...enabledMcpjsonServers, item])}
        onRemoveItem={(item) => onSave('enabledMcpjsonServers', enabledMcpjsonServers.filter((s) => s !== item))}
      />

      {/* disabledMcpjsonServers */}
      <TagInput
        label={t('settings.permissions.disabledMcpjsonServers.label')}
        description={t('settings.permissions.disabledMcpjsonServers.description')}
        scope={scope}
        tags={disabledMcpjsonServers}
        emptyPlaceholder={t('settings.permissions.disabledMcpjsonServers.empty')}
        inputPlaceholder={t('settings.permissions.disabledMcpjsonServers.placeholder')}
        addLabel={t('settings.permissions.disabledMcpjsonServers.add')}
        duplicateError={t('settings.permissions.disabledMcpjsonServers.duplicate')}
        settingKey="disabledMcpjsonServers"
        onAddItem={(item) => onSave('disabledMcpjsonServers', [...disabledMcpjsonServers, item])}
        onRemoveItem={(item) => onSave('disabledMcpjsonServers', disabledMcpjsonServers.filter((s) => s !== item))}
      />

      {/* allowedMcpServers */}
      <ObjectFieldEditor settingKey="allowedMcpServers" scope={scope} settings={settings} parentSettings={parentSettings} onSave={onSave} onDelete={onDelete} />

      {/* deniedMcpServers */}
      <ObjectFieldEditor settingKey="deniedMcpServers" scope={scope} settings={settings} parentSettings={parentSettings} onSave={onSave} onDelete={onDelete} />

    </SettingsSectionWrapper>
  );
}
