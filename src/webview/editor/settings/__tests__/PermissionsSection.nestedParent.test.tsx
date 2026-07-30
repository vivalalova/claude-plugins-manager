/**
 * @vitest-environment jsdom
 *
 * nested 父物件寫入契約（PermissionsSection 路徑）
 *
 * 拍板契約 — getSchemaFieldBindings 與 PermissionsSection 的 updatePermissions
 * 共用同一 helper（如 saveOrDeleteParent），兩路行為一致：
 *   - 寫入後父物件變空 → onDelete(parentKey)，不留殘留 "permissions": {} / "autoMode": {}
 *   - 父物件還有其他 key → onSave(parentKey, 剩餘物件)
 *
 * 從 PermissionsSection.test.tsx 抽出獨立成檔：該檔原本已 798 行，逼近 800 行上限。
 * 同契約的 remote/defaultEnvironmentId 案例在 batchR.sections.test.tsx。
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
  onDelete = vi.fn().mockResolvedValue(undefined),
  scope: 'user' | 'project' | 'local' = 'user',
) =>
  renderWithI18n(
    <ToastProvider>
      <PermissionsSection scope={scope} settings={settings as any} onSave={onSave} onDelete={onDelete} />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// permissions 父物件（updatePermissions 手寫路徑）
// ---------------------------------------------------------------------------

describe('nested 父物件契約 — permissions（updatePermissions 路徑）', () => {
  it('disableAutoMode 是 permissions 唯一 key, 選擇空值 → onDelete("permissions")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { disableAutoMode: 'disable' } }, onSave, onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Auto Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Disable Auto Mode' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('permissions');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('disableBypassPermissionsMode 是 permissions 唯一 key, 選擇空值 → onDelete("permissions")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { disableBypassPermissionsMode: 'disable' } }, onSave, onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Bypass Permissions Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Disable Bypass Permissions Mode' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('permissions');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  // 邊界錨：防止「一律改成 onDelete(parent)」而誤刪同層其他設定
  it('permissions 還有其他 key 時清空 disableAutoMode → onSave("permissions", 剩餘物件)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { disableAutoMode: 'disable', allow: ['Bash(ls:*)'] } }, onSave, onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Auto Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Disable Auto Mode' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('permissions', { allow: ['Bash(ls:*)'] });
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// autoMode 父物件（getSchemaFieldBindings nestedUnder 路徑）
// ---------------------------------------------------------------------------

describe('nested 父物件契約 — autoMode（getSchemaFieldBindings nestedUnder 路徑）', () => {
  it('classifyAllShell 是 autoMode 唯一 key, toggle off → onDelete("autoMode")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ autoMode: { classifyAllShell: true } }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Classify All Shell Commands' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Classify All Shell Commands' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('autoMode');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  // 邊界錨：autoMode 還有其他 key → 只重寫剩餘物件
  it('autoMode 還有其他 key 時 toggle off classifyAllShell → onSave("autoMode", 剩餘物件)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ autoMode: { classifyAllShell: true, allow: ['Bash'] } }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Classify All Shell Commands' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Classify All Shell Commands' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('autoMode', { allow: ['Bash'] });
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});
