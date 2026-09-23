/**
 * @vitest-environment jsdom
 */
// #26 R4 — 判別對照：useAutoModeDuringPlan / enableAllProjectMcpServers 的繼承感知刪除
// 判斷要能區分「父層已載入但沒設此 key」（none → 選到 default 仍刪）與「父層設了非 default
// 值」（known → 選到 default 也寫）。與 PermissionsSection.test.tsx 的 R4a/R4b 正例配對。
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
  parentSettings?: Partial<Record<'user' | 'project' | 'local', Record<string, unknown>>>,
) =>
  renderWithI18n(
    <ToastProvider>
      <PermissionsSection
        scope={scope}
        settings={settings as any}
        parentSettings={parentSettings as any}
        onSave={onSave}
        onDelete={onDelete}
      />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PermissionsSection — useAutoModeDuringPlan 繼承感知判別對照（#26 R4a）', () => {
  it('local scope，own=false，父層(user) 已載入但沒設此 key（{}）→ 點擊 → onDelete("useAutoModeDuringPlan")，onSave 未呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ useAutoModeDuringPlan: false }, onSave, onDelete, 'local', { user: {} });

    await waitFor(() => screen.getByRole('checkbox', { name: /^Use Auto Mode During Plan/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Use Auto Mode During Plan/ }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('useAutoModeDuringPlan');
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('local scope，own 未設，父層(user)=false（known）→ checkbox 未勾選（非 default true）', async () => {
    renderSection({}, vi.fn(), vi.fn(), 'local', { user: { useAutoModeDuringPlan: false } });

    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox', { name: /^Use Auto Mode During Plan/ }) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });
  });
});

describe('PermissionsSection — enableAllProjectMcpServers 繼承感知判別對照（#26 R4b）', () => {
  it('project scope，own=true，父層(user) 已載入但沒設此 key（{}）→ 關閉 → onDelete("enableAllProjectMcpServers")，onSave 未呼叫', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ enableAllProjectMcpServers: true }, onSave, onDelete, 'project', { user: {} });

    await waitFor(() => screen.getByRole('checkbox', { name: /^Enable All Project MCP Servers/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Enable All Project MCP Servers/ }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('enableAllProjectMcpServers');
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});
