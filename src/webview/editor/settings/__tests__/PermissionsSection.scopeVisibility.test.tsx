/**
 * @vitest-environment jsdom
 *
 * #24 — skipDangerousModePermissionPrompt / useAutoModeDuringPlan / classifyAllShell
 * 只在生效的 scope 顯示：
 *   - project：三者皆隱藏（docs Scope 欄不含 project）
 *   - local：skipDangerousModePermissionPrompt／useAutoModeDuringPlan 顯示（user+local），
 *            classifyAllShell 隱藏（user-only）
 *   - user：三者皆顯示（回歸錨）
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { PermissionsSection } from '../PermissionsSection';
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
      <PermissionsSection
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

describe('PermissionsSection — #24 scope 可見性', () => {
  it('scope=user → 三者皆顯示（回歸錨）', async () => {
    renderSection('user');
    await waitFor(() => {
      expect(screen.getByText('Skip Dangerous Mode Permission Prompt')).toBeTruthy();
      expect(screen.getByText('Use Auto Mode During Plan')).toBeTruthy();
      expect(screen.getByText('Classify All Shell Commands')).toBeTruthy();
    });
  });

  it('scope=project → 三者皆隱藏', async () => {
    renderSection('project');
    await waitFor(() => screen.getByText('Enable All Project MCP Servers'));
    expect(screen.queryByText('Skip Dangerous Mode Permission Prompt')).toBeNull();
    expect(screen.queryByText('Use Auto Mode During Plan')).toBeNull();
    expect(screen.queryByText('Classify All Shell Commands')).toBeNull();
  });

  it('scope=local → skipDangerousModePermissionPrompt／useAutoModeDuringPlan 顯示，classifyAllShell 隱藏', async () => {
    renderSection('local');
    await waitFor(() => {
      expect(screen.getByText('Skip Dangerous Mode Permission Prompt')).toBeTruthy();
      expect(screen.getByText('Use Auto Mode During Plan')).toBeTruthy();
    });
    expect(screen.queryByText('Classify All Shell Commands')).toBeNull();
  });
});
