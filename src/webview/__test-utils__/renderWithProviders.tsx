import React from 'react';
import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';

export function renderWithI18n(ui: React.ReactElement, locale = 'en'): RenderResult {
  return render(<I18nProvider locale={locale}>{ui}</I18nProvider>);
}
