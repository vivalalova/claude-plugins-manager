/**
 * Settings UI 欄位渲染順序。
 * Section .tsx 與 check-settings-schema.ts 共用。
 */
import type { ClaudeSettings } from './types';

/** 刻意排除不放入 FIELD_ORDER 的 schema key（附原因） */
export const EXCLUDED_FROM_FIELD_ORDER = new Set<keyof ClaudeSettings>([
  'model', // CLI 自動管理，UI 不直接暴露
]);

export const GENERAL_FIELD_ORDER: (keyof ClaudeSettings)[] = [
  'effortLevel',
  'language',
  'availableModels',
  'enableAllProjectMcpServers',
  'includeGitInstructions',
  'respectGitignore',
  'fastMode',
  'fastModePerSessionOptIn',
  'autoMemoryEnabled',
  'alwaysThinkingEnabled',
  'outputStyle',
  'autoUpdatesChannel',
  'cleanupPeriodDays',
];

export const DISPLAY_FIELD_ORDER: (keyof ClaudeSettings)[] = [
  'teammateMode',
  'showTurnDuration',
  'spinnerTipsEnabled',
  'terminalProgressBarEnabled',
  'prefersReducedMotion',
  'spinnerVerbs',
  'spinnerTipsOverride',
];

export const ADVANCED_FIELD_ORDER: (keyof ClaudeSettings)[] = [
  'forceLoginMethod',
  'attribution',
  'statusLine',
  'fileSuggestion',
  'sandbox',
  'companyAnnouncements',
  'forceLoginOrgUUID',
  'plansDirectory',
  'apiKeyHelper',
  'otelHeadersHelper',
  'awsCredentialExport',
  'awsAuthRefresh',
  'skipWebFetchPreflight',
];
