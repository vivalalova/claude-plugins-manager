/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider, useI18n } from '../I18nContext';

function TranslationProbe({
  translationKey,
  vars,
}: {
  translationKey: 'sidebar.plugins' | 'plugin.page.updating';
  vars?: Record<string, string | number>;
}): React.ReactElement {
  const { t } = useI18n();
  return <div>{t(translationKey, vars)}</div>;
}

describe('I18nProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('支援 locale alias，zh 會套用繁體中文翻譯', () => {
    render(
      <I18nProvider locale="zh">
        <TranslationProbe translationKey="sidebar.plugins" />
      </I18nProvider>,
    );

    expect(screen.getByText('外掛')).toBeTruthy();
  });

  it('未知 locale 回退英文，並保留缺少的變數 placeholder', () => {
    render(
      <I18nProvider locale="fr">
        <TranslationProbe translationKey="plugin.page.updating" vars={{ current: 2 }} />
      </I18nProvider>,
    );

    expect(screen.getByText('Updating 2/{total}...')).toBeTruthy();
  });

  it('useI18n 離開 provider 會直接拋錯', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TranslationProbe translationKey="sidebar.plugins" />))
      .toThrow('useI18n must be used within an I18nProvider');

    consoleErrorSpy.mockRestore();
  });
});
