/**
 * 批次 S i18n 先紅測試
 *
 * 斷言 17 個新 key 在 en locale 有 .label 和 .description。
 * theme 的 7 個選項值與 .notSet/.unknown 也需存在。
 *
 * 這些 key 尚未加進 en.ts，所有斷言應先紅。
 * 一旦執行者加入 schema + i18n，既有 i18n-completeness.test.ts 會補測 ja/zh-TW 傳播。
 */
import { describe, it, expect } from 'vitest';
import { en } from '../locales/en';

// 用 Record<string, string> 繞開 TypeScript 型別限制（新 key 還不在 TranslationKey 聯合型別中）
const locale = en as Record<string, string>;

// ---------------------------------------------------------------------------
// 批次 S：17 個 key 的 .label 和 .description
// ---------------------------------------------------------------------------

const BATCH_S_LABEL_KEYS: string[] = [
  'settings.general.advisorModel.label',
  'settings.general.fallbackModel.label',
  'settings.general.autoCompactEnabled.label',
  'settings.general.fileCheckpointingEnabled.label',
  'settings.display.theme.label',
  'settings.display.verbose.label',
  'settings.display.axScreenReader.label',
  'settings.display.wheelScrollAccelerationEnabled.label',
  'settings.display.respondToBashCommands.label',
  'settings.display.agentPushNotifEnabled.label',
  'settings.display.inputNeededNotifEnabled.label',
  'settings.advanced.remoteControlAtStartup.label',
  'settings.advanced.disableArtifact.label',
  'settings.advanced.disableBundledSkills.label',
  'settings.advanced.disableClaudeAiConnectors.label',
  'settings.advanced.disableWorkflows.label',
  'settings.advanced.workflowKeywordTriggerEnabled.label',
];

const BATCH_S_DESCRIPTION_KEYS: string[] = [
  'settings.general.advisorModel.description',
  'settings.general.fallbackModel.description',
  'settings.general.autoCompactEnabled.description',
  'settings.general.fileCheckpointingEnabled.description',
  'settings.display.theme.description',
  'settings.display.verbose.description',
  'settings.display.axScreenReader.description',
  'settings.display.wheelScrollAccelerationEnabled.description',
  'settings.display.respondToBashCommands.description',
  'settings.display.agentPushNotifEnabled.description',
  'settings.display.inputNeededNotifEnabled.description',
  'settings.advanced.remoteControlAtStartup.description',
  'settings.advanced.disableArtifact.description',
  'settings.advanced.disableBundledSkills.description',
  'settings.advanced.disableClaudeAiConnectors.description',
  'settings.advanced.disableWorkflows.description',
  'settings.advanced.workflowKeywordTriggerEnabled.description',
];

// theme enum 需要的 i18n key：7 個選項值 + notSet + unknown
const THEME_OPTION_KEYS: string[] = [
  'settings.display.theme.notSet',
  'settings.display.theme.unknown',
  'settings.display.theme.auto',
  'settings.display.theme.dark',
  'settings.display.theme.light',
  'settings.display.theme.dark-daltonized',
  'settings.display.theme.light-daltonized',
  'settings.display.theme.dark-ansi',
  'settings.display.theme.light-ansi',
];

describe('批次 S — en locale label keys（先紅）', () => {
  it.each(BATCH_S_LABEL_KEYS)('en 有 key: %s', (key) => {
    expect(locale[key]).toBeTruthy();
  });
});

describe('批次 S — en locale description keys（先紅）', () => {
  it.each(BATCH_S_DESCRIPTION_KEYS)('en 有 key: %s', (key) => {
    expect(locale[key]).toBeTruthy();
  });
});

describe('批次 S — theme enum option i18n keys（先紅）', () => {
  it.each(THEME_OPTION_KEYS)('en 有 theme key: %s', (key) => {
    expect(locale[key]).toBeTruthy();
  });
});
