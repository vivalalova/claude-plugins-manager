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

/**
 * 此編輯器實際會渲染出內容的判定（單一來源）：allow/deny/ask 任一非空，或
 * additionalDirectories 非空。badge 計數與本編輯器都用它，避免「計數有值但畫面空白」。
 */
export function hasVisiblePermissionsContent(perms: ClaudeSettings['permissions']): boolean {
  const p = perms ?? {};
  return (
    (p.allow ?? []).length > 0 ||
    (p.deny ?? []).length > 0 ||
    (p.ask ?? []).length > 0 ||
    (p.additionalDirectories ?? []).length > 0
  );
}

export function CustomizedPermissionsEditor({
  perms,
  onSavePermissions,
  scope,
  disabled,
}: CustomizedPermissionsEditorProps): React.ReactElement | null {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();

  const isDisabled = disabled || saving;
  const safePerms = perms ?? {};

  if (!hasVisiblePermissionsContent(perms)) return null;

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
      {lists.map(({ id, label }) => {
        const rules = (safePerms[id] ?? []) as string[];
        if (rules.length === 0) return null;
        return (
          <PermissionRuleListEditor
            key={id}
            title={label}
            rules={rules}
            onAdd={(rule) => handleAdd(id, rule)}
            onDelete={(rule) => handleDelete(id, rule)}
            disabled={isDisabled}
          />
        );
      })}

      {additionalDirs.length > 0 && (
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
      )}
    </div>
  );
}
