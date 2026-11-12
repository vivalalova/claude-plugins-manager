import { en } from './locales/en';
import { zhTW } from './locales/zh-TW';
import { ja } from './locales/ja';
import type { TranslationKey } from './locales/en';

type Overrides = Partial<Record<TranslationKey, string>>;

const LOCALE_MAP: Record<string, Overrides> = {
  'zh-tw': zhTW,
  'zh-TW': zhTW,
  zh: zhTW,
  ja,
};

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** 依 locale 建立翻譯函式（未知語系退 en）。不依賴 React，webview 與 extension host 共用。 */
export function createTranslator(locale: string): Translate {
  const overrides: Overrides = LOCALE_MAP[locale] ?? {};
  return (key, vars) => {
    const template = (overrides[key] ?? en[key]) as string;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
  };
}
