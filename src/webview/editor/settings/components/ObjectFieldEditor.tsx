import React from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../../shared/types';
import { getAllFlatFieldSchemas } from '../../../../shared/claude-settings-schema';
import { TextSetting } from './SettingControls';
import { AttributionEditor } from './AttributionEditor';
import { StatusLineEditor } from './StatusLineEditor';
import { SandboxEditor } from './SandboxEditor';
import { CompanyAnnouncementsEditor } from './CompanyAnnouncementsEditor';
import { SpinnerVerbsEditor, SpinnerTipsOverrideEditor } from './SpinnerEditors';
import { parseJsonSettingValue } from '../jsonSettingValidation';

// ---------------------------------------------------------------------------
// ObjectFieldEditor — single source of truth for object-typed field editors.
// Shared by AdvancedSection / DisplaySection / PermissionsSection (inline within
// their sections) and the Customized tab (inline per customized object field).
// ---------------------------------------------------------------------------

/**
 * Every schema field with `controlType === Object` except the three keys that
 * get bespoke per-tab presentation (permissions / env / hooks). Derived from the
 * schema so new object fields are picked up automatically (no drift from a hand
 * written list).
 */
const SPECIAL_OBJECT_KEYS = new Set(['permissions', 'env', 'hooks']);

export const OBJECT_EDITOR_KEYS: ReadonlySet<string> = new Set(
  Object.entries(getAllFlatFieldSchemas())
    .filter(([key, schema]) => schema.controlType === Object && !SPECIAL_OBJECT_KEYS.has(key))
    .map(([key]) => key),
);

interface ObjectFieldEditorProps {
  settingKey: string;
  scope: PluginScope;
  settings: ClaudeSettings;
  overriddenScope?: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function ObjectFieldEditor({
  settingKey,
  scope,
  settings,
  overriddenScope,
  onSave,
  onDelete,
}: ObjectFieldEditorProps): React.ReactElement | null {
  const { t } = useI18n();

  switch (settingKey) {
    case 'attribution':
      return <AttributionEditor attribution={settings.attribution} onSave={onSave} onDelete={onDelete} />;
    case 'statusLine':
      return <StatusLineEditor statusLine={settings.statusLine} onSave={onSave} onDelete={onDelete} />;
    case 'subagentStatusLine':
      return (
        <TextSetting
          label={t('settings.advanced.subagentStatusLine.label')}
          description={t('settings.advanced.subagentStatusLine.description')}
          value={settings.subagentStatusLine?.command}
          placeholder={t('settings.advanced.subagentStatusLine.command.placeholder')}
          saveLabel={t('settings.common.save')}
          clearLabel={t('settings.common.clear')}
          settingKey="subagentStatusLine"
          scope={scope}
          overriddenScope={overriddenScope}
          onSave={async (_key, value) => onSave('subagentStatusLine', { type: 'command', command: value as string })}
          onDelete={async () => onDelete('subagentStatusLine')}
        />
      );
    case 'fileSuggestion':
      return (
        <TextSetting
          label={t('settings.advanced.fileSuggestion.label')}
          description={t('settings.advanced.fileSuggestion.description')}
          value={settings.fileSuggestion?.command}
          placeholder={t('settings.advanced.fileSuggestion.command.placeholder')}
          saveLabel={t('settings.common.save')}
          clearLabel={t('settings.common.clear')}
          settingKey="fileSuggestion"
          scope={scope}
          overriddenScope={overriddenScope}
          onSave={async (_key, value) => onSave('fileSuggestion', { type: 'command', command: value as string })}
          onDelete={async () => onDelete('fileSuggestion')}
        />
      );
    case 'sandbox':
      return <SandboxEditor sandbox={settings.sandbox} onSave={onSave} onDelete={onDelete} />;
    case 'companyAnnouncements':
      return <CompanyAnnouncementsEditor scope={scope} announcements={settings.companyAnnouncements ?? []} onSave={onSave} />;
    case 'modelOverrides':
      return (
        <TextSetting
          label={t('settings.advanced.modelOverrides.label')}
          description={t('settings.advanced.modelOverrides.description')}
          value={settings.modelOverrides ? JSON.stringify(settings.modelOverrides) : undefined}
          placeholder={t('settings.advanced.modelOverrides.placeholder')}
          saveLabel={t('settings.advanced.modelOverrides.save')}
          clearLabel={t('settings.advanced.modelOverrides.clear')}
          settingKey="modelOverrides"
          scope={scope}
          overriddenScope={overriddenScope}
          onSave={async (_key, value) => onSave('modelOverrides', parseJsonSettingValue('modelOverrides', value as string))}
          onDelete={async () => onDelete('modelOverrides')}
        />
      );
    case 'skillOverrides':
      return (
        <TextSetting
          label={t('settings.advanced.skillOverrides.label')}
          description={t('settings.advanced.skillOverrides.description')}
          value={settings.skillOverrides ? JSON.stringify(settings.skillOverrides) : undefined}
          placeholder={t('settings.advanced.skillOverrides.placeholder')}
          saveLabel={t('settings.advanced.skillOverrides.save')}
          clearLabel={t('settings.advanced.skillOverrides.clear')}
          settingKey="skillOverrides"
          scope={scope}
          overriddenScope={overriddenScope}
          onSave={async (_key, value) => onSave('skillOverrides', parseJsonSettingValue('skillOverrides', value as string))}
          onDelete={async () => onDelete('skillOverrides')}
        />
      );
    case 'worktree':
      return (
        <TextSetting
          label={t('settings.advanced.worktree.label')}
          description={t('settings.advanced.worktree.description')}
          value={settings.worktree ? JSON.stringify(settings.worktree) : undefined}
          placeholder={t('settings.advanced.worktree.placeholder')}
          saveLabel={t('settings.advanced.worktree.save')}
          clearLabel={t('settings.advanced.worktree.clear')}
          settingKey="worktree"
          scope={scope}
          overriddenScope={overriddenScope}
          onSave={async (_key, value) => onSave('worktree', parseJsonSettingValue('worktree', value as string))}
          onDelete={async () => onDelete('worktree')}
        />
      );
    case 'sshConfigs':
      return (
        <TextSetting
          label={t('settings.advanced.sshConfigs.label')}
          description={t('settings.advanced.sshConfigs.description')}
          value={settings.sshConfigs ? JSON.stringify(settings.sshConfigs) : undefined}
          placeholder={t('settings.advanced.sshConfigs.placeholder')}
          saveLabel={t('settings.advanced.sshConfigs.save')}
          clearLabel={t('settings.advanced.sshConfigs.clear')}
          settingKey="sshConfigs"
          scope={scope}
          overriddenScope={overriddenScope}
          onSave={async (_key, value) => onSave('sshConfigs', parseJsonSettingValue('sshConfigs', value as string))}
          onDelete={async () => onDelete('sshConfigs')}
        />
      );
    case 'autoMode':
      return (
        <TextSetting
          label={t('settings.advanced.autoMode.label')}
          description={t('settings.advanced.autoMode.description')}
          value={settings.autoMode ? JSON.stringify(settings.autoMode) : undefined}
          placeholder={t('settings.advanced.autoMode.placeholder')}
          saveLabel={t('settings.advanced.autoMode.save')}
          clearLabel={t('settings.advanced.autoMode.clear')}
          settingKey="autoMode"
          scope={scope}
          overriddenScope={overriddenScope}
          onSave={async (_key, value) => onSave('autoMode', parseJsonSettingValue('autoMode', value as string))}
          onDelete={async () => onDelete('autoMode')}
        />
      );
    case 'voice':
      return (
        <TextSetting
          label={t('settings.display.voice.label')}
          description={t('settings.display.voice.description')}
          value={settings.voice ? JSON.stringify(settings.voice) : undefined}
          placeholder={t('settings.display.voice.placeholder')}
          saveLabel={t('settings.common.save')}
          clearLabel={t('settings.common.clear')}
          settingKey="voice"
          scope={scope}
          overriddenScope={overriddenScope}
          onSave={async (_key, value) => onSave('voice', JSON.parse(value as string))}
          onDelete={async () => onDelete('voice')}
        />
      );
    case 'spinnerVerbs':
      return <SpinnerVerbsEditor scope={scope} value={settings.spinnerVerbs} onSave={onSave} onDelete={onDelete} />;
    case 'spinnerTipsOverride':
      return <SpinnerTipsOverrideEditor scope={scope} value={settings.spinnerTipsOverride} onSave={onSave} onDelete={onDelete} />;
    case 'allowedMcpServers':
      return (
        <TextSetting
          label={t('settings.permissions.allowedMcpServers.label')}
          description={t('settings.permissions.allowedMcpServers.description')}
          value={settings.allowedMcpServers ? JSON.stringify(settings.allowedMcpServers) : undefined}
          placeholder={t('settings.permissions.allowedMcpServers.placeholder')}
          saveLabel={t('settings.permissions.allowedMcpServers.save')}
          clearLabel={t('settings.permissions.allowedMcpServers.clear')}
          settingKey="allowedMcpServers"
          scope={scope}
          overriddenScope={overriddenScope}
          onSave={async (_key, value) => onSave('allowedMcpServers', parseJsonSettingValue('allowedMcpServers', value as string))}
          onDelete={async () => onDelete('allowedMcpServers')}
        />
      );
    case 'deniedMcpServers':
      return (
        <TextSetting
          label={t('settings.permissions.deniedMcpServers.label')}
          description={t('settings.permissions.deniedMcpServers.description')}
          value={settings.deniedMcpServers ? JSON.stringify(settings.deniedMcpServers) : undefined}
          placeholder={t('settings.permissions.deniedMcpServers.placeholder')}
          saveLabel={t('settings.permissions.deniedMcpServers.save')}
          clearLabel={t('settings.permissions.deniedMcpServers.clear')}
          settingKey="deniedMcpServers"
          scope={scope}
          overriddenScope={overriddenScope}
          onSave={async (_key, value) => onSave('deniedMcpServers', parseJsonSettingValue('deniedMcpServers', value as string))}
          onDelete={async () => onDelete('deniedMcpServers')}
        />
      );
    default:
      console.error(`[ObjectFieldEditor] no case for object key: ${settingKey}`);
      return null;
  }
}
