import React, { createContext, useContext, useMemo } from 'react';
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

interface I18nContextValue {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  locale: string;
  children: React.ReactNode;
}

export function I18nProvider({ locale, children }: I18nProviderProps): React.ReactElement {
  const value = useMemo<I18nContextValue>(() => {
    const overrides: Overrides = LOCALE_MAP[locale] ?? {};

    function t(key: TranslationKey, vars?: Record<string, string | number>): string {
      const template = (overrides[key] ?? en[key]) as string;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
    }

    return { t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
