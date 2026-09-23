/**
 * @vitest-environment jsdom
 */
// #26 R8 — attribution.sessionUrl 的繼承感知要能透過 AdvancedSection → ObjectFieldEditor →
// AttributionEditor 整條路徑生效，不只在 AttributionEditor 單元測試裡驗證。
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { AdvancedSection } from '../AdvancedSection';
import { ToastProvider } from '../../../components/Toast';

vi.mock('../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

const renderSection = (
  settings: Record<string, unknown> = {},
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
  scope: 'user' | 'project' | 'local' = 'user',
  parentSettings?: Partial<Record<'user' | 'project' | 'local', Record<string, unknown>>>,
) =>
  renderWithI18n(
    <ToastProvider>
      <AdvancedSection scope={scope} settings={settings as any} parentSettings={parentSettings as any} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AdvancedSection — attribution.sessionUrl 繼承感知（#26 R8，經 ObjectFieldEditor）', () => {
  it('project scope，own={commit}（sessionUrl 未設），父層(user)={sessionUrl:false} → checkbox 未勾選', async () => {
    renderSection(
      { attribution: { commit: 'c' } },
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
      'project',
      { user: { attribution: { sessionUrl: false } } },
    );

    await waitFor(() => {
      const cb = (screen.queryByRole('checkbox', { name: /session.url/i })
        ?? screen.queryByRole('checkbox', { name: /sessionUrl/i })) as HTMLInputElement | null;
      expect(cb).not.toBeNull();
      expect(cb!.checked).toBe(false);
    });
  });
});
