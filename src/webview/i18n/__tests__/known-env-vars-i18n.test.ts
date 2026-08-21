import { describe, it, expect } from 'vitest';
import { KNOWN_ENV_VARS } from '../../../shared/known-env-vars';
import { en } from '../locales/en';
import { ja } from '../locales/ja';
import { zhTW } from '../locales/zh-TW';

const locales: Record<string, Record<string, string>> = {
  en: en as unknown as Record<string, string>,
  ja: ja as unknown as Record<string, string>,
  'zh-TW': zhTW as unknown as Record<string, string>,
};

describe('KNOWN_ENV_VARS i18n 完整性', () => {
  const envVarNames = Object.keys(KNOWN_ENV_VARS);

  for (const [localeName, locale] of Object.entries(locales)) {
    it(`${localeName} 對每個 KNOWN_ENV_VARS 項目都有 description`, () => {
      // 只驗 key 存在會讓空字串／誤貼的空值綠燈，所以連值也一起驗。
      const missing = envVarNames.filter((name) => {
        const value = locale[`settings.env.knownVars.${name}.description`];
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(missing, `${localeName} 缺少 ${missing.length} 個 env var description`).toEqual([]);
    });
  }
});
