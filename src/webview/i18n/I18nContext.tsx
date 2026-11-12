import React, { createContext, useContext, useMemo } from 'react';
import type { TranslationKey } from './locales/en';
import { createTranslator } from './translate';

interface I18nContextValue {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  locale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  locale: string;
  children: React.ReactNode;
}

export function I18nProvider({ locale, children }: I18nProviderProps): React.ReactElement {
  const value = useMemo<I18nContextValue>(() => ({ t: createTranslator(locale), locale }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
