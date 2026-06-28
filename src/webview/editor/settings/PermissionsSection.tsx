import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useSettingSave } from './hooks/useSettingSave';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { BooleanToggle, EnumDropdown, TagInput } from './components/SettingControls';
import { SettingsSectionWrapper } from './components/SettingsSectionWrapper';
import { ObjectFieldEditor } from './components/ObjectFieldEditor';

// ---------------------------------------------------------------------------
// Constants（internal only — defaultMode 已移至 schema general section）
// ---------------------------------------------------------------------------

type PermissionsList = 'allow' | 'deny' | 'ask';
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
  onAdd: (rule: string) => void;
  disabled?: boolean;
}

function AddRuleForm({ listRules, onAdd, disabled }: AddRuleFormProps): React.ReactElement {
  const { t } = useI18n();
  const [draft, setDraft] = useState<PermissionRuleDraft>(() => createPermissionRuleDraft());
  const [error, setError] = useState('');

  const handleAdd = (): void => {
    const submission = buildRuleSubmission(draft, listRules);
    if (submission.kind === 'empty') {
      return;
    }
    if (submission.kind === 'duplicate') {
      setError(t('settings.permissions.duplicateRule'));
      return;
    }
    setError('');
    onAdd(submission.rule);
    setDraft(changeRuleFormat(draft.format));
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleAdd();
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
        onClick={handleAdd}
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
  onAdd: (rule: string) => void;
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

interface PermissionsSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function PermissionsSection({
  scope,
  settings,
  onSave,
  onDelete,
}: PermissionsSectionProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();

  const [activeList, setActiveList] = useState<PermissionsList>('allow');
  // Reset sub-tab when scope changes
  useEffect(() => {
    setActiveList('allow');
  }, [scope]);

  const perms = settings.permissions ?? {};
  const additionalDirs: string[] = perms.additionalDirectories ?? [];
  const enabledMcpjsonServers: string[] = settings.enabledMcpjsonServers ?? [];
  const disabledMcpjsonServers: string[] = settings.disabledMcpjsonServers ?? [];
  const listRules: string[] = (perms[activeList] ?? []) as string[];

  const updatePermissions = (updatedPerms: ClaudeSettings['permissions']): void => {
    void withSave(() => onSave('permissions', updatedPerms));
  };

  const handleAddRule = (rule: string): void => {
    const updated = { ...perms, [activeList]: [...listRules, rule] };
    updatePermissions(updated);
  };

  const handleDeleteRule = (rule: string): void => {
    const updated = { ...perms, [activeList]: listRules.filter((r) => r !== rule) };
    updatePermissions(updated);
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
        onAdd={(rule) => void handleAddRule(rule)}
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
        onSave={async (_key, value) => {
          updatePermissions({ ...perms, additionalDirectories: value as string[] });
        }}
      />

      {/* enableAllProjectMcpServers */}
      <BooleanToggle
        label={t('settings.permissions.enableAllProjectMcpServers.label')}
        description={t('settings.permissions.enableAllProjectMcpServers.description')}
        value={settings.enableAllProjectMcpServers}
        settingKey="enableAllProjectMcpServers"
        defaultValue={false}
        onSave={onSave}
        onDelete={onDelete}
      />

      <EnumDropdown
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
          updatePermissions({ ...perms, disableAutoMode: value as 'disable' });
        }}
        onDelete={async () => {
          const updated = { ...perms };
          delete (updated as Record<string, unknown>).disableAutoMode;
          updatePermissions(updated);
        }}
      />

      <EnumDropdown
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
          updatePermissions({ ...perms, disableBypassPermissionsMode: value as 'disable' });
        }}
        onDelete={async () => {
          const updated = { ...perms };
          delete (updated as Record<string, unknown>).disableBypassPermissionsMode;
          updatePermissions(updated);
        }}
      />

      <BooleanToggle
        label={t('settings.permissions.skipDangerousModePermissionPrompt.label')}
        description={t('settings.permissions.skipDangerousModePermissionPrompt.description')}
        value={settings.skipDangerousModePermissionPrompt}
        settingKey="skipDangerousModePermissionPrompt"
        defaultValue={false}
        onSave={onSave}
        onDelete={onDelete}
      />

      <BooleanToggle
        label={t('settings.permissions.useAutoModeDuringPlan.label')}
        description={t('settings.permissions.useAutoModeDuringPlan.description')}
        value={settings.useAutoModeDuringPlan}
        settingKey="useAutoModeDuringPlan"
        defaultValue={false}
        onSave={onSave}
        onDelete={onDelete}
      />

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
        onSave={async (_key, value) => {
          await onSave('enabledMcpjsonServers', value);
        }}
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
        onSave={async (_key, value) => {
          await onSave('disabledMcpjsonServers', value);
        }}
      />

      {/* allowedMcpServers */}
      <ObjectFieldEditor settingKey="allowedMcpServers" scope={scope} settings={settings} onSave={onSave} onDelete={onDelete} />

      {/* deniedMcpServers */}
      <ObjectFieldEditor settingKey="deniedMcpServers" scope={scope} settings={settings} onSave={onSave} onDelete={onDelete} />

    </SettingsSectionWrapper>
  );
}
