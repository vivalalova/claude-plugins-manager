import { describe, it, expect } from 'vitest';
import {
  getAllFlatFieldSchemas,
  getValueSchemaEnumOptions,
} from '../../../shared/claude-settings-schema';
import { en } from '../locales/en';
import { ja } from '../locales/ja';
import { zhTW } from '../locales/zh-TW';

// 直接查三份 locale 物件、不經 t()：t() 對 ja／zh-TW 缺 key 會退回 en，會掩蓋缺漏。
const locales: Record<string, Record<string, string>> = {
  en: en as unknown as Record<string, string>,
  ja: ja as unknown as Record<string, string>,
  'zh-TW': zhTW as unknown as Record<string, string>,
};

// key 組法與 SchemaFieldRenderer 一致：settings.${section}.${settingKey}.${option}
const enumOptionKeys: string[] = Object.entries(getAllFlatFieldSchemas()).flatMap(
  ([settingKey, schema]) => {
    if (schema.controlType !== String) return [];
    const options = getValueSchemaEnumOptions(schema.valueSchema);
    if (!options) return [];
    return options.map((option) => `settings.${schema.section}.${settingKey}.${option}`);
  },
);

describe('列舉欄位選項 i18n 完整性', () => {
  it('schema 走訪得到至少一個列舉選項（防走訪條件失效而空轉）', () => {
    expect(enumOptionKeys.length).toBeGreaterThan(0);
  });

  for (const [localeName, locale] of Object.entries(locales)) {
    it(`${localeName} 對 schema 每個列舉欄位的每個選項都有非空翻譯`, () => {
      const missing = enumOptionKeys.filter((key) => {
        const value = locale[key];
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(missing, `${localeName} 缺少 ${missing.length} 個列舉選項翻譯`).toEqual([]);
    });
  }
});
