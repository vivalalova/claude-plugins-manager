/**
 * 批次 C i18n 先紅測試
 *
 * 斷言 4 個複雜設定的 i18n key 在 en locale 已存在。
 * 這些 key 尚未加進 en.ts，所有斷言應先紅。
 * 一旦執行者加入 schema + i18n，既有 i18n-completeness.test.ts 會補測 ja/zh-TW 傳播。
 */
import { describe, it, expect } from 'vitest';
import { en } from '../locales/en';

// Use Record<string, string> to bypass TypeScript union type (new keys not yet in TranslationKey)
const locale = en as Record<string, string>;

// ---------------------------------------------------------------------------
// 1. attribution.sessionUrl
// ---------------------------------------------------------------------------

const ATTRIBUTION_SESSION_URL_KEYS = [
  'settings.advanced.attribution.sessionUrl.label',
  'settings.advanced.attribution.sessionUrl.description',
];

// ---------------------------------------------------------------------------
// 2. sandbox.credentials.files
// ---------------------------------------------------------------------------

const SANDBOX_CREDENTIALS_FILES_KEYS = [
  'settings.advanced.sandbox.credentials.files.label',
  'settings.advanced.sandbox.credentials.files.description',
  'settings.advanced.sandbox.credentials.files.placeholder',
  'settings.advanced.sandbox.credentials.files.empty',
  'settings.advanced.sandbox.credentials.files.duplicate',
];

// ---------------------------------------------------------------------------
// 3. sandbox.credentials.envVars
// ---------------------------------------------------------------------------

const SANDBOX_CREDENTIALS_ENVVARS_KEYS = [
  'settings.advanced.sandbox.credentials.envVars.label',
  'settings.advanced.sandbox.credentials.envVars.description',
  'settings.advanced.sandbox.credentials.envVars.placeholder',
  'settings.advanced.sandbox.credentials.envVars.empty',
  'settings.advanced.sandbox.credentials.envVars.duplicate',
];

// ---------------------------------------------------------------------------
// 4. footerLinksRegexes (TextSetting JSON textarea — mirrors sshConfigs pattern)
// ---------------------------------------------------------------------------

const FOOTER_LINKS_REGEXES_KEYS = [
  'settings.advanced.footerLinksRegexes.label',
  'settings.advanced.footerLinksRegexes.description',
  'settings.advanced.footerLinksRegexes.placeholder',
  'settings.advanced.footerLinksRegexes.save',
  'settings.advanced.footerLinksRegexes.clear',
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('批次 C — attribution.sessionUrl i18n keys（先紅）', () => {
  it.each(ATTRIBUTION_SESSION_URL_KEYS)('en 有 key: %s', (key) => {
    expect(locale[key]).toBeTruthy();
  });
});

describe('批次 C — sandbox.credentials.files i18n keys（先紅）', () => {
  it.each(SANDBOX_CREDENTIALS_FILES_KEYS)('en 有 key: %s', (key) => {
    expect(locale[key]).toBeTruthy();
  });
});

describe('批次 C — sandbox.credentials.envVars i18n keys（先紅）', () => {
  it.each(SANDBOX_CREDENTIALS_ENVVARS_KEYS)('en 有 key: %s', (key) => {
    expect(locale[key]).toBeTruthy();
  });
});

describe('批次 C — footerLinksRegexes i18n keys（先紅）', () => {
  it.each(FOOTER_LINKS_REGEXES_KEYS)('en 有 key: %s', (key) => {
    expect(locale[key]).toBeTruthy();
  });
});
