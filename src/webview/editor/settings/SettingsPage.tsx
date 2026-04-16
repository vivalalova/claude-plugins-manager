import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sendRequest } from '../../vscode';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PageHeader } from '../../components/PageHeader';
import { useI18n } from '../../i18n/I18nContext';
import { PermissionsSection } from './PermissionsSection';
import { EnvSection, EnvFieldRenderer } from './EnvSection';
import { HooksSection } from './HooksSection';
import { GeneralSection } from './GeneralSection';
import { DisplaySection } from './DisplaySection';
import { AdvancedSection } from './AdvancedSection';
import type { PluginScope, ClaudeSettings } from '../../../shared/types';
import { CLAUDE_SETTINGS_SCHEMA, getFlatFieldSchema, getSettingsSections, getValueSchemaEnumOptions, type SettingsSection } from '../../../shared/claude-settings-schema';
import { KNOWN_ENV_VARS } from '../../../shared/known-env-vars';
import { usePushSyncedResource } from '../../hooks/usePushSyncedResource';
import { SettingsSectionWrapper } from './components/SettingsSectionWrapper';
import { UnknownSettingsSection } from './components/UnknownSettingsSection';
import { SchemaFieldRenderer } from './components/SchemaFieldRenderer';
import { getSchemaFieldBindings } from './components/SchemaSection';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPES: PluginScope[] = ['user', 'project', 'local'];
const SETTINGS_NAV_SECTIONS = getSettingsSections();

type SettingsNavItem = SettingsSection;

// ---------------------------------------------------------------------------
// Search types & helpers
// ---------------------------------------------------------------------------

interface SearchableField {
  key: string;
  section: SettingsSection;
  label: string;
  description: string;
  isEnvVar?: boolean;
  optionLabels?: string[];
}

function buildSearchableFields(t: (key: Parameters<ReturnType<typeof useI18n>['t']>[0]) => string): SearchableField[] {
  const fields: SearchableField[] = [];

  // Schema-driven fields
  for (const section of SETTINGS_NAV_SECTIONS) {
    for (const entry of CLAUDE_SETTINGS_SCHEMA[section]) {
      const flatField = getFlatFieldSchema(entry.key);
      const labelKey = `settings.${section}.${entry.key}.label` as Parameters<typeof t>[0];
      const descKey = `settings.${section}.${entry.key}.description` as Parameters<typeof t>[0];
      const label = t(labelKey) ?? '';
      const description = t(descKey) ?? '';
      const enumOptions = flatField ? getValueSchemaEnumOptions(flatField.valueSchema) : undefined;
      const optionLabels: string[] | undefined = enumOptions
        ? enumOptions.map(opt => {
            const optKey = `settings.${section}.${entry.key}.${opt}` as Parameters<typeof t>[0];
            return t(optKey) ?? opt;
          })
        : undefined;
      fields.push({
        key: entry.key,
        section,
        label,
        description,
        optionLabels,
      });
    }
  }

  // Known env vars
  for (const envKey of Object.keys(KNOWN_ENV_VARS)) {
    const descKey = `settings.env.knownVars.${envKey}.description` as Parameters<typeof t>[0];
    const description = t(descKey) ?? '';
    fields.push({
      key: envKey,
      section: 'env',
      label: envKey,
      description,
      isEnvVar: true,
    });
  }

  return fields;
}

function matchesSearch(field: SearchableField, query: string): boolean {
  const q = query.toLowerCase();
  return (
    field.key.toLowerCase().includes(q) ||
    (field.label?.toLowerCase().includes(q) ?? false) ||
    (field.description?.toLowerCase().includes(q) ?? false) ||
    (field.optionLabels?.some(l => l.toLowerCase().includes(q)) ?? false)
  );
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export function SettingsPage(): React.ReactElement {
  const { t } = useI18n();

  const [scope, setScope] = useState<PluginScope>('user');
  const [activeNav, setActiveNav] = useState<SettingsNavItem>(SETTINGS_NAV_SECTIONS[0] ?? 'general');
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Build searchable fields from schema + i18n
  const searchableFields = useMemo(() => buildSearchableFields(t), [t]);

  // Filter fields by search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchableFields.filter((f) => matchesSearch(f, searchQuery.trim()));
  }, [searchableFields, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  // Check workspace availability
  useEffect(() => {
    sendRequest<{ name: string; path: string }[]>({ type: 'workspace.getFolders' })
      .then((folders) => setHasWorkspace(folders.length > 0))
      .catch(() => setHasWorkspace(false));
  }, []);

  const loadSettings = useCallback(async () => {
      const [data, userData] = await Promise.all([
        sendRequest<ClaudeSettings>({ type: 'settings.get', scope }),
        scope !== 'user'
          ? sendRequest<ClaudeSettings>({ type: 'settings.get', scope: 'user' })
          : Promise.resolve({} as ClaudeSettings),
      ]);
    return { settings: data, userSettings: userData };
  }, [scope]);

  const {
    data,
    loading,
    error,
    setError,
    setData,
  } = usePushSyncedResource<{ settings: ClaudeSettings; userSettings: ClaudeSettings }>({
    initialData: { settings: {}, userSettings: {} },
    load: loadSettings,
    pushFilter: useCallback((msg: { type?: string }) => msg.type === 'settings.refresh', []),
  });
  const settings = data.settings;
  const userSettings = data.userSettings;

  const handleSave = useCallback(async (key: string, value: unknown): Promise<void> => {
    await sendRequest({ type: 'settings.set', scope, key, value });
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  }, [scope, setData]);

  const handleDelete = useCallback(async (key: string): Promise<void> => {
    await sendRequest({ type: 'settings.delete', scope, key });
    setData((prev) => {
      const { [key]: _, ...rest } = prev.settings as Record<string, unknown>;
      return {
        ...prev,
        settings: rest as ClaudeSettings,
      };
    });
  }, [scope, setData]);

  const handleScopeClick = (s: PluginScope): void => {
    if (s !== 'user' && !hasWorkspace) return;
    setScope(s);
  };

  const navItems: { id: SettingsNavItem; label: string }[] = SETTINGS_NAV_SECTIONS.map((section) => ({
    id: section,
    label: t(`settings.nav.${section}` as Parameters<typeof t>[0]),
  }));

  return (
    <div className="page-container settings-page settings-page--fixed-shell">
      <PageHeader title={t('settings.page.title')} subtitle={t('settings.page.subtitle')} />

      {/* Scope tabs + Search */}
      <div className="settings-scope-tabs settings-scope-tabs--fixed">
        {SCOPES.map((s) => {
          const disabled = s !== 'user' && !hasWorkspace;
          return (
            <button
              key={s}
              className={`settings-scope-tab${scope === s ? ' settings-scope-tab--active' : ''}${disabled ? ' settings-scope-tab--disabled' : ''}`}
              onClick={() => handleScopeClick(s)}
              disabled={disabled}
              title={disabled ? t('settings.scope.noWorkspace') : undefined}
            >
              {t(`settings.scope.${s}` as Parameters<typeof t>[0])}
            </button>
          );
        })}

        <span className="settings-scope-docs-hint">
          {t('settings.general.docsHint')}
          <a href="https://github.com/vivalalova/claude-plugins-manager/tree/main/.claude/skills/update-settings-options" target="_blank" rel="noreferrer" className="settings-docs-link settings-docs-skill-name">{t('settings.general.docsSkillName')}</a>
          {t('settings.general.docsHintMiddle')}
          <a href="https://json.schemastore.org/claude-code-settings.json" target="_blank" rel="noreferrer" className="settings-docs-link">
            {t('settings.general.docsLinkText')}
          </a>
          {t('settings.general.docsHintSuffix')}
        </span>
      </div>

      <div className="settings-body settings-body--fixed-shell">
        {/* Left nav with search */}
        <div className="settings-nav-container">
          {/* Search input - always visible */}
          <div className="settings-search-wrapper">
            <input
              type="text"
              className="input settings-search-input"
              placeholder={t('settings.search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="settings-search-clear"
                onClick={() => setSearchQuery('')}
                title={t('settings.search.clear')}
              >
                ×
              </button>
            )}
          </div>

          {/* Nav items - hidden when searching */}
          {!isSearching && (
            <nav className="settings-nav settings-nav--fixed settings-nav--compact">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className={`settings-nav-item${activeNav === item.id ? ' settings-nav-item--active' : ''}`}
                  onClick={() => setActiveNav(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Content */}
        <div className={`settings-content settings-content--scrollable${isSearching ? ' settings-content--full-width' : ''}`}>
          {loading && (
            <p className="settings-loading">{t('settings.loading')}</p>
          )}
          {error && (
            <ErrorBanner message={`${t('settings.error.load')}: ${error}`} onDismiss={() => setError(null)} />
          )}
          {!loading && !error && isSearching && (
            <SettingsSectionWrapper>
              {searchResults.length === 0 ? (
                <p className="settings-search-empty">{t('settings.search.noResults')}</p>
              ) : (
                <>
                  <p className="settings-search-count">
                    {t('settings.search.resultCount', { count: searchResults.length })}
                  </p>
                  {searchResults.map((field) => {
                    // Env var: use EnvFieldRenderer
                    if (field.isEnvVar) {
                      const currentEnv = (settings.env as Record<string, string>) ?? {};
                      return (
                        <div key={field.key} className="settings-search-result">
                          <span className="settings-search-result-section">{t('settings.nav.env')}</span>
                          <EnvFieldRenderer
                            envKey={field.key}
                            currentEnv={currentEnv}
                            scope={scope}
                            onEnvChange={(updatedEnv) => void handleSave('env', updatedEnv)}
                          />
                        </div>
                      );
                    }

                    // Schema field
                    const fieldBindings = getSchemaFieldBindings(field.key, {
                      scope,
                      settings,
                      userSettings,
                      onSave: handleSave,
                      onDelete: handleDelete,
                    });
                    if (!fieldBindings) return null;
                    const { schema, value, onSave, onDelete, overriddenScope } = fieldBindings;

                    // Object type (custom control) — show navigate-to-section card
                    if (schema.controlType === Object) {
                      const sectionLabel = t(`settings.nav.${field.section}` as Parameters<typeof t>[0]);
                      return (
                        <div key={field.key} className="settings-search-result">
                          <span className="settings-search-result-section">{sectionLabel}</span>
                          <div className="settings-field">
                            <label className="settings-label">{field.label || field.key}</label>
                            {field.description && <p className="settings-field-description">{field.description}</p>}
                            <button
                              className="btn btn-secondary"
                              onClick={() => { setSearchQuery(''); setActiveNav(field.section as SettingsNavItem); }}
                            >
                              {sectionLabel} →
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={field.key} className="settings-search-result">
                        <span className="settings-search-result-section">{t(`settings.nav.${field.section}` as Parameters<typeof t>[0])}</span>
                        <SchemaFieldRenderer
                          settingKey={field.key}
                          schema={schema}
                          value={value}
                          scope={scope}
                          overriddenScope={overriddenScope}
                          onSave={onSave}
                          onDelete={onDelete}
                        />
                      </div>
                    );
                  })}
                </>
              )}
            </SettingsSectionWrapper>
          )}
          {!loading && !error && !isSearching && (
            <>
              {activeNav === 'permissions' && (
                <PermissionsSection
                  scope={scope}
                  settings={settings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
              {activeNav === 'env' && (
                <EnvSection
                  scope={scope}
                  settings={settings}
                  userSettings={userSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
              {activeNav === 'hooks' && (
                <HooksSection
                  scope={scope}
                  settings={settings}
                  userSettings={userSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
              {activeNav === 'general' && (
                <GeneralSection
                  scope={scope}
                  settings={settings}
                  userSettings={userSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
              {activeNav === 'display' && (
                <DisplaySection
                  scope={scope}
                  settings={settings}
                  userSettings={userSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
              {activeNav === 'advanced' && (
                <AdvancedSection
                  scope={scope}
                  settings={settings}
                  userSettings={userSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
              {activeNav === 'advanced' && (
                <UnknownSettingsSection
                  scope={scope}
                  settings={settings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
