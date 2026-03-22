import React, { useState } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope, ClaudeSettings, HookCommand } from '../../../../shared/types';
import { CLAUDE_SETTINGS_SCHEMA } from '../../../../shared/claude-settings-schema';
import { GridCellEditor } from './GridCellEditor';

const HOOK_EVENT_TYPES = [
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'UserPromptSubmit',
] as const;

interface HookBadgeCellProps {
  hooks: Array<{ matcher?: string; hooks: HookCommand[] }> | undefined;
}

function HookBadgeCell({ hooks }: HookBadgeCellProps): React.ReactElement {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const count = hooks?.reduce((acc, entry) => acc + entry.hooks.length, 0) ?? 0;

  if (!expanded) {
    return (
      <span
        className="sg-tag-badge"
        onClick={() => setExpanded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true); }
        }}
      >
        {t('settings.grid.hooks', { count })}
      </span>
    );
  }

  return (
    <div className="sg-tag-expand-inline sg-hooks-expand">
      {hooks && hooks.length > 0
        ? hooks.map((entry, i) => (
          <div key={i} className="sg-hook-entry">
            {entry.matcher && (
              <div className="sg-hook-matcher">matcher: <code>{entry.matcher}</code></div>
            )}
            {entry.hooks.map((cmd, j) => (
              <div key={j} className="sg-hook-cmd">
                <span className="sg-hook-type">{cmd.type}</span>
                {cmd.type === 'command' && <span className="sg-hook-detail">: {cmd.command}</span>}
                {cmd.type === 'http' && <span className="sg-hook-detail">: {cmd.url}</span>}
                {(cmd.type === 'prompt' || cmd.type === 'agent') && (
                  <span className="sg-hook-detail">: {cmd.prompt.substring(0, 40)}{cmd.prompt.length > 40 ? '...' : ''}</span>
                )}
              </div>
            ))}
          </div>
        ))
        : <em style={{ opacity: 0.5 }}>—</em>
      }
      <button className="sg-tag-collapse-btn" onClick={() => setExpanded(false)}>Close</button>
    </div>
  );
}

interface HookRowProps {
  label: string;
  isOdd: boolean;
  userCell: React.ReactNode;
  projectCell: React.ReactNode;
  localCell: React.ReactNode;
}

function HookRow({ label, isOdd, userCell, projectCell, localCell }: HookRowProps): React.ReactElement {
  const rowClass = `sg-row${isOdd ? ' sg-row--odd' : ''}`;
  return (
    <div className={rowClass} role="row">
      <div className="sg-cell sg-key" role="rowheader">{label}</div>
      <div className="sg-cell sg-default" role="cell">—</div>
      <div className="sg-cell" role="cell">{userCell}</div>
      <div className="sg-cell" role="cell">{projectCell}</div>
      <div className="sg-cell" role="cell">{localCell}</div>
    </div>
  );
}

export interface HooksGridSectionProps {
  userSettings: ClaudeSettings;
  projectSettings: ClaudeSettings;
  localSettings: ClaudeSettings;
  hasWorkspace: boolean;
  startOddIndex: number;
  onSave: (scope: PluginScope, key: string, value: unknown) => Promise<void>;
  onDelete: (scope: PluginScope, key: string) => Promise<void>;
}

export function HooksGridSection({
  userSettings,
  projectSettings,
  localSettings,
  hasWorkspace,
  startOddIndex,
  onSave,
  onDelete,
}: HooksGridSectionProps): React.ReactElement {
  // disableAllHooks row
  const disableSchema = CLAUDE_SETTINGS_SCHEMA['disableAllHooks'];

  let rowIdx = 0;

  return (
    <>
      {/* disableAllHooks row — schema-driven boolean */}
      <div className={`sg-row${(startOddIndex + rowIdx++) % 2 === 1 ? ' sg-row--odd' : ''}`} role="row">
        <div
          className="sg-cell sg-key"
          data-tooltip="Globally disable all configured hooks"
          role="rowheader"
        >
          Disable All Hooks
        </div>
        <div className="sg-cell sg-default" role="cell">false</div>
        <div
          className={`sg-cell sg-editable${userSettings.disableAllHooks !== undefined ? ' sg-cell--set' : ''}`}
          role="cell"
        >
          <GridCellEditor
            settingKey="disableAllHooks"
            schema={disableSchema}
            value={userSettings.disableAllHooks}
            scope="user"
            onSave={(v) => onSave('user', 'disableAllHooks', v)}
            onDelete={() => onDelete('user', 'disableAllHooks')}
          />
        </div>
        <div
          className={`sg-cell${!hasWorkspace ? ' sg-cell--disabled' : ' sg-editable'}${projectSettings.disableAllHooks !== undefined ? ' sg-cell--set' : ''}`}
          role="cell"
        >
          <GridCellEditor
            settingKey="disableAllHooks"
            schema={disableSchema}
            value={projectSettings.disableAllHooks}
            scope="project"
            disabled={!hasWorkspace}
            onSave={(v) => onSave('project', 'disableAllHooks', v)}
            onDelete={() => onDelete('project', 'disableAllHooks')}
          />
        </div>
        <div
          className={`sg-cell${!hasWorkspace ? ' sg-cell--disabled' : ' sg-editable'}${localSettings.disableAllHooks !== undefined ? ' sg-cell--set' : ''}`}
          role="cell"
        >
          <GridCellEditor
            settingKey="disableAllHooks"
            schema={disableSchema}
            value={localSettings.disableAllHooks}
            scope="local"
            disabled={!hasWorkspace}
            onSave={(v) => onSave('local', 'disableAllHooks', v)}
            onDelete={() => onDelete('local', 'disableAllHooks')}
          />
        </div>
      </div>

      {/* Hook event type rows — read-only display */}
      {HOOK_EVENT_TYPES.map((eventType) => (
        <HookRow
          key={eventType}
          label={eventType}
          isOdd={(startOddIndex + rowIdx++) % 2 === 1}
          userCell={<HookBadgeCell hooks={userSettings.hooks?.[eventType]} />}
          projectCell={
            hasWorkspace
              ? <HookBadgeCell hooks={projectSettings.hooks?.[eventType]} />
              : <span className="sg-cell--disabled" />
          }
          localCell={
            hasWorkspace
              ? <HookBadgeCell hooks={localSettings.hooks?.[eventType]} />
              : <span className="sg-cell--disabled" />
          }
        />
      ))}
    </>
  );
}
