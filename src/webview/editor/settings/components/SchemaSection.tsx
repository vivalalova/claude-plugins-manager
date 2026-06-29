import React from 'react';
import type { ClaudeSettings, PluginScope } from '../../../../shared/types';
import { getFlatFieldSchema, getSectionFieldOrder, type FlatFieldSchema, type SettingsSection } from '../../../../shared/claude-settings-schema';
import { SchemaFieldRenderer } from './SchemaFieldRenderer';
import { getOverriddenScope } from './SettingControls';
import { SettingsSectionWrapper } from './SettingsSectionWrapper';

// ---------------------------------------------------------------------------
// Shared section props (reused by General, Display, Advanced, Hooks)
// ---------------------------------------------------------------------------

/** 各父 scope 的設定快照，供 override badge 跨層比對最近覆寫層。 */
export type ParentSettings = Partial<Record<PluginScope, ClaudeSettings>>;

export interface SectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  parentSettings?: ParentSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

/** 把各父 scope 的設定 drill 到指定的巢狀父物件（如 permissions），供巢狀欄位跨層比對。 */
function drillParents(parentSettings: ParentSettings | undefined, parentKey: string): Partial<Record<PluginScope, Record<string, unknown>>> {
  const out: Partial<Record<PluginScope, Record<string, unknown>>> = {};
  for (const [s, scopeSettings] of Object.entries(parentSettings ?? {})) {
    out[s as PluginScope] = ((scopeSettings as Record<string, unknown> | undefined)?.[parentKey] ?? {}) as Record<string, unknown>;
  }
  return out;
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
    parentSettings,
    onSave,
    onDelete,
  }: Pick<SectionProps, 'scope' | 'settings' | 'parentSettings' | 'onSave' | 'onDelete'>,
): ResolvedSchemaFieldBindings | null {
  const schema = getFlatFieldSchema(key) as FlatFieldSchema | undefined;
  if (!schema) return null;

  if (schema.nestedUnder) {
    const parentKey = schema.nestedUnder;
    const parent = ((settings as Record<string, unknown>)[parentKey] ?? {}) as Record<string, unknown>;
    const value = parent[key];

    return {
      schema,
      value,
      onSave: async (_k: string, newValue: unknown) => {
        await onSave(parentKey, { ...parent, [key]: newValue });
      },
      onDelete: async (_k: string) => {
        const updated = { ...parent };
        delete updated[key];
        await onSave(parentKey, updated);
      },
      overriddenScope: getOverriddenScope(scope, drillParents(parentSettings, parentKey), key, value),
    } as ResolvedSchemaFieldBindings;
  }

  const value = (settings as Record<string, unknown>)[key];
  return {
    schema,
    value,
    onSave,
    onDelete,
    overriddenScope: getOverriddenScope(scope, (parentSettings ?? {}) as Partial<Record<PluginScope, Record<string, unknown>>>, key, value),
  } as ResolvedSchemaFieldBindings;
}

export function SchemaSection({
  section,
  scope,
  settings,
  parentSettings,
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
        const field = getSchemaFieldBindings(key, { scope, settings, parentSettings, onSave, onDelete });
        if (!field) return null;
        const { schema, value, onSave: fieldOnSave, onDelete: fieldOnDelete, overriddenScope } = field;

        const custom = renderCustom?.(key, { scope, settings, overriddenScope, onSave: fieldOnSave, onDelete: fieldOnDelete });
        if (custom !== undefined && custom !== null) {
          return <React.Fragment key={key}>{custom}</React.Fragment>;
        }

        if (schema.controlType === Object) {
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
