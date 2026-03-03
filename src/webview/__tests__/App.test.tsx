/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('../sidebar/SidebarApp', () => ({
  SidebarApp: () => <div>sidebar-app</div>,
}));

vi.mock('../editor/EditorApp', () => ({
  EditorApp: ({ mode }: { mode: string }) => <div>editor-app:{mode}</div>,
}));

vi.mock('../components/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="toast-provider">{children}</div>
  ),
}));

vi.mock('../i18n/I18nContext', () => ({
  I18nProvider: ({ locale, children }: { locale: string; children: React.ReactNode }) => (
    <div data-testid="i18n-provider" data-locale={locale}>
      {children}
    </div>
  ),
}));

import { App } from '../App';

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  it('sidebar 模式渲染 SidebarApp 並把 locale 傳給 I18nProvider', () => {
    render(<App mode="sidebar" locale="ja" />);

    expect(screen.getByText('sidebar-app')).toBeTruthy();
    expect(screen.queryByText(/^editor-app:/)).toBeNull();
    expect(screen.getByTestId('i18n-provider').getAttribute('data-locale')).toBe('ja');
    expect(screen.getByTestId('toast-provider')).toBeTruthy();
  });

  it('editor 模式渲染 EditorApp 並傳入對應 mode', () => {
    render(<App mode="plugin" locale="zh-TW" />);

    expect(screen.queryByText('sidebar-app')).toBeNull();
    expect(screen.getByText('editor-app:plugin')).toBeTruthy();
    expect(screen.getByTestId('i18n-provider').getAttribute('data-locale')).toBe('zh-TW');
  });
});
