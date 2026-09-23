/**
 * #24 — 「可生效的存檔位置」登錄（effectiveScopes）純函式測試。
 *
 * 設定只在它真的會生效的存檔位置出現：schema 欄位登錄 `effectiveScopes`
 * （USER_SCOPE_ONLY / USER_AND_LOCAL_SCOPES；未登錄 = 任何檔案都生效），
 * `isScopeEffective` 判斷單一欄位在某 scope 是否生效，`resolveEffectiveScopes`
 * 依 dotted path（含 sandbox 巢狀子設定）解析出該欄位的登錄，找不到 key 要 fail-fast。
 *
 * 20 個 docs 標為 user-only／user+local 的 key 詳見 spec-24；本測試逐一釘住登錄，
 * 之後 schema 改動漏掉某個 key 的登錄會立刻紅燈。
 */
import { describe, it, expect } from 'vitest';
import {
  isScopeEffective,
  resolveEffectiveScopes,
  getFlatFieldSchema,
  USER_SCOPE_ONLY,
  USER_AND_LOCAL_SCOPES,
} from '../claude-settings-schema';

describe('isScopeEffective', () => {
  it('未登錄 effectiveScopes → 任何 scope 都生效', () => {
    expect(isScopeEffective({}, 'user')).toBe(true);
    expect(isScopeEffective({}, 'project')).toBe(true);
    expect(isScopeEffective({}, 'local')).toBe(true);
  });

  it('USER_SCOPE_ONLY → 只有 user 生效', () => {
    const meta = { effectiveScopes: USER_SCOPE_ONLY };
    expect(isScopeEffective(meta, 'user')).toBe(true);
    expect(isScopeEffective(meta, 'project')).toBe(false);
    expect(isScopeEffective(meta, 'local')).toBe(false);
  });

  it('USER_AND_LOCAL_SCOPES → user 與 local 生效，project 不生效', () => {
    const meta = { effectiveScopes: USER_AND_LOCAL_SCOPES };
    expect(isScopeEffective(meta, 'user')).toBe(true);
    expect(isScopeEffective(meta, 'project')).toBe(false);
    expect(isScopeEffective(meta, 'local')).toBe(true);
  });

  it('storageFile=globalConfig（未另外登錄 effectiveScopes）→ isScopeEffective 本身就判 user-only', () => {
    // 依設計：isScopeEffective 統一吃兩條「只在 user 生效」的登錄來源
    // （globalConfig 存放位置 與 effectiveScopes 登錄），呼叫端（isFieldVisibleForScope）
    // 不需要自己再疊加一次 globalConfig 判斷。
    const meta = { storageFile: 'globalConfig' as const };
    expect(isScopeEffective(meta, 'user')).toBe(true);
    expect(isScopeEffective(meta, 'project')).toBe(false);
    expect(isScopeEffective(meta, 'local')).toBe(false);
  });
});

describe('resolveEffectiveScopes — 扁平 user-only 欄位（13 個）', () => {
  it.each([
    'askUserQuestionTimeout',
    'autoContinueAtUsageLimit',
    'autoMode',
    'classifyAllShell',
    'desktopSessionCleanupPeriodDays',
    'dialogExpiry',
    'feedbackDrafts',
    'footerLinksRegexes',
    'modelPicker',
    'processWrapper',
    'spellcheck',
    'sshConfigs',
    'vimInsertModeRemaps',
  ])('%s → USER_SCOPE_ONLY', (key) => {
    expect(resolveEffectiveScopes(key)).toEqual(USER_SCOPE_ONLY);
  });

  it('classifyAllShell 在扁平 schema 上直接帶自己的 effectiveScopes 登錄（非只靠繼承 autoMode）', () => {
    // resolveEffectiveScopes 對扁平 key 不會走 nestedUnder 尋祖，本來就測不出「有沒有自己登錄」；
    // 直接斷言 flat field 本體的 effectiveScopes 存在，才釘住「classifyAllShell 必須有自己的登錄」
    // 這個設計要求（而非只靠 autoMode 這個父層 key 的登錄頂著）。
    const schema = getFlatFieldSchema('classifyAllShell') as unknown as { effectiveScopes?: readonly string[] };
    expect(schema.effectiveScopes).toEqual(USER_SCOPE_ONLY);
  });
});

describe('resolveEffectiveScopes — 扁平 user+local 欄位（3 個）', () => {
  it.each([
    'skipDangerousModePermissionPrompt',
    'syncClaudeAiSkills',
    'useAutoModeDuringPlan',
  ])('%s → USER_AND_LOCAL_SCOPES', (key) => {
    expect(resolveEffectiveScopes(key)).toEqual(USER_AND_LOCAL_SCOPES);
  });
});

describe('resolveEffectiveScopes — sandbox 巢狀子設定（user-only，含無 UI 控件的 4 個）', () => {
  it.each([
    'sandbox.allowAppleEvents',
    'sandbox.credentials.awsPairs',
    'sandbox.credentials.allowPlaintextInject',
    'sandbox.credentials.sigv4',
    'sandbox.filesystem.disabled',
    'sandbox.network.strictAllowlist',
    'sandbox.network.tlsTerminate',
    'sandbox.ripgrep',
  ])('%s → USER_SCOPE_ONLY', (path) => {
    expect(resolveEffectiveScopes(path)).toEqual(USER_SCOPE_ONLY);
  });

  it('繼承：sandbox.ripgrep.args 沒有自己的登錄，繼承最近祖先 sandbox.ripgrep 的 USER_SCOPE_ONLY', () => {
    // docs 的 sandbox.ripgrep 是 container-level 行（只登錄在 ripgrep 這個物件本身，
    // 不是逐一登錄它底下每個 child），child（args）要能拿到祖先的登錄，而不是被當成
    // 「沒登錄」而在 project／local 被誤判為生效。
    expect(resolveEffectiveScopes('sandbox.ripgrep.args')).toEqual(USER_SCOPE_ONLY);
  });
});

describe('resolveEffectiveScopes — 回歸錨：未登錄欄位任何 scope 都生效', () => {
  it.each([
    'model',
    'sandbox.enabled',
    'sandbox.excludedCommands',
    'sandbox.filesystem.allowWrite',
    'sandbox.network.allowedDomains',
    'sandbox.credentials.envVars',
  ])('%s → undefined（未受限）', (path) => {
    expect(resolveEffectiveScopes(path)).toBeUndefined();
  });

  it('autoConnectIde（globalConfig 欄位，非 effectiveScopes 機制）→ 未登錄 effectiveScopes', () => {
    // globalConfig 的「只在 user 可見」是另一條獨立機制（storageFile），
    // 不該把它誤登錄進 effectiveScopes（兩條機制疊加會在 isFieldVisibleForScope 端重複判斷，
    // 但 resolveEffectiveScopes 本身只回報 effectiveScopes 這一條登錄的狀態）。
    expect(resolveEffectiveScopes('autoConnectIde')).toBeUndefined();
  });
});

describe('resolveEffectiveScopes — fail-fast', () => {
  it('不存在的頂層 key 拋錯', () => {
    expect(() => resolveEffectiveScopes('totallyUnknownTopLevelKey')).toThrow();
  });

  it('sandbox 底下不存在的子 key 拋錯', () => {
    expect(() => resolveEffectiveScopes('sandbox.notARealChildKey')).toThrow();
  });
});
