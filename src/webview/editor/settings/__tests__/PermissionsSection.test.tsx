/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
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

const renderSection = (
  settings: Record<string, unknown> = {},
  onSave = vi.fn().mockResolvedValue(undefined),
  scope: 'user' | 'project' | 'local' = 'user',
) =>
  renderWithI18n(
    <ToastProvider>
      <PermissionsSection scope={scope} settings={settings as any} onSave={onSave} />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

describe('PermissionsSection — 渲染', () => {
  it('顯示 Permissions section title', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Permissions' })).toBeTruthy());
  });

  it('顯示 Additional Directories label', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Additional Directories')).toBeTruthy());
  });

  it('additionalDirectories 空 → 顯示 empty placeholder', async () => {
    renderSection({});
    await waitFor(() =>
      expect(screen.getByText('No additional directories configured')).toBeTruthy(),
    );
  });

  it('additionalDirectories 有值 → 顯示 tag', async () => {
    renderSection({ permissions: { additionalDirectories: ['~/docs'] } });
    await waitFor(() => expect(screen.getByText('~/docs')).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// 驗收條件
// ---------------------------------------------------------------------------

describe('PermissionsSection — additionalDirectories 互動', () => {
  it('新增目錄 → onSave("permissions", { ...existingPerms, additionalDirectories: [..., newDir] })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { additionalDirectories: ['~/docs'] } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. ~/projects'));
    fireEvent.change(screen.getByPlaceholderText('e.g. ~/projects'), { target: { value: '~/projects' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', {
        additionalDirectories: ['~/docs', '~/projects'],
      });
    });
  });

  it('保留現有 permissions 欄位（merge）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { allow: ['Bash'], additionalDirectories: [] } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. ~/projects'));
    fireEvent.change(screen.getByPlaceholderText('e.g. ~/projects'), { target: { value: '~/data' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', {
        allow: ['Bash'],
        additionalDirectories: ['~/data'],
      });
    });
  });

  it('刪除目錄 → onSave("permissions", { ...existingPerms, additionalDirectories: [remaining] })', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { additionalDirectories: ['~/docs', '~/projects'] } }, onSave);

    await waitFor(() => screen.getByRole('button', { name: 'Remove ~/docs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove ~/docs' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', {
        additionalDirectories: ['~/projects'],
      });
    });
  });

  it('重複目錄 → 顯示錯誤，不呼叫 onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { additionalDirectories: ['~/docs'] } }, onSave);

    await waitFor(() => screen.getByPlaceholderText('e.g. ~/projects'));
    fireEvent.change(screen.getByPlaceholderText('e.g. ~/projects'), { target: { value: '~/docs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(screen.getByText('Directory already added')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
