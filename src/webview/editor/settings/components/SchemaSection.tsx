import React from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../../shared/types';
import { SETTINGS_FLAT_SCHEMA, getSectionFieldOrder, type SettingsSection } from '../../../../shared/claude-settings-schema';
import { SchemaFieldRenderer } from './SchemaFieldRenderer';
import { getOverriddenScope } from './SettingControls';

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
  titleKey: string;
  section: SettingsSection;
  renderCustom?: (key: string, props: { scope: PluginScope; settings: ClaudeSettings; overriddenScope?: PluginScope; onSave: SectionProps['onSave']; onDelete: SectionProps['onDelete'] }) => React.ReactNode | null;
  headerContent?: React.ReactNode;
}

export function SchemaSection({
  titleKey,
  section,
  scope,
  settings,
  userSettings,
  onSave,
  onDelete,
  renderCustom,
  headerContent,
}: SchemaSectionProps): React.ReactElement {
  const { t } = useI18n();
  const fieldOrder = getSectionFieldOrder(section);

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t(titleKey as Parameters<typeof t>[0])}</h3>
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
    </div>
  );
}
