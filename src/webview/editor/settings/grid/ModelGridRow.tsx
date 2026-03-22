import React, { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope, ClaudeSettings } from '../../../../shared/types';
import { KNOWN_MODEL_OPTIONS } from '../../../../shared/claude-settings-schema';

export interface ModelGridRowProps {
  values: { user: unknown; project: unknown; local: unknown };
  hasWorkspace: boolean;
  isOdd: boolean;
  onSave: (scope: PluginScope, key: string, value: unknown) => Promise<void>;
  onDelete: (scope: PluginScope, key: string) => Promise<void>;
  allSettings: { user: ClaudeSettings; project: ClaudeSettings; local: ClaudeSettings };
}

interface ModelCellProps {
  scope: PluginScope;
  value: unknown;
  availableModels: string[] | undefined;
  disabled?: boolean;
  onSave: (scope: PluginScope, key: string, value: unknown) => Promise<void>;
  onDelete: (scope: PluginScope, key: string) => Promise<void>;
}

function ModelCell({
  scope,
  value,
  availableModels,
  disabled,
  onSave,
  onDelete,
}: ModelCellProps): React.ReactElement {
  const { t } = useI18n();
  const strVal = value !== undefined ? String(value) : '';
  const dropdownModels = availableModels?.length ? availableModels : [...KNOWN_MODEL_OPTIONS];

  const isCustom = strVal && !dropdownModels.includes(strVal) && !KNOWN_MODEL_OPTIONS.includes(strVal as typeof KNOWN_MODEL_OPTIONS[number]);
  const [selectValue, setSelectValue] = useState(isCustom ? 'custom' : strVal);
  const [customInput, setCustomInput] = useState(isCustom ? strVal : '');
  const [showCustom, setShowCustom] = useState(isCustom);

  useEffect(() => {
    const v = value !== undefined ? String(value) : '';
    const custom = v && !dropdownModels.includes(v) && !KNOWN_MODEL_OPTIONS.includes(v as typeof KNOWN_MODEL_OPTIONS[number]);
    setSelectValue(custom ? 'custom' : v);
    setCustomInput(custom ? v : '');
    setShowCustom(custom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>): Promise<void> => {
    const v = e.target.value;
    if (v === 'custom') {
      setSelectValue('custom');
      setShowCustom(true);
      setCustomInput('');
    } else if (!v) {
      setSelectValue('');
      setShowCustom(false);
      await onDelete(scope, 'model');
    } else {
      setSelectValue(v);
      setShowCustom(false);
      await onSave(scope, 'model', v);
    }
  };

  const handleCustomBlur = async (): Promise<void> => {
    const trimmed = customInput.trim();
    if (!trimmed) {
      await onDelete(scope, 'model');
    } else {
      await onSave(scope, 'model', trimmed);
    }
  };

  return (
    <div className="sg-model-cell">
      <select
        value={selectValue}
        disabled={disabled}
        onChange={handleSelectChange}
      >
        <option value="">{t('settings.grid.notSet')}</option>
        {dropdownModels.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
        <option value="custom">{t('settings.grid.model.custom')}</option>
      </select>
      {showCustom && !disabled && (
        <input
          className="sg-inline-input"
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onBlur={() => void handleCustomBlur()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void handleCustomBlur(); }
          }}
          placeholder="model ID..."
        />
      )}
    </div>
  );
}

export function ModelGridRow({
  values,
  hasWorkspace,
  isOdd,
  onSave,
  onDelete,
  allSettings,
}: ModelGridRowProps): React.ReactElement {
  const { t } = useI18n();

  const rowClass = `sg-row${isOdd ? ' sg-row--odd' : ''}`;

  return (
    <div className={rowClass} role="row">
      <div
        className="sg-cell sg-key"
        data-tooltip={t('settings.model.label')}
        role="rowheader"
      >
        {t('settings.model.label')}
      </div>
      <div className="sg-cell sg-default" role="cell">
        —
      </div>
      <div
        className={`sg-cell sg-editable${values.user !== undefined ? ' sg-cell--set' : ''}`}
        role="cell"
      >
        <ModelCell
          scope="user"
          value={values.user}
          availableModels={allSettings.user.availableModels}
          onSave={onSave}
          onDelete={onDelete}
        />
      </div>
      <div
        className={`sg-cell${!hasWorkspace ? ' sg-cell--disabled' : ' sg-editable'}${values.project !== undefined ? ' sg-cell--set' : ''}`}
        role="cell"
      >
        <ModelCell
          scope="project"
          value={values.project}
          availableModels={allSettings.project.availableModels}
          disabled={!hasWorkspace}
          onSave={onSave}
          onDelete={onDelete}
        />
      </div>
      <div
        className={`sg-cell${!hasWorkspace ? ' sg-cell--disabled' : ' sg-editable'}${values.local !== undefined ? ' sg-cell--set' : ''}`}
        role="cell"
      >
        <ModelCell
          scope="local"
          value={values.local}
          availableModels={allSettings.local.availableModels}
          disabled={!hasWorkspace}
          onSave={onSave}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
