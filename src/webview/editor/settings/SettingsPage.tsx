import React, { useCallback, useEffect, useState } from 'react';
import { sendRequest, onPushMessage } from '../../vscode';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n/I18nContext';
import { PermissionsSection } from './PermissionsSection';
import { EnvSection } from './EnvSection';
import { HooksSection } from './HooksSection';
import { GeneralSection } from './GeneralSection';
import { DisplaySection } from './DisplaySection';
import { AdvancedSection } from './AdvancedSection';
import { SettingLabelText } from './components/SettingControls';
import type { PluginScope, ClaudeSettings } from '../../../shared/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const;

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

  const currentModel = settings.model ?? '';
  const availableModels = settings.availableModels;
  const [selectValue, setSelectValue] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset local state when scope/settings change
  useEffect(() => {
    const model = settings.model ?? '';
    if (model && !KNOWN_MODELS.includes(model as typeof KNOWN_MODELS[number])) {
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

  const handleSave = async (): Promise<void> => {
    const modelToSave = showCustom ? customInput.trim() : selectValue;
    setSaving(true);
    try {
      if (!modelToSave) {
        await onDelete('model');
        addToast('Model cleared', 'success');
      } else {
        await onSave('model', modelToSave);
        addToast('Model saved', 'success');
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (): Promise<void> => {
    setSaving(true);
    try {
      await onDelete('model');
      addToast('Model cleared', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const outsideWhitelist = currentModel && !isModelInWhitelist(currentModel, availableModels);
  const dropdownModels = availableModels?.length ? availableModels : [...KNOWN_MODELS];

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
  const [settings, setSettings] = useState<ClaudeSettings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasWorkspace, setHasWorkspace] = useState(false);

  // Check workspace availability
  useEffect(() => {
    sendRequest<{ name: string; path: string }[]>({ type: 'workspace.getFolders' })
      .then((folders) => setHasWorkspace(folders.length > 0))
      .catch(() => setHasWorkspace(false));
  }, []);

  const fetchSettings = useCallback(async (targetScope: PluginScope, silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const data = await sendRequest<ClaudeSettings>({ type: 'settings.get', scope: targetScope });
      setSettings(data);
      setError(null); // 成功即清錯，不論 silent（避免舊 error banner 殘留）
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings(scope);
  }, [scope, fetchSettings]);

  // Subscribe to settings.refresh push
  useEffect(() => {
    return onPushMessage((msg) => {
      if (msg.type === 'settings.refresh') {
        fetchSettings(scope, true);
      }
    });
  }, [scope, fetchSettings]);

  const handleSave = useCallback(async (key: string, value: unknown): Promise<void> => {
    await sendRequest({ type: 'settings.set', scope, key, value });
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, [scope]);

  const handleDelete = useCallback(async (key: string): Promise<void> => {
    await sendRequest({ type: 'settings.delete', scope, key });
    setSettings((prev) => {
      const { [key]: _, ...rest } = prev as Record<string, unknown>;
      return rest as ClaudeSettings;
    });
  }, [scope]);

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
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
              {activeNav === 'general' && (
                <GeneralSection
                  scope={scope}
                  settings={settings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
              {activeNav === 'display' && (
                <DisplaySection
                  scope={scope}
                  settings={settings}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              )}
              {activeNav === 'advanced' && (
                <AdvancedSection
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
