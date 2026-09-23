/**
 * @vitest-environment jsdom
 *
 * nested 父物件寫入契約（PermissionsSection 路徑，#33）
 *
 * getSchemaFieldBindings 與 PermissionsSection 手寫子欄位兩路行為一致：清子欄位一律
 * onDeleteNested(parentKey, childKey)，不論父物件是否因此變空；webview 不再展開父物件、
 * 不再呼叫 onSave／onDelete(parentKey)。「父物件變空就刪父 key」由擴展端在同一佇列任務內
 * 完成，檔案層斷言在 SettingsPage.nestedConcurrency.test.tsx 與 service 層測試。
 *
 * 從 PermissionsSection.test.tsx 抽出獨立成檔：該檔原本已 798 行，逼近 800 行上限。
 * 同契約的 remote/defaultEnvironmentId 案例在 batchR.sections.test.tsx。
 */
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach, type Mock } from 'vitest';
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

let onSaveNested: Mock;
let onDeleteNested: Mock;
beforeEach(() => {
  onSaveNested = vi.fn().mockResolvedValue(undefined);
  onDeleteNested = vi.fn().mockResolvedValue(undefined);
});

const renderSection = (
  settings: Record<string, unknown> = {},
  onSave = vi.fn().mockResolvedValue(undefined),
  onDelete = vi.fn().mockResolvedValue(undefined),
  scope: 'user' | 'project' | 'local' = 'user',
) =>
  renderWithI18n(
    <ToastProvider>
      <PermissionsSection
        scope={scope}
        settings={settings as any}
        onSave={onSave}
        onDelete={onDelete}
        onSaveNested={onSaveNested}
        onDeleteNested={onDeleteNested}
      />
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
  it('disableAutoMode 是 permissions 唯一 key, 選擇空值 → onDeleteNested("permissions", "disableAutoMode")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { disableAutoMode: 'disable' } }, onSave, onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Auto Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Disable Auto Mode' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onDeleteNested).toHaveBeenCalledWith('permissions', 'disableAutoMode');
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('disableBypassPermissionsMode 是 permissions 唯一 key, 選擇空值 → onDeleteNested("permissions", "disableBypassPermissionsMode")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { disableBypassPermissionsMode: 'disable' } }, onSave, onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Bypass Permissions Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Disable Bypass Permissions Mode' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onDeleteNested).toHaveBeenCalledWith('permissions', 'disableBypassPermissionsMode');
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  // 邊界錨：父物件還有其他子欄位時同樣只刪該格，禁止刪整個父 key 或整包寫回剩餘物件
  it('permissions 還有其他 key 時清空 disableAutoMode → 仍只 onDeleteNested 該子欄位', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { disableAutoMode: 'disable', allow: ['Bash(ls:*)'] } }, onSave, onDelete);

    await waitFor(() => screen.getByRole('combobox', { name: 'Disable Auto Mode' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Disable Auto Mode' }), { target: { value: '' } });

    await waitFor(() => {
      expect(onDeleteNested).toHaveBeenCalledWith('permissions', 'disableAutoMode');
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// autoMode 父物件（getSchemaFieldBindings nestedUnder 路徑）
// ---------------------------------------------------------------------------

describe('nested 父物件契約 — autoMode（getSchemaFieldBindings nestedUnder 路徑）', () => {
  it('classifyAllShell 是 autoMode 唯一 key, toggle off → onDeleteNested("autoMode", "classifyAllShell")', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ autoMode: { classifyAllShell: true } }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Classify All Shell Commands' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Classify All Shell Commands' }));

    await waitFor(() => {
      expect(onDeleteNested).toHaveBeenCalledWith('autoMode', 'classifyAllShell');
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  // 邊界錨：autoMode 還有其他 key → 同樣只刪該格，不整包寫回
  it('autoMode 還有其他 key 時 toggle off classifyAllShell → 仍只 onDeleteNested 該子欄位', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ autoMode: { classifyAllShell: true, allow: ['Bash'] } }, onSave, onDelete);

    await waitFor(() => screen.getByRole('checkbox', { name: 'Classify All Shell Commands' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Classify All Shell Commands' }));

    await waitFor(() => {
      expect(onDeleteNested).toHaveBeenCalledWith('autoMode', 'classifyAllShell');
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
