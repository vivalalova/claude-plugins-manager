import React, { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { TagInput } from './components/SettingControls';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_DEFAULT_MODES = [
  'ask',
  'bypassPermissions',
  'acceptEdits',
  'autoEdit',
  'plan',
  'delegate',
  'default',
  'dontAsk',
] as const;

type PermissionsList = 'allow' | 'deny' | 'ask';
type RuleFormat = 'toolName' | 'toolNameArg' | 'mcp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRule(format: RuleFormat, toolName: string, pattern: string): string {
  if (format === 'toolNameArg') return `${toolName}(${pattern})`;
  if (format === 'mcp') return pattern;
  return toolName;
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
  const [format, setFormat] = useState<RuleFormat>('toolName');
  const [toolName, setToolName] = useState('');
  const [pattern, setPattern] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (): void => {
    const rule = buildRule(format, toolName, pattern);
    if (!rule.trim()) return;

    if (listRules.includes(rule)) {
      setError(t('settings.permissions.duplicateRule'));
      return;
    }
    setError('');
    onAdd(rule);
    setToolName('');
    setPattern('');
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleAdd();
  };

  const isAddDisabled =
    disabled ||
    (format === 'toolName'
      ? !toolName.trim()
      : format === 'toolNameArg'
        ? !toolName.trim()
        : !pattern.trim());

  return (
    <div className="perm-add-form">
      <select
        className="select perm-format-select"
        value={format}
        disabled={disabled}
        onChange={(e) => {
          setFormat(e.target.value as RuleFormat);
          setError('');
          setToolName('');
          setPattern('');
        }}
      >
        <option value="toolName">{t('settings.permissions.format.toolName')}</option>
        <option value="toolNameArg">{t('settings.permissions.format.toolNameArg')}</option>
        <option value="mcp">{t('settings.permissions.format.mcp')}</option>
      </select>

      {format === 'toolName' && (
        <input
          className="input"
          type="text"
          value={toolName}
          onChange={(e) => { setToolName(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder={t('settings.permissions.placeholder.toolName')}
          disabled={disabled}
        />
      )}

      {format === 'toolNameArg' && (
        <>
          <input
            className="input"
            type="text"
            value={toolName}
            onChange={(e) => { setToolName(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder={t('settings.permissions.placeholder.toolName')}
            style={{ flex: 1 }}
            disabled={disabled}
          />
          <input
            className="input"
            type="text"
            value={pattern}
            onChange={(e) => { setPattern(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder={t('settings.permissions.placeholder.pattern')}
            style={{ flex: 1 }}
            disabled={disabled}
          />
        </>
      )}

      {format === 'mcp' && (
        <input
          className="input"
          type="text"
          value={pattern}
          onChange={(e) => { setPattern(e.target.value); setError(''); }}
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
}

export function PermissionsSection({
  scope,
  settings,
  onSave,
}: PermissionsSectionProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [activeList, setActiveList] = useState<PermissionsList>('allow');
  const [saving, setSaving] = useState(false);
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

  const updatePermissions = async (updatedPerms: ClaudeSettings['permissions']): Promise<void> => {
    setSaving(true);
    try {
      await onSave('permissions', updatedPerms);
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async (rule: string): Promise<void> => {
    const updated = {
      ...perms,
      [activeList]: [...listRules, rule],
    };
    await updatePermissions(updated);
  };

  const handleDeleteRule = async (rule: string): Promise<void> => {
    const updated = {
      ...perms,
      [activeList]: listRules.filter((r) => r !== rule),
    };
    await updatePermissions(updated);
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

  const handleBypassConfirm = async (): Promise<void> => {
    setPendingBypassMode(false);
    await updatePermissions({ ...perms, defaultMode: 'bypassPermissions' });
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
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.permissions')}</h3>

      {/* defaultMode */}
      <div className="perm-defaultmode-row">
        <label className="settings-label">{t('settings.permissions.defaultMode')}</label>
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
          await updatePermissions({ ...perms, additionalDirectories: value as string[] });
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
    </div>
  );
}
