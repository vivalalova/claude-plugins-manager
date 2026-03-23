import React, { useCallback, useEffect, useState } from 'react';
import { sendRequest } from '../../vscode';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PageHeader } from '../../components/PageHeader';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import { useSettingSave } from './hooks/useSettingSave';
import { PermissionsSection } from './PermissionsSection';
import { EnvSection } from './EnvSection';
import { HooksSection } from './HooksSection';
import { GeneralSection } from './GeneralSection';
import { DisplaySection } from './DisplaySection';
import { AdvancedSection } from './AdvancedSection';
import { SettingLabelText } from './components/SettingControls';
import type { PluginScope, ClaudeSettings } from '../../../shared/types';
import { KNOWN_MODEL_OPTIONS } from '../../../shared/claude-settings-schema';
import { usePushSyncedResource } from '../../hooks/usePushSyncedResource';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCOPES: PluginScope[] = ['user', 'project', 'local'];

type SettingsNavItem = 'model' | 'permissions' | 'env' | 'hooks' | 'general' | 'display' | 'advanced';

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

function ModelSection({ scope, settings, onSave, onDelete }: ModelSectionProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const { saving, withSave } = useSettingSave();

  const currentModel = settings.model ?? '';
  const availableModels = settings.availableModels;
  const [selectValue, setSelectValue] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Reset local state when scope/settings change
  useEffect(() => {
    const model = settings.model ?? '';
    if (model && !KNOWN_MODEL_OPTIONS.includes(model as typeof KNOWN_MODEL_OPTIONS[number])) {
      setSelectValue('custom');
      setCustomInput(model);
      setShowCustom(true);
    } else {
      setSelectValue(model);
      setCustomInput('');
      setShowCustom(false);
    }
  }, [scope, settings.model]);

  const handleSelectChange = (val: string): void => {
    if (val === 'custom') {
      setSelectValue('custom');
      setShowCustom(true);
      setCustomInput('');
    } else {
      setSelectValue(val);
      setShowCustom(false);
    }
  };

  const handleSave = (): void => {
    const modelToSave = showCustom ? customInput.trim() : selectValue;
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
    <div className="settings-section">
      <h3 className="settings-section-title">{t('settings.nav.model')}</h3>

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
            value={selectValue}
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

        {showCustom && (
          <input
            className="input settings-model-custom-input"
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="e.g. claude-opus-4-6"
            disabled={saving}
          />
        )}
      </div>

      <div className="settings-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || (!selectValue && !customInput.trim() && !currentModel)}
        >
          {t('settings.model.save')}
        </button>
      </div>
    </div>
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
      <PageHeader title={t('settings.page.title')} />

      {/* Scope tabs */}
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
      </div>

      <div className="settings-body settings-body--fixed-shell">
        {/* Left nav */}
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

        {/* Content */}
        <div className="settings-content settings-content--scrollable">
          {loading && (
            <p className="settings-loading">{t('settings.loading')}</p>
          )}
          {error && (
            <ErrorBanner message={`${t('settings.error.load')}: ${error}`} onDismiss={() => setError(null)} />
          )}
          {!loading && !error && (
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
