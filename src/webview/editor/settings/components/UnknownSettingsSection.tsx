import React, { useMemo } from 'react';
import type { ClaudeSettings, PluginScope } from '../../../../shared/types';
import { getFlatFieldSchema } from '../../../../shared/claude-settings-schema';
import { TextSetting } from './SettingControls';
import { SettingsSectionWrapper } from './SettingsSectionWrapper';
import { useI18n } from '../../../i18n/I18nContext';

// ---------------------------------------------------------------------------
// UnknownSettingsSection — displays settings keys not in the schema
// ---------------------------------------------------------------------------

/** 由 extension 內部管理、不需顯示在 UI 的 key */
const HIDDEN_UNKNOWN_KEYS = new Set([
  '$schema',
  'enabledPlugins',
  'feedbackSurveyState',
]);

interface UnknownSettingsSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function serializeValue(value: unknown): string {
  return JSON.stringify(value);
}

function deserializeValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function UnknownSettingsSection({
  scope,
  settings,
  onSave,
  onDelete,
}: UnknownSettingsSectionProps): React.ReactElement | null {
  const { t } = useI18n();

  const unknownEntries = useMemo(
    () =>
      Object.entries(settings as Record<string, unknown>).filter(
        ([key, v]) => getFlatFieldSchema(key) === undefined && v !== undefined && !HIDDEN_UNKNOWN_KEYS.has(key),
      ),
    [settings],
  );

  if (unknownEntries.length === 0) return null;

  return (
    <SettingsSectionWrapper>
      <div className="unknown-settings-header">
        <span className="settings-section-title">{t('settings.unknown.title')}</span>
        <span className="unknown-settings-description">{t('settings.unknown.description')}</span>
      </div>
      {unknownEntries.map(([key, value]) => (
        <TextSetting
          key={key}
          label={key}
          value={serializeValue(value)}
          placeholder=""
          saveLabel={t('settings.common.save')}
          clearLabel={t('settings.common.clear')}
          settingKey={key}
          scope={scope}
          onSave={async (k, raw) => onSave(k, deserializeValue(raw as string))}
          onDelete={onDelete}
        />
      ))}
    </SettingsSectionWrapper>
  );
}
