import React from 'react';
import type { SettingFieldSchema } from '../../../../shared/claude-settings-schema';
import { getSchemaDefault } from '../../../../shared/claude-settings-schema';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope, ClaudeSettings } from '../../../../shared/types';
import { GridCellEditor } from './GridCellEditor';

export interface GridRowProps {
  settingKey: keyof ClaudeSettings;
  schema: SettingFieldSchema;
  values: { user: unknown; project: unknown; local: unknown };
  hasWorkspace: boolean;
  isOdd: boolean;
  onSave: (scope: PluginScope, key: string, value: unknown) => Promise<void>;
  onDelete: (scope: PluginScope, key: string) => Promise<void>;
}

/** Format a default value for display in the Default column */
function formatDefault(val: unknown): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

export function GridRow({
  settingKey,
  schema,
  values,
  hasWorkspace,
  isOdd,
  onSave,
  onDelete,
}: GridRowProps): React.ReactElement {
  const { t } = useI18n();

  const labelKey = `settings.${schema.section}.${settingKey}.label` as Parameters<typeof t>[0];
  const descKey = `settings.${schema.section}.${settingKey}.description` as Parameters<typeof t>[0];
  const label = t(labelKey);
  const description = t(descKey);

  const defaultVal = getSchemaDefault(settingKey as string);

  const rowClass = `sg-row${isOdd ? ' sg-row--odd' : ''}`;

  const makeCellProps = (scope: PluginScope, val: unknown) => ({
    settingKey: settingKey as string,
    schema,
    value: val,
    scope,
    disabled: (scope === 'project' || scope === 'local') && !hasWorkspace,
    onSave: (v: unknown) => onSave(scope, settingKey as string, v),
    onDelete: () => onDelete(scope, settingKey as string),
  });

  return (
    <div className={rowClass} role="row">
      {/* Key cell */}
      <div
        className="sg-cell sg-key"
        data-tooltip={description || undefined}
        role="rowheader"
      >
        {label || settingKey}
      </div>

      {/* Default cell */}
      <div className="sg-cell sg-default" role="cell">
        {formatDefault(defaultVal)}
      </div>

      {/* User cell */}
      <div
        className={`sg-cell sg-editable${values.user !== undefined ? ' sg-cell--set' : ''}`}
        role="cell"
      >
        <GridCellEditor {...makeCellProps('user', values.user)} />
        {values.user !== undefined && (
          <button
            className="sg-reset-btn"
            onClick={() => void onDelete('user', settingKey as string)}
            title={t('settings.grid.resetToDefault')}
          >
            ↺
          </button>
        )}
      </div>

      {/* Project cell */}
      <div
        className={`sg-cell${!hasWorkspace ? ' sg-cell--disabled' : ' sg-editable'}${values.project !== undefined ? ' sg-cell--set' : ''}`}
        role="cell"
      >
        <GridCellEditor {...makeCellProps('project', values.project)} />
        {values.project !== undefined && hasWorkspace && (
          <button
            className="sg-reset-btn"
            onClick={() => void onDelete('project', settingKey as string)}
            title={t('settings.grid.resetToDefault')}
          >
            ↺
          </button>
        )}
      </div>

      {/* Local cell */}
      <div
        className={`sg-cell${!hasWorkspace ? ' sg-cell--disabled' : ' sg-editable'}${values.local !== undefined ? ' sg-cell--set' : ''}`}
        role="cell"
      >
        <GridCellEditor {...makeCellProps('local', values.local)} />
        {values.local !== undefined && hasWorkspace && (
          <button
            className="sg-reset-btn"
            onClick={() => void onDelete('local', settingKey as string)}
            title={t('settings.grid.resetToDefault')}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
