import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sendRequest } from '../../vscode';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PageHeader } from '../../components/PageHeader';
import { useI18n } from '../../i18n/I18nContext';
import { PermissionsSection } from './PermissionsSection';
import { CustomizedPermissionsEditor } from './CustomizedPermissionsEditor';
import { EnvSection, EnvFieldRenderer } from './EnvSection';
import { HooksSection } from './HooksSection';
import { GeneralSection } from './GeneralSection';
import { DisplaySection } from './DisplaySection';
import { AdvancedSection } from './AdvancedSection';
import type { PluginScope, ClaudeSettings } from '../../../shared/types';
import { CLAUDE_SETTINGS_SCHEMA, getFlatFieldSchema, getSettingsSections, getValueSchemaEnumOptions, getSectionFieldOrder, getAllFlatFieldSchemas, type SettingsSection, type FlatFieldSchema } from '../../../shared/claude-settings-schema';
import { KNOWN_ENV_VARS } from '../../../shared/known-env-vars';
import { usePushSyncedResource } from '../../hooks/usePushSyncedResource';
import { SettingsSectionWrapper } from './components/SettingsSectionWrapper';
import { UnknownSettingsSection, getUnknownSettingsEntries } from './components/UnknownSettingsSection';
import { SchemaFieldRenderer } from './components/SchemaFieldRenderer';
import { getSchemaFieldBindings } from './components/SchemaSection';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPES: PluginScope[] = ['user', 'project', 'local'];
const SETTINGS_NAV_SECTIONS = getSettingsSections();
const PERMISSIONS_NESTED_KEYS = new Set(
  Object.entries(getAllFlatFieldSchemas())
    .filter(([, s]) => s.nestedUnder === 'permissions')
    .map(([key]) => key),
);

function collectCustomizedSchemaFields(
  settings: ClaudeSettings,
  scope: PluginScope,
): Array<{ key: string; section: SettingsSection }> {
  const noop = async () => {};
  const result: Array<{ key: string; section: SettingsSection }> = [];
  for (const section of SETTINGS_NAV_SECTIONS) {
    for (const key of getSectionFieldOrder(section)) {
      const binding = getSchemaFieldBindings(key, {
        scope,
        settings,
        // Only binding.value is used for inclusion; value does not depend on userSettings.
        // overriddenScope (the only userSettings consumer) is computed with real userSettings at render time.
        userSettings: {} as ClaudeSettings,
        onSave: noop,
        onDelete: noop,
      });
      if (binding && binding.value !== undefined) {
        if (key === 'permissions') {
          const perms = (settings.permissions as Record<string, unknown> | undefined) ?? {};
          const hasNonNested = Object.keys(perms).some((k) => !PERMISSIONS_NESTED_KEYS.has(k));
          if (!hasNonNested) continue;
        }
        result.push({ key, section });
      }
    }
  }
  return result;
}

type SettingsNavItem = SettingsSection | 'customized';

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
// Shared schema-field result renderer (search + customized)
// ---------------------------------------------------------------------------

function renderSchemaResultRow({
  fieldKey,
  sectionLabel,
  labelText,
  description,
  schema,
  value,
  scope,
  overriddenScope,
  onSave,
  onDelete,
  onNavigate,
}: {
  fieldKey: string;
  sectionLabel: string;
  labelText: string;
  description?: string;
  schema: FlatFieldSchema;
  value: unknown;
  scope: PluginScope;
  overriddenScope?: PluginScope;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  onNavigate: () => void;
}): React.ReactElement {
  if (schema.controlType === Object) {
    return (
      <div key={fieldKey} className="settings-search-result">
        <span className="settings-search-result-section">{sectionLabel}</span>
        <div className="settings-field">
          <label className="settings-label">{labelText}</label>
          {description && <p className="settings-field-description">{description}</p>}
          <button className="btn btn-secondary" onClick={onNavigate}>
            {labelText} →
          </button>
        </div>
      </div>
    );
  }
  return (
    <div key={fieldKey} className="settings-search-result">
      <span className="settings-search-result-section">{sectionLabel}</span>
      <SchemaFieldRenderer
        settingKey={fieldKey}
        schema={schema}
        value={value}
        scope={scope}
        overriddenScope={overriddenScope}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
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

  const loadScopeCounts = useCallback(async (): Promise<{ project: number; local: number }> => {
    if (!hasWorkspace) {
      return { project: 0, local: 0 };
    }
    const [projectSettings, localSettings] = await Promise.all([
      sendRequest<ClaudeSettings>({ type: 'settings.get', scope: 'project' }),
      sendRequest<ClaudeSettings>({ type: 'settings.get', scope: 'local' }),
    ]);
    const countFor = (s: PluginScope, scopeSettings: ClaudeSettings) =>
      collectCustomizedSchemaFields(scopeSettings ?? {} as ClaudeSettings, s).length
      + getUnknownSettingsEntries(scopeSettings ?? {} as ClaudeSettings).length;
    return {
      project: countFor('project', projectSettings),
      local: countFor('local', localSettings),
    };
  }, [hasWorkspace]);

  const { data: counts, setData: setCounts } = usePushSyncedResource<{ project: number; local: number }>({
    initialData: { project: 0, local: 0 },
    load: loadScopeCounts,
    pushFilter: useCallback((msg: { type?: string }) => msg.type === 'settings.refresh', []),
  });

  const handleSave = useCallback(async (key: string, value: unknown): Promise<void> => {
    await sendRequest({ type: 'settings.set', scope, key, value });
    setData((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
    if (scope === 'project' || scope === 'local') {
      const next = { ...settings, [key]: value };
      setCounts((prev) => ({
        ...prev,
        [scope]: collectCustomizedSchemaFields(next, scope).length
          + getUnknownSettingsEntries(next).length,
      }));
    }
  }, [scope, setData, setCounts, settings]);

  const handleDelete = useCallback(async (key: string): Promise<void> => {
    await sendRequest({ type: 'settings.delete', scope, key });
    setData((prev) => {
      const rest = { ...prev.settings } as Record<string, unknown>;
      delete rest[key];
      return { ...prev, settings: rest as ClaudeSettings };
    });
    if (scope === 'project' || scope === 'local') {
      const next = { ...settings } as Record<string, unknown>;
      delete next[key];
      setCounts((prev) => ({
        ...prev,
        [scope]: collectCustomizedSchemaFields(next as ClaudeSettings, scope).length
          + getUnknownSettingsEntries(next as ClaudeSettings).length,
      }));
    }
  }, [scope, setData, setCounts, settings]);

  const handleScopeClick = (s: PluginScope): void => {
    if (s !== 'user' && !hasWorkspace) return;
    setScope(s);
  };

  const navItems: { id: SettingsNavItem; label: string }[] = [
    ...SETTINGS_NAV_SECTIONS.map((section) => ({
      id: section as SettingsNavItem,
      label: t(`settings.nav.${section}` as Parameters<typeof t>[0]),
    })),
    { id: 'customized' as SettingsNavItem, label: t('settings.nav.customized') },
  ];

  // Customized tab: schema fields whose value is set in current scope settings
  const customizedFields = useMemo(
    () => collectCustomizedSchemaFields(settings, scope),
    [scope, settings],
  );

  const unknownCount = useMemo(
    () => getUnknownSettingsEntries(settings).length,
    [settings],
  );

  return (
    <div className="page-container settings-page settings-page--fixed-shell">
      <PageHeader title={t('settings.page.title')} subtitle={t('settings.page.subtitle')} />

      {/* Scope tabs + Search */}
      <div className="settings-scope-tabs settings-scope-tabs--fixed">
        {SCOPES.map((s) => {
          const disabled = s !== 'user' && !hasWorkspace;
          const count = s === 'project' ? counts.project : s === 'local' ? counts.local : 0;
          return (
            <button
              key={s}
              className={`settings-scope-tab${scope === s ? ' settings-scope-tab--active' : ''}${disabled ? ' settings-scope-tab--disabled' : ''}`}
              onClick={() => handleScopeClick(s)}
              disabled={disabled}
              title={disabled ? t('settings.scope.noWorkspace') : undefined}
            >
              {t(`settings.scope.${s}` as Parameters<typeof t>[0])}
              {(s === 'project' || s === 'local') && count >= 1 && (
                <span className="settings-scope-badge">{count}</span>
              )}
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
                            onEnvChange={(updatedEnv) => handleSave('env', updatedEnv)}
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
                    const sectionLabel = t(`settings.nav.${field.section}` as Parameters<typeof t>[0]);
                    return renderSchemaResultRow({
                      fieldKey: field.key,
                      sectionLabel,
                      labelText: field.label || field.key,
                      description: field.description,
                      schema,
                      value,
                      scope,
                      overriddenScope,
                      onSave,
                      onDelete,
                      onNavigate: () => { setSearchQuery(''); setActiveNav(field.section as SettingsNavItem); },
                    });
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
              {activeNav === 'customized' && (
                customizedFields.length === 0 && unknownCount === 0 ? (
                  <SettingsSectionWrapper>
                    <p className="settings-search-empty">{t('settings.customized.empty')}</p>
                  </SettingsSectionWrapper>
                ) : (
                  <>
                    <SettingsSectionWrapper>
                      {customizedFields.map(({ key, section }) => {
                        const fieldBindings = getSchemaFieldBindings(key, {
                          scope,
                          settings,
                          userSettings,
                          onSave: handleSave,
                          onDelete: handleDelete,
                        });
                        if (!fieldBindings) return null;
                        const { schema, value, onSave: fieldOnSave, onDelete: fieldOnDelete, overriddenScope } = fieldBindings;
                        const sectionLabel = t(`settings.nav.${section}` as Parameters<typeof t>[0]);
                        const fieldLabel = t(`settings.${section}.${key}.label` as Parameters<typeof t>[0]) || key;

                        if (key === 'permissions') {
                          return (
                            <div key={key} className="settings-search-result">
                              <span className="settings-search-result-section">{sectionLabel}</span>
                              <CustomizedPermissionsEditor
                                perms={value as ClaudeSettings['permissions'] ?? {}}
                                onSavePermissions={(p) => fieldOnSave('permissions', p)}
                                scope={scope}
                              />
                            </div>
                          );
                        }

                        return renderSchemaResultRow({
                          fieldKey: key,
                          sectionLabel,
                          labelText: fieldLabel,
                          schema,
                          value,
                          scope,
                          overriddenScope,
                          onSave: fieldOnSave,
                          onDelete: fieldOnDelete,
                          onNavigate: () => setActiveNav(section as SettingsNavItem),
                        });
                      })}
                    </SettingsSectionWrapper>
                    <UnknownSettingsSection
                      scope={scope}
                      settings={settings}
                      onSave={handleSave}
                      onDelete={handleDelete}
                    />
                  </>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
