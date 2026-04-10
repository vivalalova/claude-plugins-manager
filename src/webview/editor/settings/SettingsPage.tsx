import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sendRequest } from '../../vscode';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PageHeader } from '../../components/PageHeader';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import { useSettingSave } from './hooks/useSettingSave';
import { PermissionsSection } from './PermissionsSection';
import { EnvSection, EnvFieldRenderer } from './EnvSection';
import { HooksSection } from './HooksSection';
import { GeneralSection } from './GeneralSection';
import { DisplaySection } from './DisplaySection';
import { AdvancedSection } from './AdvancedSection';
import { SettingLabelText, getOverriddenScope } from './components/SettingControls';
import type { PluginScope, ClaudeSettings } from '../../../shared/types';
import { KNOWN_MODEL_OPTIONS, CLAUDE_SETTINGS_SCHEMA, SETTINGS_FLAT_SCHEMA, type SettingsSection } from '../../../shared/claude-settings-schema';
import { KNOWN_ENV_VARS } from '../../../shared/known-env-vars';
import { usePushSyncedResource } from '../../hooks/usePushSyncedResource';
import { useObjectEditorState } from './components/ObjectSetting';
import { SettingsSectionWrapper } from './components/SettingsSectionWrapper';
import { UnknownSettingsSection } from './components/UnknownSettingsSection';
import { SchemaFieldRenderer } from './components/SchemaFieldRenderer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPES: PluginScope[] = ['user', 'project', 'local'];

type SettingsNavItem = 'model' | 'permissions' | 'env' | 'hooks' | 'general' | 'display' | 'advanced';

// ---------------------------------------------------------------------------
// Search types & helpers
// ---------------------------------------------------------------------------

interface SearchableField {
  key: string;
  section: SettingsSection;
  label: string;
  description: string;
  isEnvVar?: boolean;
}

function buildSearchableFields(t: (key: Parameters<ReturnType<typeof useI18n>['t']>[0]) => string): SearchableField[] {
  const fields: SearchableField[] = [];
  const sections: SettingsSection[] = ['general', 'display', 'advanced', 'permissions', 'hooks'];

  // Schema-driven fields
  for (const section of sections) {
    for (const entry of CLAUDE_SETTINGS_SCHEMA[section]) {
      if (entry.hidden) continue;
      const labelKey = `settings.${section}.${entry.key}.label` as Parameters<typeof t>[0];
      const descKey = `settings.${section}.${entry.key}.description` as Parameters<typeof t>[0];
      const label = t(labelKey) ?? '';
      const description = t(descKey) ?? '';
      fields.push({
        key: entry.key,
        section,
        label,
        description,
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
    (field.description?.toLowerCase().includes(q) ?? false)
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isModelInWhitelist(model: string, availableModels: string[] | undefined): boolean {
  if (!availableModels?.length) return true;
  return availableModels.includes(model);
}

// ---------------------------------------------------------------------------
// ModelSection
// ---------------------------------------------------------------------------

interface ModelSectionProps {
  scope: PluginScope;
  settings: ClaudeSettings;
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

function ModelSection({ scope: _scope, settings, onSave, onDelete }: ModelSectionProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const { saving, withSave } = useSettingSave();

  const currentModel = settings.model ?? '';
  const availableModels = settings.availableModels;
  const createDraft = useCallback(() => {
    const model = settings.model ?? '';
    if (model && !KNOWN_MODEL_OPTIONS.includes(model as typeof KNOWN_MODEL_OPTIONS[number])) {
      return { selectValue: 'custom', customInput: model, showCustom: true };
    }
    return { selectValue: model, customInput: '', showCustom: false };
  }, [settings.model]);
  const [draft, setDraft] = useObjectEditorState(createDraft);

  const handleSelectChange = (val: string): void => {
    if (val === 'custom') {
      setDraft({ selectValue: 'custom', customInput: '', showCustom: true });
    } else {
      setDraft((prev) => ({ ...prev, selectValue: val, showCustom: false }));
    }
  };

  const handleSave = (): void => {
    const modelToSave = draft.showCustom ? draft.customInput.trim() : draft.selectValue;
    void withSave(async () => {
      if (!modelToSave) {
        await onDelete('model');
        addToast(t('settings.model.cleared'), 'success');
      } else {
        await onSave('model', modelToSave);
        addToast(t('settings.model.saved'), 'success');
      }
    });
  };

  const handleClear = (): void => {
    void withSave(async () => {
      await onDelete('model');
      addToast(t('settings.model.cleared'), 'success');
    });
  };

  const outsideWhitelist = currentModel && !isModelInWhitelist(currentModel, availableModels);
  const dropdownModels = availableModels?.length ? availableModels : [...KNOWN_MODEL_OPTIONS];

  return (
    <SettingsSectionWrapper>
      {outsideWhitelist && (
        <div className="settings-warning">
          ⚠️ {t('settings.model.outsideWhitelist')}
        </div>
      )}

      <div className="settings-field">
        <label className="settings-label">
          <SettingLabelText label={t('settings.model.label')} settingKey="model" />
        </label>
        <div className="settings-model-row">
          <select
            className="select settings-model-select"
            value={draft.selectValue}
            onChange={(e) => handleSelectChange(e.target.value)}
            disabled={saving}
          >
            <option value="">{t('settings.model.placeholder')}</option>
            {dropdownModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            {outsideWhitelist && currentModel && !dropdownModels.includes(currentModel) && (
              <option value={currentModel}>{currentModel} ⚠️</option>
            )}
            <option value="custom">{t('settings.model.custom')}</option>
          </select>

          {currentModel && (
            <button
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={saving}
            >
              {t('settings.model.clear')}
            </button>
          )}
        </div>

        {draft.showCustom && (
          <input
            className="input settings-model-custom-input"
            type="text"
            value={draft.customInput}
            onChange={(e) => setDraft((prev) => ({ ...prev, customInput: e.target.value }))}
            placeholder="e.g. claude-opus-4-6"
            disabled={saving}
          />
        )}
      </div>

      <div className="settings-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || (!draft.selectValue && !draft.customInput.trim() && !currentModel)}
        >
          {t('settings.model.save')}
        </button>
      </div>
    </SettingsSectionWrapper>
  );
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export function SettingsPage(): React.ReactElement {
  const { t } = useI18n();

  const [scope, setScope] = useState<PluginScope>('user');
  const [activeNav, setActiveNav] = useState<SettingsNavItem>('general');
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

  const navItems: { id: SettingsNavItem; label: string }[] = [
    { id: 'general', label: t('settings.nav.general') },
    { id: 'display', label: t('settings.nav.display') },
    { id: 'model', label: t('settings.nav.model') },
    { id: 'permissions', label: t('settings.nav.permissions') },
    { id: 'env', label: t('settings.nav.env') },
    { id: 'hooks', label: t('settings.nav.hooks') },
    { id: 'advanced', label: t('settings.nav.advanced') },
  ];

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
                    const schema = SETTINGS_FLAT_SCHEMA[field.key];
                    if (!schema || schema.controlType === Object) return null;
                    const overriddenScope = getOverriddenScope(scope, userSettings as Record<string, unknown>, field.key);
                    return (
                      <div key={field.key} className="settings-search-result">
                        <span className="settings-search-result-section">{t(`settings.nav.${field.section}` as Parameters<typeof t>[0])}</span>
                        <SchemaFieldRenderer
                          settingKey={field.key}
                          schema={schema}
                          value={(settings as Record<string, unknown>)[field.key]}
                          scope={scope}
                          overriddenScope={overriddenScope}
                          onSave={handleSave}
                          onDelete={handleDelete}
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
              {activeNav === 'model' && (
                <ModelSection
                  scope={scope}
                  settings={settings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
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
                  onSave={handleSave}
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
