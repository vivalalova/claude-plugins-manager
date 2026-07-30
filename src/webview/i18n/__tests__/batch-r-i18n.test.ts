/**
 * 批次 R i18n 先紅測試
 *
 * 斷言新 key 在 en locale 已存在（只驗 key 存在、不綁死文案）。
 * 這些 key 尚未加進 en.ts，所有斷言應先紅。
 * 一旦執行者加入 schema + i18n，既有 i18n-completeness.test.ts 會補測 ja/zh-TW 傳播
 *（該檔的 key 清單來自 Object.keys(en)，故 en 有 key + completeness 綠即等價於三語齊備）。
 */
import { describe, it, expect } from 'vitest';
import { en } from '../locales/en';

// 用 Record<string, string> 繞開 TypeScript 型別限制（新 key 還不在 TranslationKey 聯合型別中）
const locale = en as Record<string, string>;

// ---------------------------------------------------------------------------
// 1. 3 個新 env var 的 description
//    env var i18n 只有 .description（無 .label），見 en.ts settings.env.knownVars.*
//    registry → i18n 目前沒有自動 completeness 測試，必須逐一顯式斷言。
// ---------------------------------------------------------------------------

const ENV_VAR_DESCRIPTION_KEYS = [
  'settings.env.knownVars.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS.description',
  'settings.env.knownVars.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH.description',
  'settings.env.knownVars.VERTEX_REGION_CLAUDE_5_OPUS.description',
];

describe('批次 R — 新 env var 的 en description key（先紅）', () => {
  it.each(ENV_VAR_DESCRIPTION_KEYS)('en 有 key: %s', (key) => {
    expect(locale[key]).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. 3 個新 scalar setting key 的 label / description
// ---------------------------------------------------------------------------

const SCALAR_SETTING_KEYS = [
  'settings.display.emojiCompletionEnabled.label',
  'settings.display.emojiCompletionEnabled.description',
  'settings.general.switchModelsOnFlag.label',
  'settings.general.switchModelsOnFlag.description',
  'settings.advanced.defaultEnvironmentId.label',
  'settings.advanced.defaultEnvironmentId.description',
  // string 欄位依既有 advanced string field 慣例（plansDirectory / gcpAuthRefresh）附 placeholder
  'settings.advanced.defaultEnvironmentId.placeholder',
];

describe('批次 R — 新 scalar setting key 的 en i18n key（先紅）', () => {
  it.each(SCALAR_SETTING_KEYS)('en 有 key: %s', (key) => {
    expect(locale[key]).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3. SandboxEditor 兩個新 toggle 的 label
//    沿用既有 sandbox toggle 慣例：扁平 key，無 .label 後綴
//    （對照 settings.advanced.sandbox.network.allowLocalBinding）
// ---------------------------------------------------------------------------

const SANDBOX_TOGGLE_KEYS = [
  'settings.advanced.sandbox.filesystem.disabled',
  'settings.advanced.sandbox.network.strictAllowlist',
];

describe('批次 R — SandboxEditor 新 toggle 的 en i18n key（先紅）', () => {
  it.each(SANDBOX_TOGGLE_KEYS)('en 有 key: %s', (key) => {
    expect(locale[key]).toBeTruthy();
  });
});
