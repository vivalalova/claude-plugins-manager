import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useSettingSave } from './hooks/useSettingSave';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { TagInput } from './components/SettingControls';
import { PermissionRuleListEditor } from './PermissionsSection';

// ---------------------------------------------------------------------------
// CustomizedPermissionsEditor
// Renders allow/deny/ask rule lists + additionalDirectories inline (no sub-tabs).
// Intended for the "Customized" tab where all three lists are shown at once.
// ---------------------------------------------------------------------------

interface CustomizedPermissionsEditorProps {
  perms: ClaudeSettings['permissions'];
  onSavePermissions: (updatedPerms: ClaudeSettings['permissions']) => Promise<void>;
  scope: PluginScope;
  disabled?: boolean;
}

type PermissionsList = 'allow' | 'deny' | 'ask';

export function CustomizedPermissionsEditor({
  perms,
  onSavePermissions,
  scope,
  disabled,
}: CustomizedPermissionsEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();

  const isDisabled = disabled || saving;
  const safePerms = perms ?? {};

  const lists: { id: PermissionsList; label: string }[] = [
    { id: 'allow', label: t('settings.permissions.allow') },
    { id: 'deny', label: t('settings.permissions.deny') },
    { id: 'ask', label: t('settings.permissions.ask') },
  ];

  const handleAdd = (list: PermissionsList, rule: string): void => {
    const current = (safePerms[list] ?? []) as string[];
    void withSave(() => onSavePermissions({ ...safePerms, [list]: [...current, rule] }));
  };

  const handleDelete = (list: PermissionsList, rule: string): void => {
    const current = (safePerms[list] ?? []) as string[];
    void withSave(() => onSavePermissions({ ...safePerms, [list]: current.filter((r) => r !== rule) }));
  };

  const additionalDirs: string[] = safePerms.additionalDirectories ?? [];

  return (
    <div className="customized-permissions-editor">
      {lists.map(({ id, label }) => (
        <PermissionRuleListEditor
          key={id}
          title={label}
          rules={(safePerms[id] ?? []) as string[]}
          onAdd={(rule) => handleAdd(id, rule)}
          onDelete={(rule) => handleDelete(id, rule)}
          disabled={isDisabled}
        />
      ))}

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
        disabled={isDisabled}
        onSave={async (_key, value) => onSavePermissions({ ...safePerms, additionalDirectories: value as string[] })}
      />
    </div>
  );
}
