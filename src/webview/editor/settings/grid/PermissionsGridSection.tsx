import React, { useState } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope, ClaudeSettings } from '../../../../shared/types';

const PERMISSION_MODES = ['default', 'ask', 'allow-all', 'deny-all', 'ignore-all'] as const;

interface TagListCellProps {
  items: string[] | undefined;
  scope: PluginScope;
  disabled?: boolean;
  onSave: (items: string[]) => Promise<void>;
  onDelete: () => Promise<void>;
}

function TagListCell({ items, disabled, onSave, onDelete }: TagListCellProps): React.ReactElement {
  const { t } = useI18n();
  const tags = items ?? [];
  const [expanded, setExpanded] = useState(false);
  const [newTag, setNewTag] = useState('');

  const addTag = async (): Promise<void> => {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setNewTag('');
    await onSave([...tags, trimmed]);
  };

  const removeTag = async (tag: string): Promise<void> => {
    const next = tags.filter((t) => t !== tag);
    if (next.length === 0) {
      await onDelete();
    } else {
      await onSave(next);
    }
  };

  if (!expanded) {
    return (
      <span
        className="sg-tag-badge"
        onClick={disabled ? undefined : () => setExpanded(true)}
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? undefined : 0}
        onKeyDown={disabled ? undefined : (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true); }
        }}
        title={tags.join(', ') || undefined}
      >
        {t('settings.grid.rules', { count: tags.length })}
      </span>
    );
  }

  return (
    <div className="sg-tag-expand-inline">
      <div className="sg-tag-list">
        {tags.map((tag) => (
          <span key={tag} className="sg-tag-item">
            {tag}
            {!disabled && (
              <button
                className="sg-tag-remove"
                onClick={() => void removeTag(tag)}
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {tags.length === 0 && <em style={{ opacity: 0.5 }}>—</em>}
      </div>
      {!disabled && (
        <div className="sg-tag-add-row">
          <input
            className="sg-inline-input"
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add rule..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void addTag(); }
              if (e.key === 'Escape') { e.preventDefault(); setExpanded(false); }
            }}
          />
          <button className="sg-tag-add-btn" onClick={() => void addTag()}>+</button>
        </div>
      )}
      <button className="sg-tag-collapse-btn" onClick={() => setExpanded(false)}>Done</button>
    </div>
  );
}

interface PermRowProps {
  label: string;
  description?: string;
  isOdd: boolean;
  userCell: React.ReactNode;
  projectCell: React.ReactNode;
  localCell: React.ReactNode;
  defaultCell?: React.ReactNode;
}

function PermRow({
  label,
  description,
  isOdd,
  userCell,
  projectCell,
  localCell,
  defaultCell,
}: PermRowProps): React.ReactElement {
  const rowClass = `sg-row${isOdd ? ' sg-row--odd' : ''}`;
  return (
    <div className={rowClass} role="row">
      <div
        className="sg-cell sg-key"
        data-tooltip={description || undefined}
        role="rowheader"
      >
        {label}
      </div>
      <div className="sg-cell sg-default" role="cell">{defaultCell ?? '—'}</div>
      <div className="sg-cell sg-editable" role="cell">{userCell}</div>
      <div className="sg-cell sg-editable" role="cell">{projectCell}</div>
      <div className="sg-cell sg-editable" role="cell">{localCell}</div>
    </div>
  );
}

export interface PermissionsGridSectionProps {
  userSettings: ClaudeSettings;
  projectSettings: ClaudeSettings;
  localSettings: ClaudeSettings;
  hasWorkspace: boolean;
  startOddIndex: number;
  onSave: (scope: PluginScope, key: string, value: unknown) => Promise<void>;
  onDelete: (scope: PluginScope, key: string) => Promise<void>;
}

export function PermissionsGridSection({
  userSettings,
  projectSettings,
  localSettings,
  hasWorkspace,
  startOddIndex,
  onSave,
  onDelete,
}: PermissionsGridSectionProps): React.ReactElement {
  const { t } = useI18n();

  // Helper to save nested permission field
  const savePermField = async (
    scope: PluginScope,
    field: 'allow' | 'deny' | 'ask' | 'defaultMode' | 'additionalDirectories',
    value: unknown,
    settingsForScope: ClaudeSettings,
  ): Promise<void> => {
    const current = settingsForScope.permissions ?? {};
    await onSave(scope, 'permissions', { ...current, [field]: value });
  };

  const deletePermField = async (
    scope: PluginScope,
    field: 'allow' | 'deny' | 'ask' | 'defaultMode' | 'additionalDirectories',
    settingsForScope: ClaudeSettings,
  ): Promise<void> => {
    const current = { ...(settingsForScope.permissions ?? {}) };
    delete (current as Record<string, unknown>)[field];
    if (Object.keys(current).length === 0) {
      await onDelete(scope, 'permissions');
    } else {
      await onSave(scope, 'permissions', current);
    }
  };

  const makeModeCell = (scope: PluginScope, settings: ClaudeSettings, disabled?: boolean) => {
    const mode = settings.permissions?.defaultMode ?? '';
    return (
      <select
        value={mode}
        disabled={disabled}
        onChange={async (e) => {
          const v = e.target.value;
          if (!v) {
            await deletePermField(scope, 'defaultMode', settings);
          } else {
            await savePermField(scope, 'defaultMode', v, settings);
          }
        }}
      >
        <option value="">{t('settings.grid.notSet')}</option>
        {PERMISSION_MODES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    );
  };

  const makeTagCell = (
    scope: PluginScope,
    field: 'allow' | 'deny' | 'ask' | 'additionalDirectories',
    settings: ClaudeSettings,
    disabled?: boolean,
  ) => {
    const items = settings.permissions?.[field];
    return (
      <TagListCell
        items={items}
        scope={scope}
        disabled={disabled}
        onSave={(v) => savePermField(scope, field, v, settings)}
        onDelete={() => deletePermField(scope, field, settings)}
      />
    );
  };

  const makeTagInputCell = (
    scope: PluginScope,
    key: 'enabledMcpjsonServers' | 'disabledMcpjsonServers',
    settings: ClaudeSettings,
    disabled?: boolean,
  ) => {
    const items = settings[key];
    return (
      <TagListCell
        items={items}
        scope={scope}
        disabled={disabled}
        onSave={(v) => onSave(scope, key, v)}
        onDelete={() => onDelete(scope, key)}
      />
    );
  };

  const rows = [
    {
      label: t('settings.permissions.defaultMode'),
      description: 'Default permission mode for tools',
      userCell: makeModeCell('user', userSettings),
      projectCell: makeModeCell('project', projectSettings, !hasWorkspace),
      localCell: makeModeCell('local', localSettings, !hasWorkspace),
    },
    {
      label: t('settings.permissions.allow'),
      description: 'Patterns always allowed without prompting',
      userCell: makeTagCell('user', 'allow', userSettings),
      projectCell: makeTagCell('project', 'allow', projectSettings, !hasWorkspace),
      localCell: makeTagCell('local', 'allow', localSettings, !hasWorkspace),
    },
    {
      label: t('settings.permissions.deny'),
      description: 'Patterns always denied',
      userCell: makeTagCell('user', 'deny', userSettings),
      projectCell: makeTagCell('project', 'deny', projectSettings, !hasWorkspace),
      localCell: makeTagCell('local', 'deny', localSettings, !hasWorkspace),
    },
    {
      label: t('settings.permissions.ask'),
      description: 'Patterns that always prompt for confirmation',
      userCell: makeTagCell('user', 'ask', userSettings),
      projectCell: makeTagCell('project', 'ask', projectSettings, !hasWorkspace),
      localCell: makeTagCell('local', 'ask', localSettings, !hasWorkspace),
    },
    {
      label: t('settings.permissions.additionalDirectories.label'),
      description: t('settings.permissions.additionalDirectories.description'),
      userCell: makeTagCell('user', 'additionalDirectories', userSettings),
      projectCell: makeTagCell('project', 'additionalDirectories', projectSettings, !hasWorkspace),
      localCell: makeTagCell('local', 'additionalDirectories', localSettings, !hasWorkspace),
    },
    {
      label: t('settings.permissions.enabledMcpjsonServers.label'),
      description: t('settings.permissions.enabledMcpjsonServers.description'),
      userCell: makeTagInputCell('user', 'enabledMcpjsonServers', userSettings),
      projectCell: makeTagInputCell('project', 'enabledMcpjsonServers', projectSettings, !hasWorkspace),
      localCell: makeTagInputCell('local', 'enabledMcpjsonServers', localSettings, !hasWorkspace),
    },
    {
      label: t('settings.permissions.disabledMcpjsonServers.label'),
      description: t('settings.permissions.disabledMcpjsonServers.description'),
      userCell: makeTagInputCell('user', 'disabledMcpjsonServers', userSettings),
      projectCell: makeTagInputCell('project', 'disabledMcpjsonServers', projectSettings, !hasWorkspace),
      localCell: makeTagInputCell('local', 'disabledMcpjsonServers', localSettings, !hasWorkspace),
    },
  ];

  return (
    <>
      {rows.map((row, idx) => (
        <PermRow
          key={row.label}
          label={row.label}
          description={row.description}
          isOdd={(startOddIndex + idx) % 2 === 1}
          userCell={row.userCell}
          projectCell={row.projectCell}
          localCell={row.localCell}
        />
      ))}
    </>
  );
}
