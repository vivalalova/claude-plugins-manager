import { describe, it, expect } from 'vitest';
import { en, type TranslationKey } from '../locales/en';
import { ja } from '../locales/ja';
import { zhTW } from '../locales/zh-TW';

const allEnKeys = Object.keys(en) as TranslationKey[];

const locales: Record<string, Partial<Record<TranslationKey, string>>> = {
  ja,
  'zh-TW': zhTW,
};

describe('i18n key 完整性', () => {
  for (const [name, locale] of Object.entries(locales)) {
    it(`${name} 包含 en.ts 所有 key`, () => {
      const missing = allEnKeys.filter((key) => !(key in locale));
      expect(missing, `${name} 缺少 ${missing.length} 個 key`).toEqual([]);
    });

    it(`${name} 不含 en.ts 以外的多餘 key`, () => {
      const enKeySet = new Set<string>(allEnKeys);
      const extra = Object.keys(locale).filter((key) => !enKeySet.has(key));
      expect(extra, `${name} 有 ${extra.length} 個多餘 key`).toEqual([]);
    });
  }
});
