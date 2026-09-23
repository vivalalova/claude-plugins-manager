/**
 * @vitest-environment jsdom
 *
 * #24 — user-only 欄位（modelPicker／desktopSessionCleanupPeriodDays／
 * autoContinueAtUsageLimit／dialogExpiry）只在 scope=user 顯示（docs Scope 欄：
 * User or managed）。project／local 皆不生效，完全不渲染、搜尋也搜不到
 * （搜尋另見 SettingsPage.scopeVisibility.test.tsx）。
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { GeneralSection } from '../GeneralSection';
import { ToastProvider } from '../../../components/Toast';

vi.mock('../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

const renderSection = (scope: 'user' | 'project' | 'local') =>
  renderWithI18n(
    <ToastProvider>
      <GeneralSection
        scope={scope}
        settings={{} as any}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GeneralSection — #24 user-only 欄位 scope 隔離', () => {
  it('scope=user → 四者皆顯示（回歸錨）', async () => {
    renderSection('user');
    await waitFor(() => {
      expect(screen.getByText('Model Picker')).toBeTruthy();
      expect(screen.getByText('Desktop Session Cleanup Period')).toBeTruthy();
      expect(screen.getByText('Auto-Continue At Usage Limit')).toBeTruthy();
      expect(screen.getByText('Forwarded Dialog Expiry')).toBeTruthy();
    });
  });

  it('scope=project → 四者皆不渲染', async () => {
    renderSection('project');
    await waitFor(() => expect(screen.getByText('Effort Level')).toBeTruthy());
    expect(screen.queryByText('Model Picker')).toBeNull();
    expect(screen.queryByText('Desktop Session Cleanup Period')).toBeNull();
    expect(screen.queryByText('Auto-Continue At Usage Limit')).toBeNull();
    expect(screen.queryByText('Forwarded Dialog Expiry')).toBeNull();
  });

  it('scope=local → 四者皆不渲染（user-only，local 也不生效）', async () => {
    renderSection('local');
    await waitFor(() => expect(screen.getByText('Effort Level')).toBeTruthy());
    expect(screen.queryByText('Model Picker')).toBeNull();
    expect(screen.queryByText('Desktop Session Cleanup Period')).toBeNull();
    expect(screen.queryByText('Auto-Continue At Usage Limit')).toBeNull();
    expect(screen.queryByText('Forwarded Dialog Expiry')).toBeNull();
  });
});
