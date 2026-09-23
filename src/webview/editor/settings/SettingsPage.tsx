import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendRequest } from '../../vscode';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PageHeader } from '../../components/PageHeader';
import { useI18n } from '../../i18n/I18nContext';
import { PermissionsSection } from './PermissionsSection';
import { CustomizedPermissionsEditor, hasVisiblePermissionsContent } from './CustomizedPermissionsEditor';
import { EnvSection, EnvFieldRenderer, CustomizedEnvEditor } from './EnvSection';
import { HooksSection, HooksFieldEditor } from './HooksSection';
import { GeneralSection } from './GeneralSection';
import { DisplaySection } from './DisplaySection';
import { AdvancedSection } from './AdvancedSection';
import type { PluginScope, ClaudeSettings } from '../../../shared/types';
import { CLAUDE_SETTINGS_SCHEMA, getFlatFieldSchema, getSettingsSections, getValueSchemaEnumOptions, getSectionFieldOrder, type SettingsSection, type FlatFieldSchema } from '../../../shared/claude-settings-schema';
import { KNOWN_ENV_VARS } from '../../../shared/known-env-vars';
import { applyDeleteNested, applySetNested, isNestedParentShape, type NestedParentKey } from '../../../shared/nestedSettings';
import { usePushSyncedResource } from '../../hooks/usePushSyncedResource';
import { SettingsSectionWrapper } from './components/SettingsSectionWrapper';
import { UnknownSettingsSection, getUnknownSettingsEntries } from './components/UnknownSettingsSection';
import { SchemaFieldRenderer } from './components/SchemaFieldRenderer';
import { getSchemaFieldBindings, isFieldVisibleForScope, type ParentSettings } from './components/SchemaSection';
import { PARENT_SCOPES, OverrideBadge, type Inherited } from './components/SettingControls';
import { ObjectFieldEditor, OBJECT_EDITOR_KEYS } from './components/ObjectFieldEditor';
import { hasVisibleSandboxContent } from './components/SandboxEditor';
import {
  GlobalConfigFallbackContext,
  UNKNOWN_GLOBAL_CONFIG_FALLBACK,
  toGlobalConfigFallbackSnapshot,
  type GlobalConfigFallbackSnapshot,
} from './components/globalConfigFallback';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPES: PluginScope[] = ['user', 'project', 'local'];

/** 父層快照與其所屬 scope；forScope 不等於目前 scope 時快照不可用（視為未知）。 */
type ParentSnapshot = { forScope: PluginScope | undefined; snapshots: ParentSettings | undefined };
/** 目前畫面的設定資料與其所屬 scope；寫入回應只在 forScope 等於發出 scope 時套樂觀更新。 */
type SettingsSnapshot = { forScope: PluginScope | undefined; data: ClaudeSettings };
const SETTINGS_NAV_SECTIONS = getSettingsSections();

/**
 * 是否視為「已自訂」的實質內容：undefined、空物件 {}、空陣列 [] 都不算。
 * 空容器（env:{}/hooks:{}/availableModels:[] 等）對應編輯器畫不出可操作項，
 * 計入 badge 會造成「計數說有、面板空白」矛盾——與 shouldShowReset 同精神（有值才算）。
 * permissions 因空子清單（{allow:[]}）需更深判定，另由 hasVisiblePermissionsContent 處理；
 * sandbox 只計該 scope 生效的子設定，另由 hasVisibleSandboxContent 處理。
 */
function isCustomizedValue(value: unknown): boolean {
  if (value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value !== null && typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

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
        // Only binding.value is used for inclusion; inheritance stays unknown here —
        // counting cares about the current scope only.
        parentSettings: undefined,
        onSave: noop,
        onDelete: noop,
        onSaveNested: noop,
        onDeleteNested: noop,
      });
      if (binding && isCustomizedValue(binding.value)) {
        // permissions 走更深的「有可見內容」判定（空子清單如 allow:[] 也要排除），
        // 與 CustomizedPermissionsEditor 共用單一來源，避免計入 badge 卻畫不出面板。
        if (key === 'permissions' && !hasVisiblePermissionsContent(settings.permissions)) continue;
        if (key === 'sandbox' && !hasVisibleSandboxContent(settings.sandbox, scope)) continue;
        result.push({ key, section });
      }
    }
  }
  return result;
}

/** scope 徽章數（已自訂 schema 欄位＋未知 key）的唯一算式 */
function countCustomized(settings: ClaudeSettings, scope: PluginScope): number {
  return collectCustomizedSchemaFields(settings, scope).length + getUnknownSettingsEntries(settings).length;
}

/** 巢狀 patch 只套在父 key 缺席或為 plain object 的資料上（形狀不符時 C0 會拋錯） */
function canPatchNestedParent(settings: ClaudeSettings, parentKey: NestedParentKey): boolean {
  const parent = (settings as Record<string, unknown>)[parentKey];
  return parent === undefined || isNestedParentShape(parent);
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
  inherited,
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
  inherited: Inherited;
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
        inherited={inherited}
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

  // Filter fields by search query; globalConfig 欄位在非 user scope 排除（不可見/不可編輯）
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchableFields.filter((f) => {
      if (!matchesSearch(f, searchQuery.trim())) return false;
      if (f.isEnvVar) return true;
      const schema = getFlatFieldSchema(f.key);
      return schema ? isFieldVisibleForScope(schema, scope) : true;
    });
  }, [searchableFields, searchQuery, scope]);

  const isSearching = searchQuery.trim().length > 0;

  // Check workspace availability
  useEffect(() => {
    sendRequest<{ name: string; path: string }[]>({ type: 'workspace.getFolders' })
      .then((folders) => setHasWorkspace(folders.length > 0))
      .catch(() => setHasWorkspace(false));
  }, []);

  const loadSettings = useCallback(async (): Promise<SettingsSnapshot> => {
    const forScope = scope;
    return { forScope, data: await sendRequest<ClaudeSettings>({ type: 'settings.get', scope: forScope }) };
  }, [scope]);

  const {
    data: snap,
    loading,
    error,
    setError,
    setData: setSnap,
    refresh: refreshSettings,
  } = usePushSyncedResource<SettingsSnapshot>({
    initialData: { forScope: undefined, data: {} },
    load: loadSettings,
    pushFilter: useCallback((msg: { type?: string }) => msg.type === 'settings.refresh', []),
  });
  const settings = snap.data;
  // 寫入回應在 await 之後才到，閉包裡的 snap／refresh 可能屬於切走前的 scope；回應時一律讀最新的
  const latestRef = useRef({ snap, refreshSettings, scope });
  latestRef.current = { snap, refreshSettings, scope };

  // Parent-scope snapshots feed the override badge and inheritance-aware delete decisions.
  // Loaded separately so the current-scope view never blocks on parent fetches.
  // 快照標記所屬 scope：切 scope 後新快照到達前、或載入失敗時，一律視為未知（undefined）。
  const loadParentSettings = useCallback(async (): Promise<ParentSnapshot> => {
    const forScope = scope;
    const parents = PARENT_SCOPES[forScope];
    if (parents.length === 0) return { forScope, snapshots: {} };
    try {
      const results = await Promise.all(
        parents.map((s) => sendRequest<ClaudeSettings>({ type: 'settings.get', scope: s })),
      );
      const map: ParentSettings = {};
      parents.forEach((s, i) => { map[s] = results[i]; });
      return { forScope, snapshots: map };
    } catch {
      return { forScope, snapshots: undefined };
    }
  }, [scope]);

  const { data: parentSnapshot, loading: parentLoading } = usePushSyncedResource<ParentSnapshot>({
    initialData: { forScope: undefined, snapshots: undefined },
    load: loadParentSettings,
    pushFilter: useCallback((msg: { type?: string }) => msg.type === 'settings.refresh', []),
  });
  // scope 切換觸發的載入中（parentLoading）代表可能有更新一輪的 fetch 在途；即便舊快照的
  // forScope 剛好等於目前 scope（如 A→B→A），也不能當成已就緒——否則會誤用切走前的舊資料。
  const parentSettings = !parentLoading && parentSnapshot.forScope === scope ? parentSnapshot.snapshots : undefined;

  // ~/.claude.json 備援值（#31）：與 scope 無關，初次載入與 settings.refresh 時重讀。
  // 在 load 內 catch 並回傳未知，失敗或回應非物件都不沿用舊快照（避免重載失敗仍顯示舊備援值）。
  const loadGlobalConfigFallback = useCallback(async (): Promise<GlobalConfigFallbackSnapshot> => {
    try {
      return toGlobalConfigFallbackSnapshot(await sendRequest<unknown>({ type: 'settings.getGlobalConfigFallback' }));
    } catch {
      return UNKNOWN_GLOBAL_CONFIG_FALLBACK;
    }
  }, []);

  const { data: globalConfigFallback } = usePushSyncedResource<GlobalConfigFallbackSnapshot>({
    initialData: UNKNOWN_GLOBAL_CONFIG_FALLBACK,
    load: loadGlobalConfigFallback,
    pushFilter: useCallback((msg: { type?: string }) => msg.type === 'settings.refresh', []),
  });

  const loadScopeCounts = useCallback(async (): Promise<{ project: number; local: number }> => {
    if (!hasWorkspace) {
      return { project: 0, local: 0 };
    }
    const [projectSettings, localSettings] = await Promise.all([
      sendRequest<ClaudeSettings>({ type: 'settings.get', scope: 'project' }),
      sendRequest<ClaudeSettings>({ type: 'settings.get', scope: 'local' }),
    ]);
    return {
      project: countCustomized(projectSettings ?? {} as ClaudeSettings, 'project'),
      local: countCustomized(localSettings ?? {} as ClaudeSettings, 'local'),
    };
  }, [hasWorkspace]);

  const { data: counts, setData: setCounts, refresh: refreshCounts } = usePushSyncedResource<{ project: number; local: number }>({
    initialData: { project: 0, local: 0 },
    load: loadScopeCounts,
    pushFilter: useCallback((msg: { type?: string }) => msg.type === 'settings.refresh', []),
  });

  // 畫面資料（該 scope 最後一次載入＋已套用的寫入）同步進 counts，切走後徽章不停在寫入前的數字；
  // counts 被較早發出的重讀覆寫時也重新對齊
  useEffect(() => {
    const s = snap.forScope;
    if (loading || s !== scope || (s !== 'project' && s !== 'local')) return;
    const n = countCustomized(snap.data, s);
    setCounts((prev) => (prev[s] === n ? prev : { ...prev, [s]: n }));
  }, [loading, scope, snap, counts, setCounts]);

  /**
   * 寫入成功後的畫面更新：只在畫面資料仍屬發出 scope 時套 patch（I4）；
   * 已換成別的 scope 的資料 → 不套，改重讀徽章數（該 scope 的寫入不會再經畫面資料反映）。
   */
  const commitWrite = useCallback((issuedScope: PluginScope, patch: (data: ClaudeSettings) => ClaudeSettings): void => {
    setSnap((prev) => {
      if (prev.forScope !== issuedScope) return prev;
      const data = patch(prev.data);
      return data === prev.data ? prev : { ...prev, data };
    });
    if (latestRef.current.scope !== issuedScope && issuedScope !== 'user') void refreshCounts(false);
  }, [setSnap, refreshCounts]);

  /** 巢狀寫入的 patch：畫面上父 key 形狀不符（如外部改成字串）→ 不 patch、重讀對齊，不在 updater 內拋錯 */
  const commitNestedWrite = useCallback((
    issuedScope: PluginScope,
    parentKey: NestedParentKey,
    apply: (data: ClaudeSettings) => ClaudeSettings,
  ): void => {
    const { snap: latest, refreshSettings: refreshLatest } = latestRef.current;
    if (latest.forScope === issuedScope && !canPatchNestedParent(latest.data, parentKey)) {
      void refreshLatest(false);
      return;
    }
    commitWrite(issuedScope, (data) => (canPatchNestedParent(data, parentKey) ? apply(data) : data));
  }, [commitWrite]);

  const handleSave = useCallback(async (key: string, value: unknown): Promise<void> => {
    await sendRequest({ type: 'settings.set', scope, key, value });
    commitWrite(scope, (data) => ({ ...data, [key]: value }));
  }, [scope, commitWrite]);

  const handleDelete = useCallback(async (key: string): Promise<void> => {
    await sendRequest({ type: 'settings.delete', scope, key });
    commitWrite(scope, (data) => {
      const rest = { ...data } as Record<string, unknown>;
      delete rest[key];
      return rest as ClaudeSettings;
    });
  }, [scope, commitWrite]);

  const handleSaveNested = useCallback(async (parentKey: NestedParentKey, childKey: string, value: unknown): Promise<void> => {
    await sendRequest({ type: 'settings.setNested', scope, parentKey, childKey, value });
    commitNestedWrite(scope, parentKey, (data) =>
      applySetNested(data as Record<string, unknown>, parentKey, childKey, value).next as ClaudeSettings);
  }, [scope, commitNestedWrite]);

  const handleDeleteNested = useCallback(async (parentKey: NestedParentKey, childKey: string): Promise<void> => {
    await sendRequest({ type: 'settings.deleteNested', scope, parentKey, childKey });
    commitNestedWrite(scope, parentKey, (data) => {
      const { next, changed } = applyDeleteNested(data as Record<string, unknown>, parentKey, childKey);
      return changed ? next as ClaudeSettings : data;
    });
  }, [scope, commitNestedWrite]);

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

  // 目前 scope 的徽章數：畫面資料確定屬於目前 scope 時由它推導，否則（載入中、載入失敗、過渡幀）用 counts
  const currentCount = useMemo(() => countCustomized(settings, scope), [settings, scope]);
  const currentCountReady = !loading && snap.forScope === scope;

  const page = (
    <div className="page-container settings-page settings-page--fixed-shell">
      <PageHeader title={t('settings.page.title')} subtitle={t('settings.page.subtitle')} />

      {/* Scope tabs + Search */}
      <div className="settings-scope-tabs settings-scope-tabs--fixed">
        {SCOPES.map((s) => {
          const disabled = s !== 'user' && !hasWorkspace;
          const count = s === 'user' ? 0 : s === scope && currentCountReady ? currentCount : counts[s];
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
          <a href="https://code.claude.com/docs/en/settings" target="_blank" rel="noreferrer" className="settings-docs-link">
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
          {!loading && !error && snap.forScope === scope && isSearching && (
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
                            parentSettings={parentSettings}
                            onSaveNested={handleSaveNested}
                            onDeleteNested={handleDeleteNested}
                          />
                        </div>
                      );
                    }

                    // Schema field
                    const fieldBindings = getSchemaFieldBindings(field.key, {
                      scope,
                      settings,
                      parentSettings,
                      onSave: handleSave,
                      onDelete: handleDelete,
                      onSaveNested: handleSaveNested,
                      onDeleteNested: handleDeleteNested,
                    });
                    if (!fieldBindings) return null;
                    const { schema, value, onSave, onDelete, overriddenScope, inherited } = fieldBindings;
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
                      inherited,
                      onSave,
                      onDelete,
                      onNavigate: () => { setSearchQuery(''); setActiveNav(field.section as SettingsNavItem); },
                    });
                  })}
                </>
              )}
            </SettingsSectionWrapper>
          )}
          {!loading && !error && snap.forScope === scope && !isSearching && (
            <>
              {activeNav === 'permissions' && (
                <PermissionsSection
                  scope={scope}
                  settings={settings}
                  parentSettings={parentSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onSaveNested={handleSaveNested}
                  onDeleteNested={handleDeleteNested}
                />
              )}
              {activeNav === 'env' && (
                <EnvSection
                  scope={scope}
                  settings={settings}
                  parentSettings={parentSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onSaveNested={handleSaveNested}
                  onDeleteNested={handleDeleteNested}
                />
              )}
              {activeNav === 'hooks' && (
                <HooksSection
                  scope={scope}
                  settings={settings}
                  parentSettings={parentSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onSaveNested={handleSaveNested}
                  onDeleteNested={handleDeleteNested}
                />
              )}
              {activeNav === 'general' && (
                <GeneralSection
                  scope={scope}
                  settings={settings}
                  parentSettings={parentSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onSaveNested={handleSaveNested}
                  onDeleteNested={handleDeleteNested}
                />
              )}
              {activeNav === 'display' && (
                <DisplaySection
                  scope={scope}
                  settings={settings}
                  parentSettings={parentSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onSaveNested={handleSaveNested}
                  onDeleteNested={handleDeleteNested}
                />
              )}
              {activeNav === 'advanced' && (
                <AdvancedSection
                  scope={scope}
                  settings={settings}
                  parentSettings={parentSettings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onSaveNested={handleSaveNested}
                  onDeleteNested={handleDeleteNested}
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
                currentCount === 0 ? (
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
                          parentSettings,
                          onSave: handleSave,
                          onDelete: handleDelete,
                          onSaveNested: handleSaveNested,
                          onDeleteNested: handleDeleteNested,
                        });
                        if (!fieldBindings) return null;
                        const { schema, value, onSave: fieldOnSave, onDelete: fieldOnDelete, overriddenScope, inherited } = fieldBindings;
                        const sectionLabel = t(`settings.nav.${section}` as Parameters<typeof t>[0]);
                        const fieldLabel = t(`settings.${section}.${key}.label` as Parameters<typeof t>[0]) || key;

                        if (key === 'permissions') {
                          return (
                            <div key={key} className="settings-search-result" data-customized-field={key}>
                              <span className="settings-search-result-section">{sectionLabel}</span>
                              {overriddenScope && <OverrideBadge scope={overriddenScope} />}
                              <CustomizedPermissionsEditor
                                perms={value as ClaudeSettings['permissions'] ?? {}}
                                onSaveNested={handleSaveNested}
                                scope={scope}
                              />
                            </div>
                          );
                        }

                        if (key === 'env') {
                          return (
                            <div key={key} className="settings-search-result" data-customized-field={key}>
                              <span className="settings-search-result-section">{sectionLabel}</span>
                              {overriddenScope && <OverrideBadge scope={overriddenScope} />}
                              <CustomizedEnvEditor
                                scope={scope}
                                parentSettings={parentSettings}
                                currentEnv={(value as Record<string, string>) ?? {}}
                                onSaveNested={handleSaveNested}
                                onDeleteNested={handleDeleteNested}
                              />
                            </div>
                          );
                        }

                        if (key === 'hooks') {
                          return (
                            <div key={key} className="settings-search-result" data-customized-field={key}>
                              <span className="settings-search-result-section">{sectionLabel}</span>
                              {overriddenScope && <OverrideBadge scope={overriddenScope} />}
                              <HooksFieldEditor scope={scope} settings={settings} />
                            </div>
                          );
                        }

                        if (OBJECT_EDITOR_KEYS.has(key)) {
                          return (
                            <div key={key} className="settings-search-result" data-customized-field={key}>
                              <span className="settings-search-result-section">{sectionLabel}</span>
                              <ObjectFieldEditor
                                settingKey={key}
                                scope={scope}
                                settings={settings}
                                parentSettings={parentSettings}
                                overriddenScope={overriddenScope}
                                onSave={fieldOnSave}
                                onDelete={fieldOnDelete}
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
                          inherited,
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

  // 備援快照以 context 下發到所有 SchemaFieldRenderer（section、搜尋、已自訂三個入口共用）。
  return (
    <GlobalConfigFallbackContext.Provider value={globalConfigFallback}>
      {page}
    </GlobalConfigFallbackContext.Provider>
  );
}
