/**
 * @vitest-environment jsdom
 *
 * #24 — user-only 欄位（vimInsertModeRemaps／askUserQuestionTimeout／spellcheck）
 * 只在 scope=user 顯示（docs Scope 欄：User or managed）。
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { DisplaySection } from '../DisplaySection';
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
      <DisplaySection
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

describe('DisplaySection — #24 user-only 欄位 scope 隔離', () => {
  it('scope=user → 三者皆顯示（回歸錨）', async () => {
    renderSection('user');
    await waitFor(() => {
      expect(screen.getByText('Vim Insert Mode Remaps')).toBeTruthy();
      expect(screen.getByText('Question Auto-Continue Timeout')).toBeTruthy();
      expect(screen.getByText('Spellcheck')).toBeTruthy();
    });
  });

  it('scope=project → 三者皆不渲染', async () => {
    renderSection('project');
    await waitFor(() => expect(screen.getByText('View Mode')).toBeTruthy());
    expect(screen.queryByText('Vim Insert Mode Remaps')).toBeNull();
    expect(screen.queryByText('Question Auto-Continue Timeout')).toBeNull();
    expect(screen.queryByText('Spellcheck')).toBeNull();
  });

  it('scope=local → 三者皆不渲染（user-only，local 也不生效）', async () => {
    renderSection('local');
    await waitFor(() => expect(screen.getByText('View Mode')).toBeTruthy());
    expect(screen.queryByText('Vim Insert Mode Remaps')).toBeNull();
    expect(screen.queryByText('Question Auto-Continue Timeout')).toBeNull();
    expect(screen.queryByText('Spellcheck')).toBeNull();
  });
});
