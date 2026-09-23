import React from 'react';
import type { ClaudeSettings, PluginScope } from '../../../../shared/types';
import { getFlatFieldSchema, getSectionFieldOrder, isScopeEffective, type FlatFieldSchema, type SettingsSection } from '../../../../shared/claude-settings-schema';
import { SchemaFieldRenderer } from './SchemaFieldRenderer';
import { resolveInherited, type Inherited } from './SettingControls';
import type { NestedParentKey } from '../../../../shared/nestedSettings';
import { SettingsSectionWrapper } from './SettingsSectionWrapper';

// ---------------------------------------------------------------------------
// Shared section props (reused by General, Display, Advanced, Hooks)
// ---------------------------------------------------------------------------

/** 各父 scope 的設定快照，供 override badge 與繼承判斷跨層比對。undefined＝尚未就緒（未知），{}＝已載入但都沒設。 */
export type ParentSettings = Partial<Record<PluginScope, ClaudeSettings>>;

export interface SectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  parentSettings: ParentSettings | undefined;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  /** 巢狀父物件只改一格（`settings.setNested`）；webview 不展開父物件整包寫回 */
  onSaveNested: (parentKey: NestedParentKey, childKey: string, value: unknown) => Promise<void>;
  /** 巢狀父物件只刪一格（`settings.deleteNested`）；父物件變空由擴展端刪父 key */
  onDeleteNested: (parentKey: NestedParentKey, childKey: string) => Promise<void>;
}

/**
 * 把各父 scope 的設定 drill 到指定的巢狀父物件（如 permissions），供巢狀欄位跨層比對。
 * 未知（undefined）維持未知；父物件不是 object 時視為沒設（{}）。
 */
export function drillParents(parentSettings: ParentSettings | undefined, parentKey: string): Partial<Record<PluginScope, Record<string, unknown>>> | undefined {
  if (parentSettings === undefined) return undefined;
  const out: Partial<Record<PluginScope, Record<string, unknown>>> = {};
  for (const [s, scopeSettings] of Object.entries(parentSettings)) {
    const nested = (scopeSettings as Record<string, unknown> | undefined)?.[parentKey];
    out[s as PluginScope] = nested !== null && typeof nested === 'object' && !Array.isArray(nested)
      ? nested as Record<string, unknown>
      : {};
  }
  return out;
}

// ---------------------------------------------------------------------------
// SchemaSection — generic schema-driven section renderer
// ---------------------------------------------------------------------------

interface SchemaSectionProps extends SectionProps {
  section: SettingsSection;
  renderCustom?: (key: string, props: { scope: PluginScope; settings: ClaudeSettings; parentSettings: ParentSettings | undefined; overriddenScope?: PluginScope; onSave: SectionProps['onSave']; onDelete: SectionProps['onDelete'] }) => React.ReactNode | null;
  headerContent?: React.ReactNode;
}

interface ResolvedSchemaFieldBindings {
  schema: FlatFieldSchema;
  value: unknown;
  onSave: SectionProps['onSave'];
  onDelete: SectionProps['onDelete'];
  overriddenScope?: PluginScope;
  inherited: Inherited;
}

/** 欄位只在會生效的 scope 可見（globalConfig 與 effectiveScopes 登錄，見 isScopeEffective）。 */
export function isFieldVisibleForScope(schema: FlatFieldSchema, scope: PluginScope): boolean {
  return isScopeEffective(schema, scope);
}

export function getSchemaFieldBindings(
  key: string,
  {
    scope,
    settings,
    parentSettings,
    onSave,
    onDelete,
    onSaveNested,
    onDeleteNested,
  }: Pick<SectionProps, 'scope' | 'settings' | 'onSave' | 'onDelete' | 'onSaveNested' | 'onDeleteNested'> & { parentSettings: ParentSettings | undefined },
): ResolvedSchemaFieldBindings | null {
  const schema = getFlatFieldSchema(key) as FlatFieldSchema | undefined;
  if (!schema) return null;
  if (!isFieldVisibleForScope(schema, scope)) return null;

  if (schema.nestedUnder) {
    // flat schema 的 nestedUnder 型別是 string；字面值集合即 NestedParentKey（schema 衍生）
    const parentKey = schema.nestedUnder as NestedParentKey;
    const parent = ((settings as Record<string, unknown>)[parentKey] ?? {}) as Record<string, unknown>;
    const value = parent[key];
    const parents = drillParents(parentSettings, parentKey);
    const inherited = resolveInherited(scope, parents, key);

    return {
      schema,
      value,
      onSave: async (_k: string, newValue: unknown) => {
        await onSaveNested(parentKey, key, newValue);
      },
      onDelete: async (_k: string) => {
        await onDeleteNested(parentKey, key);
      },
      overriddenScope: value !== undefined && inherited.kind === 'known' ? inherited.scope : undefined,
      inherited,
    } as ResolvedSchemaFieldBindings;
  }

  const value = (settings as Record<string, unknown>)[key];
  const inherited = resolveInherited(scope, parentSettings, key);
  return {
    schema,
    value,
    onSave,
    onDelete,
    overriddenScope: value !== undefined && inherited.kind === 'known' ? inherited.scope : undefined,
    inherited,
  } as ResolvedSchemaFieldBindings;
}

export function SchemaSection({
  section,
  scope,
  settings,
  parentSettings,
  onSave,
  onDelete,
  onSaveNested,
  onDeleteNested,
  renderCustom,
  headerContent,
}: SchemaSectionProps): React.ReactElement {
  const fieldOrder = getSectionFieldOrder(section);

  return (
    <SettingsSectionWrapper>
      {headerContent}

      {fieldOrder.map((key) => {
        const field = getSchemaFieldBindings(key, { scope, settings, parentSettings, onSave, onDelete, onSaveNested, onDeleteNested });
        if (!field) return null;
        const { schema, value, onSave: fieldOnSave, onDelete: fieldOnDelete, overriddenScope, inherited } = field;

        const custom = renderCustom?.(key, { scope, settings, parentSettings, overriddenScope, onSave: fieldOnSave, onDelete: fieldOnDelete });
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
            inherited={inherited}
            onSave={fieldOnSave}
            onDelete={fieldOnDelete}
          />
        );
      })}
    </SettingsSectionWrapper>
  );
}
