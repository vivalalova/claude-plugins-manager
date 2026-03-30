import React from 'react';
import type { ClaudeSettings, PluginScope } from '../../../../shared/types';
import { SETTINGS_FLAT_SCHEMA, getSectionFieldOrder, type SettingsSection } from '../../../../shared/claude-settings-schema';
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
        const schema = SETTINGS_FLAT_SCHEMA[key];
        if (!schema) return null;
        const overriddenScope = getOverriddenScope(scope, userSettings as Record<string, unknown>, key);

        if (schema.controlType === Object) {
          const custom = renderCustom?.(key, { scope, settings, overriddenScope, onSave, onDelete });
          if (custom !== undefined) return <React.Fragment key={key}>{custom}</React.Fragment>;
          console.warn(`[SchemaSection] Unhandled custom key: ${key}`);
          return null;
        }

        return (
          <SchemaFieldRenderer
            key={key}
            settingKey={key}
            schema={schema}
            value={(settings as Record<string, unknown>)[key]}
            scope={scope}
            overriddenScope={overriddenScope}
            onSave={onSave}
            onDelete={onDelete}
          />
        );
      })}
    </SettingsSectionWrapper>
  );
}
