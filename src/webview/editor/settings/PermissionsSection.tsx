import React, { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useI18n } from '../../i18n/I18nContext';
import { useSettingSave } from './hooks/useSettingSave';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { SettingLabelText, TagInput, TextSetting } from './components/SettingControls';
import { SettingsSectionWrapper } from './components/SettingsSectionWrapper';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_DEFAULT_MODES = [
  'default',
  'acceptEdits',
  'plan',
  'dontAsk',
  'auto',
  'bypassPermissions',
  'delegate',
] as const;

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
  const [pendingBypassMode, setPendingBypassMode] = useState(false);

  // Reset sub-tab when scope changes
  useEffect(() => {
    setActiveList('allow');
  }, [scope]);

  const perms = settings.permissions ?? {};
  const additionalDirs: string[] = perms.additionalDirectories ?? [];
  const enabledMcpjsonServers: string[] = settings.enabledMcpjsonServers ?? [];
  const disabledMcpjsonServers: string[] = settings.disabledMcpjsonServers ?? [];
  const currentMode = perms.defaultMode ?? '';
  const isUnknownMode = currentMode !== '' && !KNOWN_DEFAULT_MODES.includes(currentMode as typeof KNOWN_DEFAULT_MODES[number]);

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

  const handleDefaultModeChange = (mode: string): void => {
    if (mode === '__unknown__') return;
    if (mode === 'bypassPermissions') {
      setPendingBypassMode(true);
      return;
    }
    if (mode === '') {
      // Remove the key entirely instead of writing empty string
      const rest = Object.fromEntries(
        Object.entries(perms).filter(([k]) => k !== 'defaultMode')
      ) as typeof perms;
      void updatePermissions(rest);
      return;
    }
    void updatePermissions({ ...perms, defaultMode: mode });
  };

  const handleBypassConfirm = (): void => {
    setPendingBypassMode(false);
    updatePermissions({ ...perms, defaultMode: 'bypassPermissions' });
  };

  const handleBypassCancel = (): void => {
    setPendingBypassMode(false);
  };

  const listTabs: { id: PermissionsList; label: string }[] = [
    { id: 'allow', label: t('settings.permissions.allow') },
    { id: 'deny', label: t('settings.permissions.deny') },
    { id: 'ask', label: t('settings.permissions.ask') },
  ];

  return (
    <SettingsSectionWrapper>
      {/* defaultMode */}
      <div className="perm-defaultmode-row">
        <label className="settings-label">
          <SettingLabelText label={t('settings.permissions.defaultMode')} settingKey="defaultMode" />
        </label>
        <select
          className="select"
          value={isUnknownMode ? '__unknown__' : currentMode}
          onChange={(e) => handleDefaultModeChange(e.target.value)}
          disabled={saving}
        >
          <option value="">— not set —</option>
          {isUnknownMode && (
            <option value="__unknown__" disabled>
              {t('settings.permissions.unknownMode').replace('{value}', currentMode)}
            </option>
          )}
          {KNOWN_DEFAULT_MODES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

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

      {/* Rule list */}
      <div className="perm-rule-list">
        {listRules.length === 0 ? (
          <span className="perm-empty">{t('settings.permissions.emptyList')}</span>
        ) : (
          listRules.map((rule) => (
            <RuleTag
              key={rule}
              rule={rule}
              onDelete={() => void handleDeleteRule(rule)}
              disabled={saving}
            />
          ))
        )}
      </div>

      {/* Add rule form */}
      <AddRuleForm
        listRules={listRules}
        onAdd={(rule) => void handleAddRule(rule)}
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
        onSave={async (_key, value) => {
          updatePermissions({ ...perms, additionalDirectories: value as string[] });
        }}
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
      <TextSetting
        label={t('settings.permissions.allowedMcpServers.label')}
        description={t('settings.permissions.allowedMcpServers.description')}
        value={settings.allowedMcpServers ? JSON.stringify(settings.allowedMcpServers) : undefined}
        placeholder={t('settings.permissions.allowedMcpServers.placeholder')}
        saveLabel={t('settings.permissions.allowedMcpServers.save')}
        clearLabel={t('settings.permissions.allowedMcpServers.clear')}
        settingKey="allowedMcpServers"
        scope={scope}
        onSave={async (_key, value) => onSave('allowedMcpServers', JSON.parse(value as string))}
        onDelete={async () => onDelete('allowedMcpServers')}
      />

      {/* deniedMcpServers */}
      <TextSetting
        label={t('settings.permissions.deniedMcpServers.label')}
        description={t('settings.permissions.deniedMcpServers.description')}
        value={settings.deniedMcpServers ? JSON.stringify(settings.deniedMcpServers) : undefined}
        placeholder={t('settings.permissions.deniedMcpServers.placeholder')}
        saveLabel={t('settings.permissions.deniedMcpServers.save')}
        clearLabel={t('settings.permissions.deniedMcpServers.clear')}
        settingKey="deniedMcpServers"
        scope={scope}
        onSave={async (_key, value) => onSave('deniedMcpServers', JSON.parse(value as string))}
        onDelete={async () => onDelete('deniedMcpServers')}
      />

      {/* bypassPermissions confirm */}
      {pendingBypassMode && (
        <ConfirmDialog
          title={t('settings.permissions.bypassConfirmTitle')}
          message={t('settings.permissions.bypassConfirmMessage')}
          danger
          onConfirm={() => void handleBypassConfirm()}
          onCancel={handleBypassCancel}
        />
      )}
    </SettingsSectionWrapper>
  );
}
