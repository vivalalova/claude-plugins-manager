import React from 'react';
import type { ClaudeSettings, PluginScope } from '../../../../shared/types';
import { getFlatFieldSchema, getSectionFieldOrder, type FlatFieldSchema, type SettingsSection } from '../../../../shared/claude-settings-schema';
import { SchemaFieldRenderer } from './SchemaFieldRenderer';
import { getOverriddenScope } from './SettingControls';
import { SettingsSectionWrapper } from './SettingsSectionWrapper';

// ---------------------------------------------------------------------------
// Shared section props (reused by General, Display, Advanced, Hooks)
// ---------------------------------------------------------------------------

export interface SectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  userSettings?: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// SchemaSection — generic schema-driven section renderer
// ---------------------------------------------------------------------------

interface SchemaSectionProps extends SectionProps {
  section: SettingsSection;
  renderCustom?: (key: string, props: { scope: PluginScope; settings: ClaudeSettings; overriddenScope?: PluginScope; onSave: SectionProps['onSave']; onDelete: SectionProps['onDelete'] }) => React.ReactNode | null;
  headerContent?: React.ReactNode;
}

interface ResolvedSchemaFieldBindings {
  schema: FlatFieldSchema;
  value: unknown;
  onSave: SectionProps['onSave'];
  onDelete: SectionProps['onDelete'];
  overriddenScope?: PluginScope;
}

export function getSchemaFieldBindings(
  key: string,
  {
    scope,
    settings,
    userSettings,
    onSave,
    onDelete,
  }: Pick<SectionProps, 'scope' | 'settings' | 'userSettings' | 'onSave' | 'onDelete'>,
): ResolvedSchemaFieldBindings | null {
  const schema = getFlatFieldSchema(key) as FlatFieldSchema | undefined;
  if (!schema) return null;

  if (schema.nestedUnder) {
    const parentKey = schema.nestedUnder;
    const parent = ((settings as Record<string, unknown>)[parentKey] ?? {}) as Record<string, unknown>;
    const parentUserSettings = ((userSettings as Record<string, unknown> | undefined)?.[parentKey] ?? {}) as Record<string, unknown>;

    return {
      schema,
      value: parent[key],
      onSave: async (_k: string, newValue: unknown) => {
        await onSave(parentKey, { ...parent, [key]: newValue });
      },
      onDelete: async (_k: string) => {
        const updated = { ...parent };
        delete updated[key];
        await onSave(parentKey, updated);
      },
      overriddenScope: getOverriddenScope(scope, parentUserSettings, key),
    } as ResolvedSchemaFieldBindings;
  }

  return {
    schema,
    value: (settings as Record<string, unknown>)[key],
    onSave,
    onDelete,
    overriddenScope: getOverriddenScope(scope, userSettings as Record<string, unknown>, key),
  } as ResolvedSchemaFieldBindings;
}

export function SchemaSection({
  section,
  scope,
  settings,
  userSettings,
  onSave,
  onDelete,
  renderCustom,
  headerContent,
}: SchemaSectionProps): React.ReactElement {
  const fieldOrder = getSectionFieldOrder(section);

  return (
    <SettingsSectionWrapper>
      {headerContent}

      {fieldOrder.map((key) => {
        const field = getSchemaFieldBindings(key, { scope, settings, userSettings, onSave, onDelete });
        if (!field) return null;
        const { schema, value, onSave: fieldOnSave, onDelete: fieldOnDelete, overriddenScope } = field;

        if (schema.controlType === Object) {
          const custom = renderCustom?.(key, { scope, settings, overriddenScope, onSave: fieldOnSave, onDelete: fieldOnDelete });
          if (custom !== undefined) return <React.Fragment key={key}>{custom}</React.Fragment>;
          console.warn(`[SchemaSection] Unhandled custom key: ${key}`);
          return null;
        }

        return (
          <SchemaFieldRenderer
            key={key}
            settingKey={key}
            schema={schema}
            value={value}
            scope={scope}
            overriddenScope={overriddenScope}
            onSave={fieldOnSave}
            onDelete={fieldOnDelete}
          />
        );
      })}
    </SettingsSectionWrapper>
  );
}
