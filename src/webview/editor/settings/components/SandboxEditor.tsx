import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ClaudeSettings } from '../../../../shared/types';
import { SettingLabelText } from './SettingControls';
import { useToast } from '../../../components/Toast';

type SandboxValue = NonNullable<ClaudeSettings['sandbox']>;
type SandboxMode = 'structured' | 'json';

interface SandboxEditorProps {
  sandbox: ClaudeSettings['sandbox'];
  onSave: (key: string, value: unknown) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

/** Strip empty arrays and empty sub-objects; return undefined if fully empty */
function cleanSandbox(obj: SandboxValue): SandboxValue | undefined {
  const clean = { ...obj } as Record<string, unknown>;

  // Clean filesystem sub-object
  if (obj.filesystem) {
    const fs = { ...obj.filesystem } as Record<string, unknown>;
    for (const k of Object.keys(fs)) {
      if (Array.isArray(fs[k]) && (fs[k] as unknown[]).length === 0) delete fs[k];
    }
    if (Object.keys(fs).length === 0) delete clean.filesystem;
    else clean.filesystem = fs;
  }

  // Clean network sub-object
  if (obj.network) {
    const net = { ...obj.network } as Record<string, unknown>;
    for (const k of Object.keys(net)) {
      if (Array.isArray(net[k]) && (net[k] as unknown[]).length === 0) delete net[k];
      if (net[k] === undefined) delete net[k];
    }
    if (Object.keys(net).length === 0) delete clean.network;
    else clean.network = net;
  }

  // Clean root-level
  if (Array.isArray(clean.excludedCommands) && (clean.excludedCommands as unknown[]).length === 0) delete clean.excludedCommands;
  if (clean.ignoreViolations && Object.keys(clean.ignoreViolations as object).length === 0) delete clean.ignoreViolations;
  for (const k of ['enabled', 'autoAllowBashIfSandboxed', 'enableWeakerNetworkIsolation', 'enableWeakerNestedSandbox', 'allowUnsandboxedCommands']) {
    if (clean[k] === undefined) delete clean[k];
  }

  return Object.keys(clean).length === 0 ? undefined : clean as SandboxValue;
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function SandboxCheckbox({ label, checked, saving, onChange }: {
  label: string; checked: boolean; saving: boolean;
  onChange: (v: boolean) => void;
}): React.ReactElement {
  return (
    <label className="hooks-toggle-label" style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, marginBottom: 4 }}>
      <input type="checkbox" checked={checked} onChange={() => onChange(!checked)} disabled={saving} />
      {label}
    </label>
  );
}

function SandboxTagList({ label, items, empty, placeholder, duplicate, saving, onChange }: {
  label: string; items: string[]; empty: string; placeholder: string; duplicate: string;
  saving: boolean; onChange: (items: string[]) => void;
}): React.ReactElement {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (): void => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) { setError(duplicate); return; }
    setError('');
    setInput('');
    onChange([...items, trimmed]);
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>{label}</div>
      <div className="general-tag-list">
        {items.length === 0 ? (
          <span className="perm-empty">{empty}</span>
        ) : items.map((item) => (
          <span key={item} className="perm-rule-tag">
            {item}
            <button className="perm-rule-tag-delete" onClick={() => onChange(items.filter((i) => i !== item))} disabled={saving} type="button">×</button>
          </span>
        ))}
      </div>
      <div className="general-tag-add-row">
        <input className="input" type="text" value={input} onChange={(e) => { setInput(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder={placeholder} disabled={saving} />
        <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !input.trim()} type="button">+</button>
        {error && <span className="perm-add-error" role="alert">{error}</span>}
      </div>
    </div>
  );
}

function SandboxNumberInput({ label, value, placeholder, saving, onChange }: {
  label: string; value: number | undefined; placeholder: string; saving: boolean;
  onChange: (v: number | undefined) => void;
}): React.ReactElement {
  const [input, setInput] = useState(value !== undefined ? String(value) : '');

  useEffect(() => {
    setInput(value !== undefined ? String(value) : '');
  }, [value]);

  const handleBlur = (): void => {
    const trimmed = input.trim();
    if (!trimmed) { onChange(undefined); return; }
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 0 && num <= 65535) onChange(num);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--vscode-descriptionForeground)', minWidth: 140 }}>{label}</span>
      <input className="input" type="number" value={input} onChange={(e) => setInput(e.target.value)}
        onBlur={handleBlur} placeholder={placeholder} min={0} max={65535} disabled={saving}
        style={{ width: 100 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SandboxEditor
// ---------------------------------------------------------------------------

export function SandboxEditor({ sandbox, onSave, onDelete }: SandboxEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [mode, setMode] = useState<SandboxMode>('structured');
  const [jsonText, setJsonText] = useState(sandbox ? JSON.stringify(sandbox, null, 2) : '');
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);

  const tk = useCallback(
    (suffix: string) => t(`settings.advanced.sandbox.${suffix}` as Parameters<typeof t>[0]),
    [t],
  );

  // Sync JSON text when sandbox prop changes (external update)
  const sandboxJson = sandbox ? JSON.stringify(sandbox, null, 2) : '';
  useEffect(() => {
    setJsonText(sandboxJson);
    setJsonError('');
  }, [sandboxJson]);

  // --- Structured mode save helper ---
  const saveSandbox = async (updated: SandboxValue): Promise<void> => {
    setSaving(true);
    try {
      const cleaned = cleanSandbox(updated);
      if (cleaned) {
        await onSave('sandbox', cleaned);
      } else {
        await onDelete('sandbox');
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const draft: SandboxValue = sandbox ?? {};

  const updateBool = (key: keyof SandboxValue, val: boolean): void => {
    void saveSandbox({ ...draft, [key]: val });
  };

  const updateList = (key: 'excludedCommands', items: string[]): void => {
    void saveSandbox({ ...draft, [key]: items });
  };

  const updateFs = (key: keyof NonNullable<SandboxValue['filesystem']>, items: string[]): void => {
    void saveSandbox({ ...draft, filesystem: { ...draft.filesystem, [key]: items } });
  };

  const updateNet = (key: string, val: unknown): void => {
    void saveSandbox({ ...draft, network: { ...draft.network, [key]: val } });
  };

  // --- JSON mode handlers ---
  const handleJsonSave = async (): Promise<void> => {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setSaving(true);
      try { await onDelete('sandbox'); } catch (e) { addToast(e instanceof Error ? e.message : String(e), 'error'); }
      finally { setSaving(false); }
      return;
    }
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); } catch (e) {
      setJsonError(t('settings.advanced.sandbox.invalidJson' as Parameters<typeof t>[0], { error: e instanceof Error ? e.message : String(e) }));
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setJsonError(t('settings.advanced.sandbox.invalidObject'));
      return;
    }
    setSaving(true);
    try { await onSave('sandbox', parsed); } catch (e) { addToast(e instanceof Error ? e.message : String(e), 'error'); }
    finally { setSaving(false); }
  };

  const handleJsonDelete = async (): Promise<void> => {
    setSaving(true);
    try { await onDelete('sandbox'); } catch (e) { addToast(e instanceof Error ? e.message : String(e), 'error'); }
    finally { setSaving(false); }
  };

  // --- Mode switch ---
  const handleModeSwitch = (newMode: SandboxMode): void => {
    if (newMode === mode) return;
    if (newMode === 'json') {
      // Structured → JSON: serialize current sandbox
      setJsonText(sandbox ? JSON.stringify(sandbox, null, 2) : '');
      setJsonError('');
    }
    // JSON → Structured: sandbox prop is the source of truth (already saved)
    setMode(newMode);
  };

  return (
    <div className="settings-field">
      <label className="settings-label">
        <SettingLabelText label={t('settings.advanced.sandbox.label')} settingKey="sandbox" />
      </label>
      <p className="settings-field-description">{t('settings.advanced.sandbox.description')}</p>

      {/* Mode tabs */}
      <div className="perm-sub-tabs" style={{ marginBottom: 8 }}>
        <button className={`settings-scope-tab${mode === 'structured' ? ' settings-scope-tab--active' : ''}`}
          onClick={() => handleModeSwitch('structured')} type="button">{tk('mode.structured')}</button>
        <button className={`settings-scope-tab${mode === 'json' ? ' settings-scope-tab--active' : ''}`}
          onClick={() => handleModeSwitch('json')} type="button">{tk('mode.json')}</button>
      </div>

      {mode === 'json' ? (
        <>
          <textarea id="sandbox-json" className="input" rows={10} value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setJsonError(''); }}
            placeholder={t('settings.advanced.sandbox.placeholder')} disabled={saving} spellCheck={false} />
          {jsonError && <p className="settings-field-description" role="alert" style={{ color: 'var(--vscode-errorForeground, red)' }}>{jsonError}</p>}
          <div className="settings-actions">
            <button className="btn btn-primary" onClick={() => void handleJsonSave()} disabled={saving} type="button">
              {t('settings.advanced.sandbox.save')}
            </button>
            {sandbox && (
              <button className="btn btn-secondary" onClick={() => void handleJsonDelete()} disabled={saving} type="button">
                {t('settings.advanced.sandbox.clear')}
              </button>
            )}
          </div>
        </>
      ) : (
        <div>
          {/* General */}
          <SandboxCheckbox label={tk('enabled')} checked={draft.enabled ?? false} saving={saving}
            onChange={(v) => updateBool('enabled', v)} />
          <SandboxCheckbox label={tk('autoAllowBash')} checked={draft.autoAllowBashIfSandboxed ?? false} saving={saving}
            onChange={(v) => updateBool('autoAllowBashIfSandboxed', v)} />
          <SandboxCheckbox label={tk('weakerNetwork')} checked={draft.enableWeakerNetworkIsolation ?? false} saving={saving}
            onChange={(v) => updateBool('enableWeakerNetworkIsolation', v)} />
          <SandboxCheckbox label={tk('weakerNested')} checked={draft.enableWeakerNestedSandbox ?? false} saving={saving}
            onChange={(v) => updateBool('enableWeakerNestedSandbox', v)} />
          <SandboxCheckbox label={tk('allowUnsandboxed')} checked={draft.allowUnsandboxedCommands ?? false} saving={saving}
            onChange={(v) => updateBool('allowUnsandboxedCommands', v)} />

          <SandboxTagList label={tk('excludedCommands')} items={draft.excludedCommands ?? []}
            empty={tk('excludedCommands.empty')} placeholder={tk('excludedCommands.placeholder')}
            duplicate={tk('excludedCommands.duplicate')} saving={saving}
            onChange={(items) => updateList('excludedCommands', items)} />

          {/* Filesystem */}
          <h4 style={{ fontSize: 12, fontWeight: 600, marginTop: 12, marginBottom: 6, borderTop: '1px solid var(--vscode-editorWidget-border)', paddingTop: 8 }}>
            {tk('filesystem')}
          </h4>
          <SandboxTagList label={tk('filesystem.allowWrite')} items={draft.filesystem?.allowWrite ?? []}
            empty={tk('filesystem.allowWrite.empty')} placeholder={tk('filesystem.allowWrite.placeholder')}
            duplicate={tk('filesystem.allowWrite.duplicate')} saving={saving}
            onChange={(items) => updateFs('allowWrite', items)} />
          <SandboxTagList label={tk('filesystem.denyWrite')} items={draft.filesystem?.denyWrite ?? []}
            empty={tk('filesystem.denyWrite.empty')} placeholder={tk('filesystem.denyWrite.placeholder')}
            duplicate={tk('filesystem.denyWrite.duplicate')} saving={saving}
            onChange={(items) => updateFs('denyWrite', items)} />
          <SandboxTagList label={tk('filesystem.denyRead')} items={draft.filesystem?.denyRead ?? []}
            empty={tk('filesystem.denyRead.empty')} placeholder={tk('filesystem.denyRead.placeholder')}
            duplicate={tk('filesystem.denyRead.duplicate')} saving={saving}
            onChange={(items) => updateFs('denyRead', items)} />

          {/* Network */}
          <h4 style={{ fontSize: 12, fontWeight: 600, marginTop: 12, marginBottom: 6, borderTop: '1px solid var(--vscode-editorWidget-border)', paddingTop: 8 }}>
            {tk('network')}
          </h4>
          <SandboxTagList label={tk('network.allowedDomains')} items={draft.network?.allowedDomains ?? []}
            empty={tk('network.allowedDomains.empty')} placeholder={tk('network.allowedDomains.placeholder')}
            duplicate={tk('network.allowedDomains.duplicate')} saving={saving}
            onChange={(items) => updateNet('allowedDomains', items)} />
          <SandboxCheckbox label={tk('network.allowAllUnixSockets')} checked={draft.network?.allowAllUnixSockets ?? false} saving={saving}
            onChange={(v) => updateNet('allowAllUnixSockets', v)} />
          <SandboxCheckbox label={tk('network.allowLocalBinding')} checked={draft.network?.allowLocalBinding ?? false} saving={saving}
            onChange={(v) => updateNet('allowLocalBinding', v)} />
          <SandboxCheckbox label={tk('network.managedDomainsOnly')} checked={draft.network?.allowManagedDomainsOnly ?? false} saving={saving}
            onChange={(v) => updateNet('allowManagedDomainsOnly', v)} />
          <SandboxNumberInput label={tk('network.httpProxyPort')} value={draft.network?.httpProxyPort}
            placeholder={tk('network.httpProxyPort.placeholder')} saving={saving}
            onChange={(v) => updateNet('httpProxyPort', v)} />
          <SandboxNumberInput label={tk('network.socksProxyPort')} value={draft.network?.socksProxyPort}
            placeholder={tk('network.socksProxyPort.placeholder')} saving={saving}
            onChange={(v) => updateNet('socksProxyPort', v)} />

          {/* Clear */}
          {sandbox && (
            <div className="settings-actions" style={{ marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => void handleJsonDelete()} disabled={saving} type="button">
                {t('settings.advanced.sandbox.clear')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
