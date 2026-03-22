import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sendRequest, onPushMessage } from '../../../vscode';
import { useI18n } from '../../../i18n/I18nContext';
import { useToast } from '../../../components/Toast';
import { ErrorBanner } from '../../../components/ErrorBanner';
import type { PluginScope, ClaudeSettings } from '../../../../shared/types';
import { CLAUDE_SETTINGS_SCHEMA } from '../../../../shared/claude-settings-schema';
import { GENERAL_FIELD_ORDER, DISPLAY_FIELD_ORDER, ADVANCED_FIELD_ORDER } from '../../../../shared/field-orders';
import { GridFilter } from './GridFilter';
import { GridSectionHeader } from './GridSectionHeader';
import { GridRow } from './GridRow';
import { ModelGridRow } from './ModelGridRow';
import { EnvGridSection } from './EnvGridSection';
import { PermissionsGridSection } from './PermissionsGridSection';
import { HooksGridSection } from './HooksGridSection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScopeSettings = { user: ClaudeSettings; project: ClaudeSettings; local: ClaudeSettings };

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'display', label: 'Display' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'env', label: 'Environment Variables' },
  { id: 'hooks', label: 'Hooks' },
  { id: 'advanced', label: 'Advanced' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if any scope has a non-undefined value for this setting key */
function isCustomized(key: string, allSettings: ScopeSettings): boolean {
  return (
    (allSettings.user as Record<string, unknown>)[key] !== undefined ||
    (allSettings.project as Record<string, unknown>)[key] !== undefined ||
    (allSettings.local as Record<string, unknown>)[key] !== undefined
  );
}

/** Check if a key matches the filter text against key name, i18n label/description, and schema description */
function matchesFilter(
  key: string,
  schema: { section: string; description: string },
  filterText: string,
  tFn: (k: Parameters<ReturnType<typeof useI18n>['t']>[0]) => string,
): boolean {
  const lower = filterText.toLowerCase();
  if (key.toLowerCase().includes(lower)) return true;
  if (schema.description.toLowerCase().includes(lower)) return true;

  const labelKey = `settings.${schema.section}.${key}.label` as Parameters<ReturnType<typeof useI18n>['t']>[0];
  const descKey = `settings.${schema.section}.${key}.description` as Parameters<ReturnType<typeof useI18n>['t']>[0];

  return (
    tFn(labelKey).toLowerCase().includes(lower) ||
    tFn(descKey).toLowerCase().includes(lower)
  );
}

// ---------------------------------------------------------------------------
// Column header row
// ---------------------------------------------------------------------------

function GridHeader(): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="sg-header" role="row">
      <div className="sg-header-cell" role="columnheader">{t('settings.grid.column.setting')}</div>
      <div className="sg-header-cell" role="columnheader">{t('settings.grid.column.default')}</div>
      <div className="sg-header-cell" role="columnheader">{t('settings.scope.user')}</div>
      <div className="sg-header-cell" role="columnheader">{t('settings.scope.project')}</div>
      <div className="sg-header-cell" role="columnheader">{t('settings.scope.local')}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsGridPage
// ---------------------------------------------------------------------------

export function SettingsGridPage(): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [allSettings, setAllSettings] = useState<ScopeSettings>({
    user: {},
    project: {},
    local: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [showMode, setShowMode] = useState<'all' | 'customized'>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const fetchAllSettings = useCallback(async (silent = false): Promise<void> => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const folders = await sendRequest<{ name: string; path: string }[]>({ type: 'workspace.getFolders' });
      const hasWs = folders.length > 0;
      setHasWorkspace(hasWs);

      const [user, project, local] = await Promise.all([
        sendRequest<ClaudeSettings>({ type: 'settings.get', scope: 'user' }),
        hasWs
          ? sendRequest<ClaudeSettings>({ type: 'settings.get', scope: 'project' })
          : Promise.resolve({} as ClaudeSettings),
        hasWs
          ? sendRequest<ClaudeSettings>({ type: 'settings.get', scope: 'local' })
          : Promise.resolve({} as ClaudeSettings),
      ]);

      setAllSettings({ user, project, local });
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllSettings();
  }, [fetchAllSettings]);

  // Subscribe to settings.refresh push
  useEffect(() => {
    return onPushMessage((msg) => {
      if (msg.type === 'settings.refresh') {
        void fetchAllSettings(true);
      }
    });
  }, [fetchAllSettings]);

  // ---------------------------------------------------------------------------
  // Save / delete handlers
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async (scope: PluginScope, key: string, value: unknown): Promise<void> => {
    try {
      await sendRequest({ type: 'settings.set', scope, key, value });
      setAllSettings((prev) => ({
        ...prev,
        [scope]: { ...prev[scope], [key]: value },
      }));
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
      throw e;
    }
  }, [addToast]);

  const handleDelete = useCallback(async (scope: PluginScope, key: string): Promise<void> => {
    try {
      await sendRequest({ type: 'settings.delete', scope, key });
      setAllSettings((prev) => {
        const { [key]: _, ...rest } = prev[scope] as Record<string, unknown>;
        return { ...prev, [scope]: rest as ClaudeSettings };
      });
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
      throw e;
    }
  }, [addToast]);

  const handleSaveEnv = useCallback(async (scope: PluginScope, envKey: string, value: string): Promise<void> => {
    const current = allSettings[scope].env ?? {};
    const next = { ...current, [envKey]: value };
    await handleSave(scope, 'env', next);
  }, [allSettings, handleSave]);

  const handleDeleteEnv = useCallback(async (scope: PluginScope, envKey: string): Promise<void> => {
    const current = { ...(allSettings[scope].env ?? {}) };
    delete current[envKey];
    if (Object.keys(current).length === 0) {
      await handleDelete(scope, 'env');
    } else {
      await handleSave(scope, 'env', current);
    }
  }, [allSettings, handleSave, handleDelete]);

  // ---------------------------------------------------------------------------
  // Section toggle
  // ---------------------------------------------------------------------------

  const toggleSection = useCallback((sectionId: string): void => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Filter helpers
  // ---------------------------------------------------------------------------

  const shouldShowKey = useCallback((key: string): boolean => {
    const schema = CLAUDE_SETTINGS_SCHEMA[key];
    if (!schema) return false;

    if (showMode === 'customized' && !isCustomized(key, allSettings)) return false;

    if (filterText) {
      return matchesFilter(key, schema, filterText, t);
    }

    return true;
  }, [filterText, showMode, allSettings, t]);

  const getRowValues = (key: string) => ({
    user: (allSettings.user as Record<string, unknown>)[key],
    project: (allSettings.project as Record<string, unknown>)[key],
    local: (allSettings.local as Record<string, unknown>)[key],
  });

  // Compute filtered field orders per section
  const filteredGeneral = useMemo(
    () => GENERAL_FIELD_ORDER.filter((k) => shouldShowKey(k as string)),
    [shouldShowKey],
  );
  const filteredDisplay = useMemo(
    () => DISPLAY_FIELD_ORDER.filter((k) => shouldShowKey(k as string)),
    [shouldShowKey],
  );
  const filteredAdvanced = useMemo(
    () => ADVANCED_FIELD_ORDER.filter((k) => shouldShowKey(k as string)),
    [shouldShowKey],
  );

  const showModelRow = useMemo(
    () => showMode !== 'customized' || isCustomized('model', allSettings),
    [showMode, allSettings],
  );

  if (loading) {
    return (
      <div className="sg-page">
        <p className="settings-loading">{t('settings.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sg-page">
        <ErrorBanner
          message={`${t('settings.error.load')}: ${error}`}
          onDismiss={() => setError(null)}
          action={
            <button className="btn btn-secondary" onClick={() => void fetchAllSettings()}>
              Retry
            </button>
          }
        />
      </div>
    );
  }

  // Running odd/even row counter across sections for alternating row backgrounds
  let globalRowIndex = 0;

  const renderSchemaRows = (keys: readonly (keyof ClaudeSettings)[]) =>
    keys.map((key) => {
      const schema = CLAUDE_SETTINGS_SCHEMA[key as string];
      if (!schema || schema.controlType === 'custom') return null;
      const isOdd = globalRowIndex++ % 2 === 1;
      return (
        <GridRow
          key={key as string}
          settingKey={key}
          schema={schema}
          values={getRowValues(key as string)}
          hasWorkspace={hasWorkspace}
          isOdd={isOdd}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      );
    });

  return (
    <div className="sg-page">
      <GridFilter
        filterText={filterText}
        onFilterChange={setFilterText}
        showMode={showMode}
        onShowModeChange={setShowMode}
      />

      {!hasWorkspace && (
        <div className="sg-no-workspace-hint">
          {t('settings.grid.noWorkspace')}
        </div>
      )}

      <div className="sg-grid-wrapper">
        <div className="sg-grid" role="grid" aria-label="Settings">
          <GridHeader />

          {SECTIONS.map((section) => {
            const collapsed = collapsedSections.has(section.id);

            return (
              <React.Fragment key={section.id}>
                <GridSectionHeader
                  sectionId={section.id}
                  label={section.label}
                  collapsed={collapsed}
                  onToggle={() => toggleSection(section.id)}
                />

                {!collapsed && (
                  <>
                    {section.id === 'general' && (
                      <>
                        {/* Model row — special, in General section */}
                        {showModelRow && (
                          <ModelGridRow
                            values={getRowValues('model')}
                            hasWorkspace={hasWorkspace}
                            isOdd={globalRowIndex++ % 2 === 1}
                            onSave={handleSave}
                            onDelete={handleDelete}
                            allSettings={allSettings}
                          />
                        )}
                        {renderSchemaRows(filteredGeneral)}
                        {filteredGeneral.length === 0 && !showModelRow && (
                          <div className="sg-empty">{t('settings.grid.empty')}</div>
                        )}
                      </>
                    )}

                    {section.id === 'display' && (
                      <>
                        {renderSchemaRows(filteredDisplay)}
                        {filteredDisplay.length === 0 && (
                          <div className="sg-empty">{t('settings.grid.empty')}</div>
                        )}
                      </>
                    )}

                    {section.id === 'advanced' && (
                      <>
                        {renderSchemaRows(filteredAdvanced)}
                        {filteredAdvanced.length === 0 && (
                          <div className="sg-empty">{t('settings.grid.empty')}</div>
                        )}
                      </>
                    )}

                    {section.id === 'permissions' && (() => {
                      const startIdx = globalRowIndex;
                      globalRowIndex += 7; // 7 permission rows
                      return (
                        <PermissionsGridSection
                          userSettings={allSettings.user}
                          projectSettings={allSettings.project}
                          localSettings={allSettings.local}
                          hasWorkspace={hasWorkspace}
                          startOddIndex={startIdx}
                          onSave={handleSave}
                          onDelete={handleDelete}
                        />
                      );
                    })()}

                    {section.id === 'env' && (() => {
                      const startIdx = globalRowIndex;
                      // Env rows count varies; we don't know ahead of time
                      return (
                        <EnvGridSection
                          userSettings={allSettings.user}
                          projectSettings={allSettings.project}
                          localSettings={allSettings.local}
                          hasWorkspace={hasWorkspace}
                          filterText={filterText}
                          showMode={showMode}
                          onSaveEnv={handleSaveEnv}
                          onDeleteEnv={handleDeleteEnv}
                          startOddIndex={startIdx}
                        />
                      );
                    })()}

                    {section.id === 'hooks' && (() => {
                      const startIdx = globalRowIndex;
                      globalRowIndex += 6; // disableAllHooks + 5 event types
                      return (
                        <HooksGridSection
                          userSettings={allSettings.user}
                          projectSettings={allSettings.project}
                          localSettings={allSettings.local}
                          hasWorkspace={hasWorkspace}
                          startOddIndex={startIdx}
                          onSave={handleSave}
                          onDelete={handleDelete}
                        />
                      );
                    })()}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
