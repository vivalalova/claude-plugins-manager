import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../../i18n/I18nContext';
import { toErrorMessage } from '../../../../shared/errorUtils';
import type { ClaudeSettings, PluginScope } from '../../../../shared/types';
import { childEffectiveScopes, getFlatFieldSchema, isScopeEffective, resolveEffectiveScopes, type EffectiveScopes, type ValueSchema } from '../../../../shared/claude-settings-schema';
import { SettingLabelText } from './SettingControls';
import { useSettingSave } from '../hooks/useSettingSave';
import { validateJsonSettingValue } from '../jsonSettingValidation';

type SandboxValue = NonNullable<ClaudeSettings['sandbox']>;
type SandboxMode = 'structured' | 'json';
type SandboxBooleanKey =
  | 'enabled'
  | 'autoAllowBashIfSandboxed'
  | 'enableWeakerNetworkIsolation'
  | 'enableWeakerNestedSandbox'
  | 'allowUnsandboxedCommands'
  | 'allowAppleEvents'
  | 'failIfUnavailable';
type SandboxFilesystemArrayKey = 'allowWrite' | 'denyWrite' | 'denyRead' | 'allowRead';
type SandboxFilesystemBooleanKey = 'disabled';
type SandboxNetworkArrayKey = 'allowedDomains' | 'deniedDomains' | 'allowUnixSockets' | 'allowMachLookup';
type SandboxNetworkBooleanKey =
  | 'allowAllUnixSockets'
  | 'allowLocalBinding'
  | 'strictAllowlist';
type SandboxNetworkNumberKey = 'httpProxyPort' | 'socksProxyPort';
type SandboxCredentials = NonNullable<SandboxValue['credentials']>;
type SandboxAwsPair = NonNullable<SandboxCredentials['awsPairs']>[number];
type SandboxCredentialEnvVar = NonNullable<SandboxCredentials['envVars']>[number];
/** UI 用的 pair 草稿：sessionTokenVar 為選填，草稿階段一律以空字串表示未填。 */
interface AwsPairDraft {
  accessKeyIdVar: string;
  secretAccessKeyVar: string;
  sessionTokenVar: string;
}

interface SandboxEditorProps {
  sandbox: ClaudeSettings['sandbox'];
  scope: PluginScope;
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

  // Clean credentials sub-object
  if (obj.credentials) {
    const creds = { ...obj.credentials } as Record<string, unknown>;
    if (Array.isArray(creds.files) && (creds.files as unknown[]).length === 0) delete creds.files;
    if (Array.isArray(creds.envVars) && (creds.envVars as unknown[]).length === 0) delete creds.envVars;
    if (Array.isArray(creds.awsPairs) && (creds.awsPairs as unknown[]).length === 0) delete creds.awsPairs;
    if (Object.keys(creds).length === 0) delete clean.credentials;
    else clean.credentials = creds;
  }

  // Clean root-level
  if (Array.isArray(clean.excludedCommands) && (clean.excludedCommands as unknown[]).length === 0) delete clean.excludedCommands;
  if (clean.ignoreViolations && Object.keys(clean.ignoreViolations as object).length === 0) delete clean.ignoreViolations;
  for (const k of ['enabled', 'autoAllowBashIfSandboxed', 'enableWeakerNetworkIsolation', 'enableWeakerNestedSandbox', 'allowUnsandboxedCommands', 'allowAppleEvents', 'failIfUnavailable']) {
    if (clean[k] === undefined) delete clean[k];
    if (clean[k] === '') delete clean[k];
  }

  return Object.keys(clean).length === 0 ? undefined : clean as SandboxValue;
}

/** sandbox 子設定（dotted path，不含 `sandbox.`）在該 scope 是否生效。 */
function isSandboxChildEffective(path: string, scope: PluginScope): boolean {
  return isScopeEffective({ effectiveScopes: resolveEffectiveScopes(`sandbox.${path}`) }, scope);
}

function hasVisibleContent(value: unknown, schema: ValueSchema | undefined, inherited: EffectiveScopes | undefined, scope: PluginScope): boolean {
  if (!isScopeEffective({ effectiveScopes: inherited }, scope)) return false;
  if (value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || typeof value !== 'object') return true;
  const properties = schema?.kind === 'object' ? schema.properties : undefined;
  return Object.entries(value).some(([key, child]) => {
    const property = properties?.[key];
    return hasVisibleContent(child, property?.schema, property ? childEffectiveScopes(property, inherited) : inherited, scope);
  });
}

/**
 * sandbox 在該 scope 是否有畫得出來的內容：不生效的子設定（含巢狀）不算，
 * 供設定頁「已自訂」計數判定，與 SandboxEditor 的隱藏規則同一來源（effectiveScopes）。
 */
export function hasVisibleSandboxContent(sandbox: ClaudeSettings['sandbox'], scope: PluginScope): boolean {
  const field = getFlatFieldSchema('sandbox');
  if (!field) throw new Error('Schema key "sandbox" not found');
  return hasVisibleContent(sandbox, field.valueSchema, field.effectiveScopes, scope);
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
    if (!/^\d+$/.test(trimmed)) return;
    const num = Number(trimmed);
    if (Number.isInteger(num) && num >= 1 && num <= 65535) onChange(num);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--vscode-descriptionForeground)', minWidth: 140 }}>{label}</span>
      <input className="input" type="number" value={input} onChange={(e) => setInput(e.target.value)}
        onBlur={handleBlur} placeholder={placeholder} min={1} max={65535} disabled={saving}
        style={{ width: 100 }} />
    </div>
  );
}


// ---------------------------------------------------------------------------
// SandboxAwsPairsEditor — credentials.awsPairs 專用陣列 editor
//
// docs 契約：每個被指名的變數都必須是 credentials.envVars 的 whole-value mask
// entry，且一個變數在所有 pair 中只能填一個 slot。兩者都只是提示（inline 警告），
// 不擋儲存——使用者可能先填 pair 再補 envVars。
// 只有 accessKeyIdVar 與 secretAccessKeyVar 皆填妥的 row 才會寫入設定
//（schema 上兩者為 required，半填的 row 寫出去會被 schema 驗證擋掉）。
// ---------------------------------------------------------------------------

const AWS_PAIR_SLOTS: ReadonlyArray<{ slot: keyof AwsPairDraft; labelKey: string; optional: boolean }> = [
  { slot: 'accessKeyIdVar', labelKey: 'credentials.awsPairs.accessKeyIdVar', optional: false },
  { slot: 'secretAccessKeyVar', labelKey: 'credentials.awsPairs.secretAccessKeyVar', optional: false },
  { slot: 'sessionTokenVar', labelKey: 'credentials.awsPairs.sessionTokenVar', optional: true },
];

const EMPTY_AWS_PAIR: AwsPairDraft = { accessKeyIdVar: '', secretAccessKeyVar: '', sessionTokenVar: '' };

function toDraftRows(pairs: readonly SandboxAwsPair[]): AwsPairDraft[] {
  return pairs.map((p) => ({
    accessKeyIdVar: p.accessKeyIdVar,
    secretAccessKeyVar: p.secretAccessKeyVar,
    sessionTokenVar: p.sessionTokenVar ?? '',
  }));
}

/** 草稿 rows → 可寫入設定的 awsPairs（丟掉必填未齊的 row，空字串 sessionTokenVar 不寫）。 */
function toSavedPairs(rows: readonly AwsPairDraft[]): SandboxAwsPair[] {
  return rows
    .filter((r) => r.accessKeyIdVar.trim() && r.secretAccessKeyVar.trim())
    .map((r) => {
      const pair: SandboxAwsPair = {
        accessKeyIdVar: r.accessKeyIdVar.trim(),
        secretAccessKeyVar: r.secretAccessKeyVar.trim(),
      };
      if (r.sessionTokenVar.trim()) pair.sessionTokenVar = r.sessionTokenVar.trim();
      return pair;
    });
}

/** row 正規化後的存檔身分；必填未齊（存不進設定）時為 null。 */
function savedIdentity(row: AwsPairDraft): string | null {
  const saved = toSavedPairs([row]);
  return saved.length > 0 ? JSON.stringify(saved[0]) : null;
}

/**
 * props（＝已存檔的 pairs）回灌時以「列身分」對位合併進 draft：已存檔的列留在原位置、
 * 不重複出現，半填的列也不因別列存檔而消失。
 *
 * 先比原始內容（才認得出 props 自己就帶著的半填列，避免它同時被當成 incoming 與 local 而複製
 * 一份），再比正規化後的存檔身分（吸收 trim 差異），都對不上且存得進去 → 該列已被外部刪除。
 */
export function mergeDraftRows(
  prev: readonly AwsPairDraft[],
  incoming: readonly AwsPairDraft[],
): AwsPairDraft[] {
  const pool = incoming.map((row) => ({ row, used: false }));
  const take = (match: (row: AwsPairDraft) => boolean): AwsPairDraft | undefined => {
    const hit = pool.find((c) => !c.used && match(c.row));
    if (!hit) return undefined;
    hit.used = true;
    return hit.row;
  };

  const merged: AwsPairDraft[] = [];
  for (const row of prev) {
    const raw = JSON.stringify(row);
    const identity = savedIdentity(row);
    const hit = take((c) => JSON.stringify(c) === raw)
      ?? (identity === null ? undefined : take((c) => savedIdentity(c) === identity));
    if (hit) merged.push(hit);
    else if (identity === null) merged.push(row);
  }
  return [...merged, ...pool.filter((c) => !c.used).map((c) => c.row)];
}

/** 所有 row 中被指名的變數（依出現順序，含重複）。 */
function namedVars(rows: readonly AwsPairDraft[]): string[] {
  return rows.flatMap((r) => AWS_PAIR_SLOTS.map(({ slot }) => r[slot].trim()).filter(Boolean));
}

interface AwsPairWarnings {
  /** 完全沒登記在 credentials.envVars。 */
  unregistered: string[];
  /** 有登記但 mode 不是 mask。 */
  notMask: string[];
  /** mask 但帶 extract／decode，非整值遮罩。 */
  notWholeValue: string[];
  duplicated: string[];
  incompleteRows: number[];
}

/**
 * docs（credentials.awsPairs）：被指名的變數必須是 credentials.envVars 裡的整值 mask
 * entry（不得帶 extract 或 decode），且跨所有 pair 只能填一個 slot。三種不合格情形分開
 * 收集，使用者才知道該改哪裡。
 */
function collectAwsPairWarnings(
  rows: readonly AwsPairDraft[],
  envVars: readonly SandboxCredentialEnvVar[],
): AwsPairWarnings {
  const names = namedVars(rows);
  const registered = new Map(envVars.map((ev) => [ev.name, ev]));
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  const unregistered = new Set<string>();
  const notMask = new Set<string>();
  const notWholeValue = new Set<string>();

  for (const name of names) {
    const entry = registered.get(name);
    if (!entry) unregistered.add(name);
    else if (entry.mode !== 'mask') notMask.add(name);
    else if (entry.extract !== undefined || entry.decode !== undefined) notWholeValue.add(name);
    if (seen.has(name)) duplicated.add(name);
    seen.add(name);
  }

  const incompleteRows = rows
    .map((r, i) => (
      (r.accessKeyIdVar.trim() || r.secretAccessKeyVar.trim() || r.sessionTokenVar.trim()) &&
      !(r.accessKeyIdVar.trim() && r.secretAccessKeyVar.trim())
        ? i
        : -1
    ))
    .filter((i) => i >= 0);

  return {
    unregistered: [...unregistered],
    notMask: [...notMask],
    notWholeValue: [...notWholeValue],
    duplicated: [...duplicated],
    incompleteRows,
  };
}

function SandboxAwsPairsEditor({ pairs, envVars, saving, tk, onChange }: {
  pairs: readonly SandboxAwsPair[];
  envVars: readonly SandboxCredentialEnvVar[];
  saving: boolean;
  tk: (suffix: string) => string;
  onChange: (pairs: SandboxAwsPair[]) => void;
}): React.ReactElement {
  const serialized = JSON.stringify(pairs);
  const [rows, setRows] = useState<AwsPairDraft[]>(() => toDraftRows(pairs));

  // props 只帶「已存檔的 pairs」，回灌時以列身分對位合併（見 mergeDraftRows）：
  // 已存檔列不重複、順序穩定，半填／剛新增的空列也不因別列存檔而消失。
  useEffect(() => {
    const incoming = toDraftRows(JSON.parse(serialized) as SandboxAwsPair[]);
    setRows((prev) => mergeDraftRows(prev, incoming));
  }, [serialized]);

  // 只在「可寫入的 pairs」真的變了才回寫：半填的 row 或純 blur 不該觸發一次無意義的存檔。
  // 兩側都經 toSavedPairs 正規化，避免設定檔的 key 順序或 sessionTokenVar:'' 造成假差異。
  const commit = (next: AwsPairDraft[]): void => {
    const saved = toSavedPairs(next);
    if (JSON.stringify(saved) === JSON.stringify(toSavedPairs(toDraftRows(pairs)))) return;
    onChange(saved);
  };

  const warnings = collectAwsPairWarnings(rows, envVars);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>
        {tk('credentials.awsPairs.label')}
      </div>
      <p className="settings-field-description" style={{ marginTop: 0 }}>{tk('credentials.awsPairs.description')}</p>
      {rows.length === 0 && <span className="perm-empty">{tk('credentials.awsPairs.empty')}</span>}
      {rows.map((row, index) => (
        <div
          key={index}
          style={{ border: '1px solid var(--vscode-editorWidget-border)', borderRadius: 4, padding: 8, marginBottom: 6 }}
        >
          {AWS_PAIR_SLOTS.map(({ slot, labelKey, optional }) => (
            <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <label
                htmlFor={`sandbox-awsPairs-${index}-${slot}`}
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--vscode-descriptionForeground)', minWidth: 160 }}
              >
                {tk(labelKey)}{optional ? ` ${tk('credentials.awsPairs.optionalSuffix')}` : ''}
              </label>
              <input
                id={`sandbox-awsPairs-${index}-${slot}`}
                className="input"
                type="text"
                value={row[slot]}
                placeholder={tk(`${labelKey}.placeholder`)}
                disabled={saving}
                onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [slot]: e.target.value } : r)))}
                onBlur={() => commit(rows)}
              />
            </div>
          ))}
          <button
            className="btn btn-secondary"
            type="button"
            disabled={saving}
            aria-label={`${tk('credentials.awsPairs.remove')} ${index + 1}`}
            onClick={() => {
              const next = rows.filter((_, i) => i !== index);
              setRows(next);
              commit(next);
            }}
          >
            {tk('credentials.awsPairs.remove')}
          </button>
        </div>
      ))}
      <button
        className="btn btn-primary"
        type="button"
        disabled={saving}
        onClick={() => setRows((prev) => [...prev, { ...EMPTY_AWS_PAIR }])}
      >
        {tk('credentials.awsPairs.add')}
      </button>
      {([
        ['unregistered', warnings.unregistered],
        ['notMask', warnings.notMask],
        ['hasExtractOrDecode', warnings.notWholeValue],
      ] as const).map(([key, vars]) => (
        vars.length > 0 && (
          <p className="perm-add-error" role="alert" key={key}>
            {tk(`credentials.awsPairs.warning.${key}`).replace('{vars}', vars.join(', '))}
          </p>
        )
      ))}
      {warnings.duplicated.length > 0 && (
        <p className="perm-add-error" role="alert">
          {tk('credentials.awsPairs.warning.duplicated').replace('{vars}', warnings.duplicated.join(', '))}
        </p>
      )}
      {warnings.incompleteRows.length > 0 && (
        <p className="perm-add-error" role="alert">
          {tk('credentials.awsPairs.warning.incomplete')}
        </p>
      )}
    </div>
  );
}

/**
 * TagInput 只回傳名稱清單，但 credentials.files / envVars 的 entry 還帶 mode、extract、
 * decode、injectHosts 等選填欄位。以 key 欄位對齊既有 entry 原封保留，只有新名稱才建
 * 預設 deny entry，被移除的名稱才消失——否則加刪一個名稱就會把使用者的 mask 設定重建成
 * all-deny（驗證得過、靜默降級）。
 *
 * 同 id 出現多筆時（陣列內名稱唯一性無驗證把關，JSON 模式存得出來）折疊成一筆，且依 docs
 * （credentials.envVars：deny takes precedence when the same variable appears with both modes）
 * 讓 deny 勝出——後蓋前會把「完全阻擋」靜默降級成「遮罩注入」，真實憑證流進 sandbox。
 */
export function mergeCredentialEntries<T extends { mode: 'deny' | 'mask' }>(
  existing: readonly T[],
  items: readonly string[],
  key: keyof T & string,
): T[] {
  const byId = new Map<string, T>();
  for (const entry of existing) {
    const id = String(entry[key]);
    const kept = byId.get(id);
    if (kept === undefined || (kept.mode !== 'deny' && entry.mode === 'deny')) byId.set(id, entry);
  }
  return [...new Set(items)].map(
    (item) => byId.get(item) ?? ({ [key]: item, mode: 'deny' } as unknown as T),
  );
}

// ---------------------------------------------------------------------------
// SandboxEditor
// ---------------------------------------------------------------------------

export function SandboxEditor({ sandbox, scope, onSave, onDelete }: SandboxEditorProps): React.ReactElement {
  const { t } = useI18n();
  const { saving, withSave } = useSettingSave();
  const [mode, setMode] = useState<SandboxMode>('structured');
  const [jsonText, setJsonText] = useState(sandbox ? JSON.stringify(sandbox, null, 2) : '');
  const [jsonError, setJsonError] = useState('');

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
  const saveSandbox = (updated: SandboxValue): void => {
    void withSave(async () => {
      const cleaned = cleanSandbox(updated);
      if (cleaned) {
        validateJsonSettingValue('sandbox', cleaned);
        await onSave('sandbox', cleaned);
      } else {
        await onDelete('sandbox');
      }
    });
  };

  const draft: SandboxValue = sandbox ?? {};

  const updateBool = (key: keyof SandboxValue, val: boolean): void => {
    void saveSandbox({ ...draft, [key]: val });
  };

  const updateList = (key: 'excludedCommands', items: string[]): void => {
    void saveSandbox({ ...draft, [key]: items });
  };

  const updateFs = (key: SandboxFilesystemArrayKey, items: string[]): void => {
    void saveSandbox({ ...draft, filesystem: { ...draft.filesystem, [key]: items } });
  };

  const updateFsBool = (key: SandboxFilesystemBooleanKey, val: boolean): void => {
    void saveSandbox({ ...draft, filesystem: { ...draft.filesystem, [key]: val } });
  };

  const updateNet = (key: string, val: unknown): void => {
    void saveSandbox({ ...draft, network: { ...draft.network, [key]: val } });
  };

  const updateCredentialFiles = (items: string[]): void => {
    const files = mergeCredentialEntries(draft.credentials?.files ?? [], items, 'path');
    void saveSandbox({ ...draft, credentials: { ...draft.credentials, files } });
  };

  const updateCredentialEnvVars = (items: string[]): void => {
    const envVars = mergeCredentialEntries(draft.credentials?.envVars ?? [], items, 'name');
    void saveSandbox({ ...draft, credentials: { ...draft.credentials, envVars } });
  };

  const updateCredentialAwsPairs = (awsPairs: SandboxAwsPair[]): void => {
    void saveSandbox({ ...draft, credentials: { ...draft.credentials, awsPairs } });
  };

  // 不生效 scope 的子設定控件不顯示；既有值留在 draft，其他控件存檔時原樣帶回。JSON 模式不過濾。
  const generalCheckboxes = ([
    { key: 'enabled', label: tk('enabled') },
    { key: 'autoAllowBashIfSandboxed', label: tk('autoAllowBash') },
    { key: 'enableWeakerNetworkIsolation', label: tk('weakerNetwork') },
    { key: 'enableWeakerNestedSandbox', label: tk('weakerNested') },
    { key: 'allowUnsandboxedCommands', label: tk('allowUnsandboxed') },
    { key: 'allowAppleEvents', label: tk('allowAppleEvents') },
    { key: 'failIfUnavailable', label: tk('failIfUnavailable') },
  ] satisfies Array<{ key: SandboxBooleanKey; label: string }>).filter(({ key }) => isSandboxChildEffective(key, scope));

  const filesystemTagLists: Array<{ key: SandboxFilesystemArrayKey; labelKey: string }> = [
    { key: 'allowWrite', labelKey: 'filesystem.allowWrite' },
    { key: 'denyWrite', labelKey: 'filesystem.denyWrite' },
    { key: 'allowRead', labelKey: 'filesystem.allowRead' },
    { key: 'denyRead', labelKey: 'filesystem.denyRead' },
  ];

  const filesystemCheckboxes = ([
    { key: 'disabled', label: tk('filesystem.disabled') },
  ] satisfies Array<{ key: SandboxFilesystemBooleanKey; label: string }>).filter(({ key }) => isSandboxChildEffective(`filesystem.${key}`, scope));

  const networkCheckboxes = ([
    { key: 'allowAllUnixSockets', label: tk('network.allowAllUnixSockets') },
    { key: 'allowLocalBinding', label: tk('network.allowLocalBinding') },
    { key: 'strictAllowlist', label: tk('network.strictAllowlist') },
  ] satisfies Array<{ key: SandboxNetworkBooleanKey; label: string }>).filter(({ key }) => isSandboxChildEffective(`network.${key}`, scope));

  const networkTagLists: Array<{ key: SandboxNetworkArrayKey; labelKey: string }> = [
    { key: 'allowedDomains', labelKey: 'network.allowedDomains' },
    { key: 'deniedDomains', labelKey: 'network.deniedDomains' },
    { key: 'allowUnixSockets', labelKey: 'network.allowUnixSockets' },
    { key: 'allowMachLookup', labelKey: 'network.allowMachLookup' },
  ];

  const networkNumberInputs: Array<{ key: SandboxNetworkNumberKey; labelKey: string }> = [
    { key: 'httpProxyPort', labelKey: 'network.httpProxyPort' },
    { key: 'socksProxyPort', labelKey: 'network.socksProxyPort' },
  ];

  // --- JSON mode handlers ---
  const handleJsonSave = (): void => {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      void withSave(() => onDelete('sandbox'));
      return;
    }
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); } catch (e) {
      setJsonError(t('settings.advanced.sandbox.invalidJson' as Parameters<typeof t>[0], { error: toErrorMessage(e) }));
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setJsonError(t('settings.advanced.sandbox.invalidObject'));
      return;
    }
    try {
      validateJsonSettingValue('sandbox', parsed);
    } catch (e) {
      setJsonError(toErrorMessage(e));
      return;
    }
    void withSave(() => onSave('sandbox', parsed));
  };

  const handleJsonDelete = (): void => {
    void withSave(() => onDelete('sandbox'));
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
            <button className="btn btn-primary" onClick={handleJsonSave} disabled={saving} type="button">
              {t('settings.advanced.sandbox.save')}
            </button>
            {sandbox && (
              <button className="btn btn-secondary" onClick={handleJsonDelete} disabled={saving} type="button">
                {t('settings.advanced.sandbox.clear')}
              </button>
            )}
          </div>
        </>
      ) : (
        <div>
          {/* General */}
          {generalCheckboxes.map(({ key, label }) => (
            <SandboxCheckbox
              key={key}
              label={label}
              checked={draft[key] ?? false}
              saving={saving}
              onChange={(value) => updateBool(key, value)}
            />
          ))}

          <SandboxTagList label={tk('excludedCommands')} items={draft.excludedCommands ?? []}
            empty={tk('excludedCommands.empty')} placeholder={tk('excludedCommands.placeholder')}
            duplicate={tk('excludedCommands.duplicate')} saving={saving}
            onChange={(items) => updateList('excludedCommands', items)} />

          {/* Filesystem */}
          <h4 style={{ fontSize: 12, fontWeight: 600, marginTop: 12, marginBottom: 6, borderTop: '1px solid var(--vscode-editorWidget-border)', paddingTop: 8 }}>
            {tk('filesystem')}
          </h4>
          {filesystemTagLists.map(({ key, labelKey }) => (
            <SandboxTagList
              key={key}
              label={tk(labelKey)}
              items={draft.filesystem?.[key] ?? []}
              empty={tk(`${labelKey}.empty`)}
              placeholder={tk(`${labelKey}.placeholder`)}
              duplicate={tk(`${labelKey}.duplicate`)}
              saving={saving}
              onChange={(items) => updateFs(key, items)}
            />
          ))}
          {filesystemCheckboxes.map(({ key, label }) => (
            <SandboxCheckbox
              key={key}
              label={label}
              checked={draft.filesystem?.[key] ?? false}
              saving={saving}
              onChange={(value) => updateFsBool(key, value)}
            />
          ))}
          {/* Network */}
          <h4 style={{ fontSize: 12, fontWeight: 600, marginTop: 12, marginBottom: 6, borderTop: '1px solid var(--vscode-editorWidget-border)', paddingTop: 8 }}>
            {tk('network')}
          </h4>
          {networkTagLists.map(({ key, labelKey }) => (
            <SandboxTagList
              key={key}
              label={tk(labelKey)}
              items={draft.network?.[key] ?? []}
              empty={tk(`${labelKey}.empty`)}
              placeholder={tk(`${labelKey}.placeholder`)}
              duplicate={tk(`${labelKey}.duplicate`)}
              saving={saving}
              onChange={(items) => updateNet(key, items)}
            />
          ))}
          {networkCheckboxes.map(({ key, label }) => (
            <SandboxCheckbox
              key={key}
              label={label}
              checked={draft.network?.[key] ?? false}
              saving={saving}
              onChange={(value) => updateNet(key, value)}
            />
          ))}
          {networkNumberInputs.map(({ key, labelKey }) => (
            <SandboxNumberInput
              key={key}
              label={tk(labelKey)}
              value={draft.network?.[key]}
              placeholder={tk(`${labelKey}.placeholder`)}
              saving={saving}
              onChange={(value) => updateNet(key, value)}
            />
          ))}

          {/* Credentials */}
          <h4 style={{ fontSize: 12, fontWeight: 600, marginTop: 12, marginBottom: 6, borderTop: '1px solid var(--vscode-editorWidget-border)', paddingTop: 8 }}>
            {tk('credentials')}
          </h4>
          <SandboxTagList
            label={tk('credentials.files.label')}
            items={(draft.credentials?.files ?? []).map((f) => f.path)}
            empty={tk('credentials.files.empty')}
            placeholder={tk('credentials.files.placeholder')}
            duplicate={tk('credentials.files.duplicate')}
            saving={saving}
            onChange={updateCredentialFiles}
          />
          <SandboxTagList
            label={tk('credentials.envVars.label')}
            items={(draft.credentials?.envVars ?? []).map((ev) => ev.name)}
            empty={tk('credentials.envVars.empty')}
            placeholder={tk('credentials.envVars.placeholder')}
            duplicate={tk('credentials.envVars.duplicate')}
            saving={saving}
            onChange={updateCredentialEnvVars}
          />
          {isSandboxChildEffective('credentials.awsPairs', scope) && (
            <SandboxAwsPairsEditor
              pairs={draft.credentials?.awsPairs ?? []}
              envVars={draft.credentials?.envVars ?? []}
              saving={saving}
              tk={tk}
              onChange={updateCredentialAwsPairs}
            />
          )}

          {/* Clear */}
          {sandbox && (
            <div className="settings-actions" style={{ marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={handleJsonDelete} disabled={saving} type="button">
                {t('settings.advanced.sandbox.clear')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
