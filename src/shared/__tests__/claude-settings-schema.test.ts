import { describe, it, expect } from 'vitest';
import type { ClaudeSettings, HookCommand } from '../claude-settings-schema';
import {
  CLAUDE_SETTINGS_SCHEMA,
  getAllFlatFieldSchemas,
  getFlatFieldSchema,
  getGlobalConfigSettingKeys,
  getSchemaDefault,
  getSchemaEnumOptions,
  SETTINGS_SECTION_KEYS,
  getSettingsSections,
  getValueSchemaEnumOptions,
  getValueSchemaNumberMeta,
} from '../claude-settings-schema';

type Assert<T extends true> = T;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type _ClaudeSettingsCompileTimeChecks = [
  Assert<IsEqual<ClaudeSettings['viewMode'], 'default' | 'verbose' | 'focus' | undefined>>,
  Assert<IsEqual<ClaudeSettings['editorMode'], 'normal' | 'vim' | undefined>>,
  Assert<IsEqual<ClaudeSettings['preferredNotifChannel'], 'auto' | 'terminal_bell' | 'iterm2' | 'iterm2_with_bell' | 'kitty' | 'ghostty' | 'notifications_disabled' | undefined>>,
  Assert<IsEqual<ClaudeSettings['teammateDefaultModel'], string | null | undefined>>,
  Assert<IsEqual<ClaudeSettings['voice'], { enabled?: boolean; mode?: 'hold' | 'tap'; autoSubmit?: boolean } | undefined>>,
  Assert<IsEqual<ClaudeSettings['forceLoginOrgUUID'], string | string[] | undefined>>,
  Assert<IsEqual<ClaudeSettings['modelPicker'], { options: Array<{ model: string; label?: string; description?: string }>; replaceBuiltInOptions?: boolean } | undefined>>,
  Assert<IsEqual<ClaudeSettings['modelSettings'], Record<string, { effortLevel: 'low' | 'medium' | 'high' | 'xhigh' }> | undefined>>,
  Assert<IsEqual<ClaudeSettings['promptCacheTtl'], '5m' | '1h' | undefined>>,
  Assert<IsEqual<ClaudeSettings['subagentPromptCacheTtl'], '5m' | '1h' | undefined>>,
  Assert<IsEqual<ClaudeSettings['sshConfigs'], Array<{ id: string; name: string; sshHost: string; sshPort?: number; sshIdentityFile?: string; startDirectory?: string }> | undefined>>,
  Assert<IsEqual<NonNullable<ClaudeSettings['permissions']>['disableBypassPermissionsMode'], 'disable' | undefined>>,
  Assert<IsEqual<NonNullable<ClaudeSettings['statusLine']>['refreshInterval'], number | undefined>>,
  Assert<IsEqual<NonNullable<ClaudeSettings['statusLine']>['hideVimModeIndicator'], boolean | undefined>>,
  Assert<IsEqual<NonNullable<ClaudeSettings['worktree']>['symlinkDirectories'], string[] | undefined>>,
  // Managed settings only：value shape 要容忍（不做 UI），型別上必須存在，
  // 否則含這些 key 的既有設定檔會讓整個 sandbox 編輯區驗證失敗鎖死。
  Assert<IsEqual<NonNullable<ClaudeSettings['sandbox']>['bwrapPath'], string | undefined>>,
  Assert<IsEqual<NonNullable<ClaudeSettings['sandbox']>['socatPath'], string | undefined>>,
  Assert<IsEqual<NonNullable<NonNullable<ClaudeSettings['sandbox']>['filesystem']>['allowManagedReadPathsOnly'], boolean | undefined>>,
  Assert<IsEqual<NonNullable<NonNullable<ClaudeSettings['sandbox']>['network']>['allowManagedDomainsOnly'], boolean | undefined>>,
  Assert<IsEqual<NonNullable<ClaudeSettings['spinnerVerbs']>['verbs'], string[]>>,
  Assert<IsEqual<NonNullable<ClaudeSettings['companyAnnouncements']>, string[]>>,
  Assert<IsEqual<ClaudeSettings['hooks'], Record<string, Array<{ matcher?: string; hooks: HookCommand[] }>> | undefined>>,
];

const flatSchema = getAllFlatFieldSchemas();

describe('claude-settings-schema', () => {
  const schemaKeys = new Set(Object.keys(flatSchema));
  const topLevelKeys = Object.entries(flatSchema)
    .filter(([, field]) => field.nestedUnder === undefined)
    .map(([key]) => key);

  it('top-level setting keys 不重複（nestedUnder 欄位除外）', () => {
    expect(new Set(topLevelKeys).size).toBe(topLevelKeys.length);
  });

  it('top-level schema keys 與 type source map keys 一致', () => {
    expect(topLevelKeys).not.toContain('defaultMode');
    expect(topLevelKeys).not.toContain('channelsEnabled');
    expect(topLevelKeys).toContain('permissions');
    expect(topLevelKeys).toContain('hooks');
    expect(topLevelKeys).toContain('worktree');
  });

  it('每個 schema entry 都有 section', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      expect(field.section, `${key}.section`).toBeTruthy();
    }
  });

  it('nestedUnder key 對應到父物件中的同名 property', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      if (!field.nestedUnder) continue;
      const parent = flatSchema[field.nestedUnder];
      expect(parent, `${key} nestedUnder parent not found`).toBeTruthy();
      expect(parent.valueSchema.kind, `${key} parent must be object`).toBe('object');
      if (parent.valueSchema.kind === 'object') {
        expect(parent.valueSchema.properties[key], `${key} missing in parent object schema`).toBeTruthy();
      }
    }
  });

  it('每個 schema entry 都有 valueSchema 與 controlType', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      expect(field.valueSchema, `${key} 缺少 valueSchema`).toBeTruthy();
      expect(field.controlType, `${key} 缺少 controlType`).toBeTruthy();
    }
  });

  it('String + options 的 entry 必須有非空 options 陣列', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      const enumValues = getValueSchemaEnumOptions(field.valueSchema);
      if (field.controlType === String && enumValues) {
        expect(enumValues.length, `${key} options 不可為空`).toBeGreaterThan(0);
      }
    }
  });

  it('非 String 的 entry 不應有 options', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      if (field.controlType !== String) {
        expect(getValueSchemaEnumOptions(field.valueSchema), `${key} controlType=${field.controlType.name} 不應有 options`).toBeUndefined();
      }
    }
  });

  it('number 欄位的 min <= max', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      const numberMeta = getValueSchemaNumberMeta(field.valueSchema);
      if (numberMeta?.min !== undefined && numberMeta.max !== undefined) {
        expect(numberMeta.min, `${key} min(${numberMeta.min}) > max(${numberMeta.max})`).toBeLessThanOrEqual(numberMeta.max);
      }
    }
  });

  it('min/max/step 只出現在 controlType=Number', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      if (field.controlType !== Number) {
        const numberMeta = getValueSchemaNumberMeta(field.valueSchema);
        expect(numberMeta?.min, `${key} 非 Number 不應有 min`).toBeUndefined();
        expect(numberMeta?.max, `${key} 非 Number 不應有 max`).toBeUndefined();
        expect(numberMeta?.step, `${key} 非 Number 不應有 step`).toBeUndefined();
      }
    }
  });

  it('controlType 值屬於合法 ControlType', () => {
    const validControlTypes = [String, Number, Boolean, Array, Object];
    for (const [key, field] of Object.entries(flatSchema)) {
      expect(
        validControlTypes.includes(field.controlType),
        `${key} 的 controlType 不是合法值`,
      ).toBe(true);
    }
  });

  it('section 值屬於合法 SettingsSection', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      expect(
        SETTINGS_SECTION_KEYS.includes(field.section),
        `${key} 的 section "${field.section}" 不是合法值`,
      ).toBe(true);
    }
  });

  it('settings section 順序直接來自 schema 宣告順序', () => {
    expect(getSettingsSections()).toEqual(SETTINGS_SECTION_KEYS);
    expect(getSettingsSections()).toEqual(Object.keys(CLAUDE_SETTINGS_SCHEMA));
  });

  it('controlType 預設由 valueSchema 推導，僅少數欄位保留 override', () => {
    expect(flatSchema.effortLevel?.controlType).toBe(String);
    expect(flatSchema.cleanupPeriodDays?.controlType).toBe(Number);
    expect(flatSchema.permissions?.controlType).toBe(Object);
    expect(flatSchema.availableModels?.controlType).toBe(Array);

    // Override: array/union 欄位刻意用 custom renderer 或 string selector
    expect(flatSchema.companyAnnouncements?.valueSchema.kind).toBe('array');
    expect(flatSchema.companyAnnouncements?.controlType).toBe(Object);
    expect(flatSchema.forceLoginOrgUUID?.valueSchema.kind).toBe('union');
    expect(flatSchema.forceLoginOrgUUID?.controlType).toBe(String);
  });
});

describe('getSchemaEnumOptions', () => {
  it('回傳已知 enum key 的 options', () => {
    expect(getSchemaEnumOptions('effortLevel')).toEqual(['max', 'xhigh', 'high', 'medium', 'low']);
    expect(getSchemaEnumOptions('autoUpdatesChannel')).toEqual(['stable', 'latest']);
    // #25：docs Type 有列 'iterm2'，CLI enum 偵測不到（人工對照發現）。
    expect(getSchemaEnumOptions('teammateMode')).toEqual(['auto', 'in-process', 'tmux', 'iterm2']);
    expect(getSchemaEnumOptions('editorMode')).toEqual(['normal', 'vim']);
    expect(getSchemaEnumOptions('preferredNotifChannel')).toEqual(['auto', 'terminal_bell', 'iterm2', 'iterm2_with_bell', 'kitty', 'ghostty', 'notifications_disabled']);
    expect(getSchemaEnumOptions('forceLoginMethod')).toEqual(['claudeai', 'console']);
  });

  it('不存在的 key → 拋出 Error', () => {
    expect(() => getSchemaEnumOptions('nonExistent')).toThrow('not found');
  });

  it('非 enum 的 key → 拋出 Error', () => {
    expect(() => getSchemaEnumOptions('model')).toThrow('not an enum');
  });
});

describe('getSchemaDefault', () => {
  it('有 default 的 key 回傳正確值', () => {
    expect(getSchemaDefault('fastMode')).toBe(false);
    expect(getSchemaDefault('autoMemoryEnabled')).toBe(true);
    expect(getSchemaDefault('cleanupPeriodDays')).toBe(30);
    expect(getSchemaDefault('plansDirectory')).toBe('~/.claude/plans');
    expect(getSchemaDefault('prefersReducedMotion')).toBe(false);
    // teammateMode：docs 預設為 'in-process'（#25，原本 schema 誤寫 'auto'）。
    expect(getSchemaDefault('teammateMode')).toBe('in-process');
    expect(getSchemaDefault('editorMode')).toBe('normal');
    expect(getSchemaDefault('preferredNotifChannel')).toBe('auto');
    expect(getSchemaDefault('autoScrollEnabled')).toBe(true);
    expect(getSchemaDefault('awaySummaryEnabled')).toBe(true);
    expect(getSchemaDefault('syntaxHighlightingDisabled')).toBe(false);
    expect(getSchemaDefault('externalEditorContext')).toBe(false);
    expect(getSchemaDefault('autoConnectIde')).toBe(false);
    expect(getSchemaDefault('autoInstallIdeExtension')).toBe(true);
    expect(getSchemaDefault('autoContinueAtUsageLimit')).toBe(true);
    expect(getSchemaDefault('desktopSessionCleanupPeriodDays')).toBe(0);
    expect(getSchemaDefault('feedbackDrafts')).toBe('notify');
    expect(getSchemaDefault('terminalTitleFromRename')).toBe(true);
    expect(getSchemaDefault('disableAgentView')).toBe(false);
    expect(getSchemaDefault('disableRemoteControl')).toBe(false);
    expect(getSchemaDefault('skillListingMaxDescChars')).toBe(1536);
    expect(getSchemaDefault('skillListingBudgetFraction')).toBe(0.01);
    // #25：docs 明寫的固定預設值（原本 schema 寫反或缺漏）。
    expect(getSchemaDefault('alwaysThinkingEnabled')).toBe(true);
    expect(getSchemaDefault('useAutoModeDuringPlan')).toBe(true);
  });

  it('無 default 的 key 回傳 undefined', () => {
    expect(getSchemaDefault('model')).toBeUndefined();
    expect(getSchemaDefault('language')).toBeUndefined();
    expect(getSchemaDefault('enableWorkflows')).toBeUndefined();
    expect(getSchemaDefault('syncClaudeAiSkills')).toBeUndefined();
    // #25：docs 只寫「unset」或行為取決於帳號／組織，schema 拿掉固定 default。
    expect(getSchemaDefault('effortLevel')).toBeUndefined();
    expect(getSchemaDefault('keybindingFlavor')).toBeUndefined();
    expect(getSchemaDefault('voiceEnabled')).toBeUndefined();
    expect(getSchemaDefault('remoteControlAtStartup')).toBeUndefined();
    expect(getSchemaDefault('disableArtifact')).toBeUndefined();
    expect(getSchemaDefault('workflowSizeGuideline')).toBeUndefined();
  });

  it('不存在的 key → 拋出 Error', () => {
    expect(() => getSchemaDefault('nonExistent')).toThrow('not found');
  });

  // Keys documented as having no fixed default — the effective default is
  // dynamic (e.g. account-tier dependent) rather than a stable true/false,
  // so encoding one here would misstate docs. Verified 2026-07-21 against
  // https://code.claude.com/docs/en/settings.md ("When unset, the default
  // follows the feature's availability for your account").
  // isolatePeerMachines: docs settings.md 該列沒有 **Default**: prose（`true` 只在 Example 欄），
  // cross-session-messaging.md 明寫「Set isolatePeerMachines to true to require approval」＝
  // opt-in，未設就不攔，因此不得編出 default。Verified 2026-08-21.
  // voiceEnabled/remoteControlAtStartup/disableArtifact: #25 拍板紀錄——實際值取決於
  // 帳號／組織，寫死預設會讓某個值存不進去；寧可畫面顯示不確定，也不要讓某個值存不進去。
  // Verified 2026-09-23 against settings-reference.md.
  const BOOLEAN_KEYS_WITHOUT_FIXED_DEFAULT = new Set([
    'enableArtifact',
    'isolatePeerMachines',
    'enableWorkflows',
    'syncClaudeAiSkills',
    'voiceEnabled',
    'remoteControlAtStartup',
    'disableArtifact',
  ]);

  it('所有 Boolean entry 都有 default 值（documented dynamic-default keys 除外）', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      if (field.controlType === Boolean && !BOOLEAN_KEYS_WITHOUT_FIXED_DEFAULT.has(key)) {
        expect(field.default, `${key} Boolean entry 缺少 default`).not.toBeUndefined();
        expect(typeof field.default, `${key} default 應為 boolean`).toBe('boolean');
      }
    }
  });

  it('String + options 的 default 值在 options 中', () => {
    for (const [key, field] of Object.entries(flatSchema)) {
      const enumValues = getValueSchemaEnumOptions(field.valueSchema);
      if (field.controlType === String && enumValues && field.default !== undefined) {
        expect(enumValues).toContain(field.default);
      }
    }
  });
});

describe('getGlobalConfigSettingKeys', () => {
  // 依官方文件應存在 ~/.claude.json（頂層 key）而非 settings.json 的 6 個 key。
  // workflowSizeGuideline 依 #25 拍板 P3 移出（docs Scope 為 Any file，改存 settings 檔），
  // 7 → 6。
  const EXPECTED_GLOBAL_CONFIG_KEYS = [
    'autoConnectIde',
    'autoInstallIdeExtension',
    'diffTool',
    'externalEditorContext',
    'permissionExplainerEnabled',
    'teammateDefaultModel',
  ];

  it('回傳精確 6 個 key（排序後比對，防止漏標或多標）', () => {
    const keys = getGlobalConfigSettingKeys();
    expect(keys.length).toBe(6);
    expect([...keys].sort()).toEqual([...EXPECTED_GLOBAL_CONFIG_KEYS].sort());
  });

  it.each(EXPECTED_GLOBAL_CONFIG_KEYS)('%s 的 flat field schema storageFile 為 "globalConfig"', (key) => {
    expect(getFlatFieldSchema(key)?.storageFile).toBe('globalConfig');
  });

  it.each(['model', 'effortLevel', 'workflowSizeGuideline'])('%s（非 globalConfig 欄位）storageFile 為 undefined', (key) => {
    expect(getFlatFieldSchema(key)?.storageFile).toBeUndefined();
  });
});
