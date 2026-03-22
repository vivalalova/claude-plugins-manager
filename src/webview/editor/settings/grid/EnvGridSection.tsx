import React, { useState } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope, ClaudeSettings } from '../../../../shared/types';
import { getKnownEnvVar, getKnownEnvVarNames } from '../../../../shared/known-env-vars';

// Sensitive env var name pattern
const SENSITIVE_PATTERN = /_SECRET$|_TOKEN$|_KEY$|_PASSWORD$|_CREDENTIAL$|^SECRET$|^TOKEN$|^PASSWORD$/i;

function isSensitive(name: string): boolean {
  if (SENSITIVE_PATTERN.test(name)) return true;
  const known = getKnownEnvVar(name);
  return known?.sensitive === true;
}

interface EnvGridRowProps {
  envKey: string;
  userVal: string | undefined;
  projectVal: string | undefined;
  localVal: string | undefined;
  hasWorkspace: boolean;
  isOdd: boolean;
  onSave: (scope: PluginScope, envKey: string, value: string) => Promise<void>;
  onDelete: (scope: PluginScope, envKey: string) => Promise<void>;
}

function EnvValueCell({
  envKey,
  value,
  scope,
  disabled,
  onSave,
  onDelete,
}: {
  envKey: string;
  value: string | undefined;
  scope: PluginScope;
  disabled?: boolean;
  onSave: (scope: PluginScope, envKey: string, value: string) => Promise<void>;
  onDelete: (scope: PluginScope, envKey: string) => Promise<void>;
}): React.ReactElement {
  const { t } = useI18n();
  const sensitive = isSensitive(envKey);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [revealed, setRevealed] = useState(false);

  const displayValue = value !== undefined
    ? (sensitive && !revealed ? t('settings.grid.sensitive') : value)
    : undefined;

  const startEdit = (): void => {
    if (disabled) return;
    setDraft(value ?? '');
    setEditing(true);
  };

  const commit = async (): Promise<void> => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === (value ?? '')) return;
    if (!trimmed) {
      await onDelete(scope, envKey);
    } else {
      await onSave(scope, envKey, trimmed);
    }
  };

  const cancel = (): void => {
    setEditing(false);
    setDraft(value ?? '');
  };

  if (editing) {
    return (
      <input
        className="sg-inline-input"
        type="text"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void commit(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
      />
    );
  }

  return (
    <div className="sg-env-cell-content">
      <span
        className={`sg-text-value${disabled ? '' : ' sg-editable'}`}
        onClick={disabled ? undefined : startEdit}
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? undefined : 0}
        onKeyDown={disabled ? undefined : (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(); }
        }}
      >
        {displayValue !== undefined
          ? (sensitive && !revealed ? <em>{displayValue}</em> : displayValue)
          : <em style={{ opacity: 0.4 }}>—</em>
        }
      </span>
      {value !== undefined && sensitive && (
        <button
          className="sg-reset-btn"
          onClick={() => setRevealed((r) => !r)}
          title={t('settings.env.toggleReveal')}
        >
          {revealed ? '🙈' : '👁'}
        </button>
      )}
      {value !== undefined && !disabled && (
        <button
          className="sg-reset-btn"
          onClick={() => void onDelete(scope, envKey)}
          title="Remove"
        >
          ×
        </button>
      )}
    </div>
  );
}

function EnvGridRow({
  envKey,
  userVal,
  projectVal,
  localVal,
  hasWorkspace,
  isOdd,
  onSave,
  onDelete,
}: EnvGridRowProps): React.ReactElement {
  const known = getKnownEnvVar(envKey);
  const rowClass = `sg-row${isOdd ? ' sg-row--odd' : ''}`;

  return (
    <div className={rowClass} role="row">
      <div
        className="sg-cell sg-key sg-env-key"
        data-tooltip={known?.description || undefined}
        role="rowheader"
      >
        {envKey}
      </div>
      <div className="sg-cell sg-default" role="cell">
        {known?.default ?? '—'}
      </div>
      <div className={`sg-cell${userVal !== undefined ? ' sg-cell--set' : ' sg-editable'}`} role="cell">
        <EnvValueCell
          envKey={envKey}
          value={userVal}
          scope="user"
          onSave={onSave}
          onDelete={onDelete}
        />
      </div>
      <div
        className={`sg-cell${!hasWorkspace ? ' sg-cell--disabled' : ''}${projectVal !== undefined ? ' sg-cell--set' : ' sg-editable'}`}
        role="cell"
      >
        <EnvValueCell
          envKey={envKey}
          value={projectVal}
          scope="project"
          disabled={!hasWorkspace}
          onSave={onSave}
          onDelete={onDelete}
        />
      </div>
      <div
        className={`sg-cell${!hasWorkspace ? ' sg-cell--disabled' : ''}${localVal !== undefined ? ' sg-cell--set' : ' sg-editable'}`}
        role="cell"
      >
        <EnvValueCell
          envKey={envKey}
          value={localVal}
          scope="local"
          disabled={!hasWorkspace}
          onSave={onSave}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

interface AddEnvRowProps {
  hasWorkspace: boolean;
  existingKeys: Set<string>;
  onAdd: (scope: PluginScope, key: string, value: string) => Promise<void>;
}

function AddEnvRow({ hasWorkspace, existingKeys, onAdd }: AddEnvRowProps): React.ReactElement {
  const { t } = useI18n();
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newScope, setNewScope] = useState<PluginScope>('user');
  const [keyError, setKeyError] = useState('');
  const knownNames = getKnownEnvVarNames();

  const validateKey = (k: string): boolean => {
    if (!k) { setKeyError(''); return false; }
    if (!/^[A-Z][A-Z0-9_]*$/.test(k)) {
      setKeyError(t('settings.env.invalidKey'));
      return false;
    }
    if (existingKeys.has(k)) {
      setKeyError(t('settings.env.duplicateKey'));
      return false;
    }
    setKeyError('');
    return true;
  };

  const handleAdd = async (): Promise<void> => {
    if (!validateKey(newKey)) return;
    if (!newVal.trim()) return;
    await onAdd(newScope, newKey, newVal.trim());
    setNewKey('');
    setNewVal('');
  };

  return (
    <div className="sg-env-add" role="row">
      <div className="sg-cell sg-env-add-cell" role="cell">
        <input
          className={`sg-env-add-input${keyError ? ' sg-env-add-input--error' : ''}`}
          list="sg-env-known-keys"
          type="text"
          placeholder={t('settings.grid.addEnvVar')}
          value={newKey}
          onChange={(e) => {
            setNewKey(e.target.value.toUpperCase());
            validateKey(e.target.value.toUpperCase());
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
          title={keyError || undefined}
        />
        <datalist id="sg-env-known-keys">
          {knownNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {keyError && <span className="sg-env-key-error">{keyError}</span>}
      </div>
      <div className="sg-cell sg-env-add-cell" role="cell">
        <select
          value={newScope}
          onChange={(e) => setNewScope(e.target.value as PluginScope)}
        >
          <option value="user">User</option>
          {hasWorkspace && <option value="project">Project</option>}
          {hasWorkspace && <option value="local">Local</option>}
        </select>
      </div>
      <div className="sg-cell sg-env-add-cell" style={{ gridColumn: 'span 2' }} role="cell">
        <input
          className="sg-env-add-input"
          type="text"
          placeholder={t('settings.env.valuePlaceholder')}
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
        />
        <button
          className="sg-tag-add-btn"
          onClick={() => void handleAdd()}
          disabled={!newKey || !newVal.trim() || !!keyError}
        >
          {t('settings.env.add')}
        </button>
      </div>
    </div>
  );
}

export interface EnvGridSectionProps {
  userSettings: ClaudeSettings;
  projectSettings: ClaudeSettings;
  localSettings: ClaudeSettings;
  hasWorkspace: boolean;
  filterText: string;
  showMode: 'all' | 'customized';
  onSaveEnv: (scope: PluginScope, key: string, value: string) => Promise<void>;
  onDeleteEnv: (scope: PluginScope, key: string) => Promise<void>;
  startOddIndex: number;
}

export function EnvGridSection({
  userSettings,
  projectSettings,
  localSettings,
  hasWorkspace,
  filterText,
  showMode,
  onSaveEnv,
  onDeleteEnv,
  startOddIndex,
}: EnvGridSectionProps): React.ReactElement {
  const userEnv = userSettings.env ?? {};
  const projectEnv = projectSettings.env ?? {};
  const localEnv = localSettings.env ?? {};

  // Collect all unique env keys across scopes + known env vars (for discovery)
  const allKeys = new Set<string>([
    ...Object.keys(userEnv),
    ...Object.keys(projectEnv),
    ...Object.keys(localEnv),
  ]);

  const existingKeys = new Set(allKeys);

  const filterLower = filterText.toLowerCase();

  let rows = [...allKeys].sort().map((key, idx) => {
    const userVal = userEnv[key];
    const projectVal = projectEnv[key];
    const localVal = localEnv[key];
    return { key, userVal, projectVal, localVal, idx };
  });

  if (filterText) {
    rows = rows.filter(({ key }) => {
      const known = getKnownEnvVar(key);
      return (
        key.toLowerCase().includes(filterLower) ||
        (known?.description ?? '').toLowerCase().includes(filterLower)
      );
    });
  }

  if (showMode === 'customized') {
    rows = rows.filter(({ userVal, projectVal, localVal }) =>
      userVal !== undefined || projectVal !== undefined || localVal !== undefined
    );
  }

  return (
    <>
      {rows.map(({ key, userVal, projectVal, localVal, idx }) => (
        <EnvGridRow
          key={key}
          envKey={key}
          userVal={userVal}
          projectVal={projectVal}
          localVal={localVal}
          hasWorkspace={hasWorkspace}
          isOdd={(startOddIndex + idx) % 2 === 1}
          onSave={onSaveEnv}
          onDelete={onDeleteEnv}
        />
      ))}
      <AddEnvRow
        hasWorkspace={hasWorkspace}
        existingKeys={existingKeys}
        onAdd={onSaveEnv}
      />
    </>
  );
}
