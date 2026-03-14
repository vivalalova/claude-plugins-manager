import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ClaudeSettings, PluginScope } from '../../../shared/types';
import { CLAUDE_SETTINGS_SCHEMA } from '../../../shared/claude-settings-schema';
import { SchemaFieldRenderer } from './components/SchemaFieldRenderer';

// ---------------------------------------------------------------------------
// GeneralSection
// ---------------------------------------------------------------------------

/** 欄位渲染順序（與改造前一致） */
export const GENERAL_FIELD_ORDER: (keyof ClaudeSettings)[] = [
  'effortLevel',
  'language',
  'availableModels',
  'enableAllProjectMcpServers',
  'includeGitInstructions',
  'respectGitignore',
  'fastMode',
  'fastModePerSessionOptIn',
  'autoMemoryEnabled',
  'alwaysThinkingEnabled',
  'outputStyle',
  'autoUpdatesChannel',
  'cleanupPeriodDays',
];

interface GeneralSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function GeneralSection({ scope, settings, onSave, onDelete }: GeneralSectionProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.general')}</h3>
      <p className="settings-field-description">
        {t('settings.general.docsHint')}
        <a href="https://code.claude.com/docs/en/settings" target="_blank" rel="noreferrer" className="settings-docs-link">
          {t('settings.general.docsLinkText')}
        </a>
      </p>

      {GENERAL_FIELD_ORDER.map((key) => {
        const schema = CLAUDE_SETTINGS_SCHEMA[key];
        if (!schema) return null;
        return (
          <SchemaFieldRenderer
            key={key}
            settingKey={key}
            schema={schema}
            value={(settings as Record<string, unknown>)[key]}
            scope={scope}
            onSave={onSave}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}
