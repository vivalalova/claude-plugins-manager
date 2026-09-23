/**
 * @vitest-environment jsdom
 *
 * #24 — SandboxEditor 的 4 個只在 user scope 生效的子設定控件
 * （allowAppleEvents／filesystem.disabled／network.strictAllowlist／credentials.awsPairs）
 * 在 project／local 隱藏，其餘控件不受影響；user scope 全部照常顯示（回歸錨）。
 *
 * 另外釘住：project scope 改動另一個（生效的）控件存檔時，既有但隱藏的
 * network.strictAllowlist 值必須原樣保留在 payload 裡（隱藏≠刪除使用者已寫的值）。
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import { SandboxEditor } from '../SandboxEditor';
import type { ClaudeSettings } from '../../../../../shared/types';

vi.mock('../../../../vscode', () => ({
  sendRequest: vi.fn().mockResolvedValue(undefined),
  onPushMessage: vi.fn(() => () => {}),
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderEditor = (
  sandbox: ClaudeSettings['sandbox'],
  scope: 'user' | 'project' | 'local',
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
) =>
  renderWithI18n(
    <ToastProvider>
      <SandboxEditor sandbox={sandbox} scope={scope} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

describe('SandboxEditor — #24 gated 控件 scope 隔離', () => {
  it('scope=user → 4 個 gated 控件皆顯示（回歸錨）', async () => {
    renderEditor({}, 'user');
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Allow Apple Events (macOS)' })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: /Disable filesystem isolation/ })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: /Deny hosts outside the allowlist/ })).toBeTruthy();
      expect(screen.getByText('AWS Credential Pairs')).toBeTruthy();
    });
    // 其餘控件不受影響
    expect(screen.getByRole('checkbox', { name: 'Enable Sandbox' })).toBeTruthy();
  });

  it('scope=project → 4 個 gated 控件皆隱藏，其餘控件仍顯示', async () => {
    renderEditor({}, 'project');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Enable Sandbox' })).toBeTruthy());
    expect(screen.queryByRole('checkbox', { name: 'Allow Apple Events (macOS)' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Disable filesystem isolation/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Deny hosts outside the allowlist/ })).toBeNull();
    expect(screen.queryByText('AWS Credential Pairs')).toBeNull();
    // 不受限控件仍顯示（隱藏只作用於 gated 控件）
    expect(screen.getByRole('checkbox', { name: 'Allow all Unix sockets' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Allow local port binding' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Fail if sandbox unavailable' })).toBeTruthy();
    expect(screen.getByText('Credential Env Vars')).toBeTruthy();
  });

  it('scope=local → 4 個 gated 控件皆隱藏（user-only，local 也不生效）', async () => {
    renderEditor({}, 'local');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Enable Sandbox' })).toBeTruthy());
    expect(screen.queryByRole('checkbox', { name: 'Allow Apple Events (macOS)' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Disable filesystem isolation/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /Deny hosts outside the allowlist/ })).toBeNull();
    expect(screen.queryByText('AWS Credential Pairs')).toBeNull();
    // 不受限控件仍顯示（隱藏只作用於 gated 控件）
    expect(screen.getByRole('checkbox', { name: 'Allow all Unix sockets' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Allow local port binding' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Fail if sandbox unavailable' })).toBeTruthy();
    expect(screen.getByText('Credential Env Vars')).toBeTruthy();
  });

  it('project scope：既有 network.strictAllowlist 值在改動其他控件存檔時原樣保留（隱藏≠刪除）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderEditor(
      { enabled: false, network: { strictAllowlist: true, allowedDomains: ['api.example.com'] } },
      'project',
      onSave,
    );

    await waitFor(() => screen.getByRole('checkbox', { name: 'Enable Sandbox' }));
    // strictAllowlist 控件本身在 project 不可見
    expect(screen.queryByRole('checkbox', { name: /Deny hosts outside the allowlist/ })).toBeNull();

    // 改動一個仍生效的控件（Enable Sandbox）
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Sandbox' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('sandbox', expect.objectContaining({
        enabled: true,
        network: expect.objectContaining({ strictAllowlist: true, allowedDomains: ['api.example.com'] }),
      }));
    });
  });
});
