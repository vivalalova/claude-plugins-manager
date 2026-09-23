/**
 * @vitest-environment jsdom
 *
 * #24 — Advanced 區塊欄位的 scope 隔離：
 *   - user-only（docs Scope: User or managed）：autoMode／sshConfigs／processWrapper／
 *     footerLinksRegexes／feedbackDrafts —— project／local 皆不生效
 *   - user+local（docs Scope: User, local, or managed）：syncClaudeAiSkills —— project 不生效，
 *     local 生效
 */
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

const renderSection = (scope: 'user' | 'project' | 'local') =>
  renderWithI18n(
    <ToastProvider>
      <AdvancedSection
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

describe('AdvancedSection — #24 user-only 欄位 scope 隔離', () => {
  it('scope=user → 五者皆顯示（回歸錨）', async () => {
    renderSection('user');
    await waitFor(() => {
      expect(screen.getByText('Auto Mode Rules')).toBeTruthy();
      expect(screen.getByText('SSH Configs')).toBeTruthy();
      expect(screen.getByText('Process Wrapper')).toBeTruthy();
      expect(screen.getByText('Footer Link Patterns')).toBeTruthy();
      expect(screen.getByText('Feedback Drafts')).toBeTruthy();
    });
  });

  it('scope=project → 五者皆不渲染', async () => {
    renderSection('project');
    await waitFor(() => expect(screen.getByText('Sandbox')).toBeTruthy());
    expect(screen.queryByText('Auto Mode Rules')).toBeNull();
    expect(screen.queryByText('SSH Configs')).toBeNull();
    expect(screen.queryByText('Process Wrapper')).toBeNull();
    expect(screen.queryByText('Footer Link Patterns')).toBeNull();
    expect(screen.queryByText('Feedback Drafts')).toBeNull();
  });

  it('scope=local → 五者皆不渲染（user-only，local 也不生效）', async () => {
    renderSection('local');
    await waitFor(() => expect(screen.getByText('Sandbox')).toBeTruthy());
    expect(screen.queryByText('Auto Mode Rules')).toBeNull();
    expect(screen.queryByText('SSH Configs')).toBeNull();
    expect(screen.queryByText('Process Wrapper')).toBeNull();
    expect(screen.queryByText('Footer Link Patterns')).toBeNull();
    expect(screen.queryByText('Feedback Drafts')).toBeNull();
  });
});

describe('AdvancedSection — #24 syncClaudeAiSkills（user+local）scope 隔離', () => {
  it('scope=project → 不渲染', async () => {
    renderSection('project');
    await waitFor(() => expect(screen.getByText('Sandbox')).toBeTruthy());
    expect(screen.queryByText('Sync Claude.ai Skills')).toBeNull();
  });

  it('scope=local → 渲染（user+local 生效）', async () => {
    renderSection('local');
    await waitFor(() => expect(screen.getByText('Sync Claude.ai Skills')).toBeTruthy());
  });
});
