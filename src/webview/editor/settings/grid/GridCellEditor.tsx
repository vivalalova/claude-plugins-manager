import React, { useRef, useState } from 'react';
import type { SettingFieldSchema } from '../../../../shared/claude-settings-schema';
import { getSchemaEnumOptions } from '../../../../shared/claude-settings-schema';
import { useI18n } from '../../../i18n/I18nContext';
import type { PluginScope } from '../../../../shared/types';

export interface GridCellEditorProps {
  settingKey: string;
  schema: SettingFieldSchema;
  value: unknown;
  scope: PluginScope;
  disabled?: boolean;
  onSave: (value: unknown) => Promise<void>;
  onDelete: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Boolean cell
// ---------------------------------------------------------------------------

function BooleanCell({
  value,
  disabled,
  onSave,
}: {
  value: unknown;
  disabled?: boolean;
  onSave: (v: unknown) => Promise<void>;
}): React.ReactElement {
  const checked = value === true;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    await onSave(e.target.checked);
  };

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={handleChange}
      aria-label="toggle"
    />
  );
}

// ---------------------------------------------------------------------------
// Enum cell
// ---------------------------------------------------------------------------

function EnumCell({
  settingKey,
  schema,
  value,
  disabled,
  onSave,
  onDelete,
}: {
  settingKey: string;
  schema: SettingFieldSchema;
  value: unknown;
  disabled?: boolean;
  onSave: (v: unknown) => Promise<void>;
  onDelete: () => Promise<void>;
}): React.ReactElement {
  const { t } = useI18n();
  const options = getSchemaEnumOptions(settingKey);
  const strVal = value !== undefined ? String(value) : '';

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>): Promise<void> => {
    const v = e.target.value;
    if (!v) {
      await onDelete();
    } else {
      await onSave(v);
    }
  };

  return (
    <select value={strVal} disabled={disabled} onChange={handleChange}>
      <option value="">
        {t('settings.grid.notSet')}
      </option>
      {options.map((opt) => {
        const labelKey = `settings.${schema.section}.${settingKey}.${opt}` as Parameters<typeof t>[0];
        const label = t(labelKey) || opt;
        return (
          <option key={opt} value={opt}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Text cell
// ---------------------------------------------------------------------------

function TextCell({
  value,
  schema,
  disabled,
  onSave,
  onDelete,
}: {
  value: unknown;
  schema: SettingFieldSchema;
  disabled?: boolean;
  onSave: (v: unknown) => Promise<void>;
  onDelete: () => Promise<void>;
}): React.ReactElement {
  const strVal = value !== undefined ? String(value) : '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(strVal);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (): void => {
    setDraft(strVal);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = async (): Promise<void> => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === strVal) return;
    if (!trimmed) {
      await onDelete();
    } else {
      await onSave(trimmed);
    }
  };

  const cancel = (): void => {
    setEditing(false);
    setDraft(strVal);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="sg-inline-input"
        type={schema.controlType === 'number' ? 'number' : 'text'}
        value={draft}
        min={schema.min}
        max={schema.max}
        step={schema.step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void commit(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
      />
    );
  }

  return (
    <span
      className={`sg-text-value${disabled ? '' : ' sg-editable'}`}
      onClick={disabled ? undefined : startEdit}
      title={disabled ? undefined : 'Click to edit'}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      onKeyDown={disabled ? undefined : (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(); }
      }}
    >
      {strVal || <em style={{ opacity: 0.5 }}>—</em>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// TagInput cell (compact)
// ---------------------------------------------------------------------------

function TagInputCell({
  value,
  disabled,
  onSave,
  onDelete,
}: {
  value: unknown;
  disabled?: boolean;
  onSave: (v: unknown) => Promise<void>;
  onDelete: () => Promise<void>;
}): React.ReactElement {
  const { t } = useI18n();
  const tags = Array.isArray(value) ? (value as string[]) : [];
  const [expanded, setExpanded] = useState(false);
  const [newTag, setNewTag] = useState('');

  const addTag = async (): Promise<void> => {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    const next = [...tags, trimmed];
    setNewTag('');
    await onSave(next);
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
        {t('settings.grid.items', { count: tags.length })}
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
            placeholder="Add..."
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

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export function GridCellEditor({
  settingKey,
  schema,
  value,
  disabled,
  onSave,
  onDelete,
}: GridCellEditorProps): React.ReactElement | null {
  switch (schema.controlType) {
    case 'boolean':
      return (
        <BooleanCell
          value={value}
          disabled={disabled}
          onSave={onSave}
        />
      );
    case 'enum':
      return (
        <EnumCell
          settingKey={settingKey}
          schema={schema}
          value={value}
          disabled={disabled}
          onSave={onSave}
          onDelete={onDelete}
        />
      );
    case 'text':
    case 'number':
      return (
        <TextCell
          value={value}
          schema={schema}
          disabled={disabled}
          onSave={onSave}
          onDelete={onDelete}
        />
      );
    case 'tagInput':
      return (
        <TagInputCell
          value={value}
          disabled={disabled}
          onSave={onSave}
          onDelete={onDelete}
        />
      );
    case 'custom':
      return null;
    default:
      return null;
  }
}
