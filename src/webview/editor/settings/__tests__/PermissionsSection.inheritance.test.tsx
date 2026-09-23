/**
 * @vitest-environment jsdom
 */
// #26 R4 — 判別對照：useAutoModeDuringPlan / enableAllProjectMcpServers 的繼承感知刪除
// 判斷要能區分「父層已載入但沒設此 key」（none → 選到 default 仍刪）與「父層設了非 default
// 值」（known → 選到 default 也寫）。與 PermissionsSection.test.tsx 的 R4a/R4b 正例配對。
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

// #32 — disableAutoMode／disableBypassPermissionsMode 兩個手刻下拉接上繼承判斷：
// 本層未設時 '' 選項顯示「Inherited from {scope}」，本層有設且上層有設時顯示覆寫徽章；寫入仍走 updatePermissions。
describe.each(['disableAutoMode', 'disableBypassPermissionsMode'] as const)('PermissionsSection — %s 繼承顯示（#32）', (key) => {
  const getSelect = (): HTMLSelectElement => document.getElementById(key) as HTMLSelectElement;
  const emptyOptionText = (): string => (getSelect().querySelector('option[value=""]') as HTMLOptionElement).textContent ?? '';

  it(`B21 project、本層未設、user permissions.${key}=disable → '' 選項顯示 Inherited from User`, async () => {
    renderSection({}, vi.fn(), vi.fn(), 'project', { user: { permissions: { [key]: 'disable' } } });
    await waitFor(() => expect(getSelect()).toBeTruthy());
    expect(emptyOptionText()).toMatch(/Inherited from User/);
  });

  it(`B21 local、project 設 ${key}、user 未設 → Inherited from Project`, async () => {
    renderSection({}, vi.fn(), vi.fn(), 'local', { project: { permissions: { [key]: 'disable' } }, user: {} });
    await waitFor(() => expect(getSelect()).toBeTruthy());
    expect(emptyOptionText()).toMatch(/Inherited from Project/);
  });

  it(`B21（守衛）上層都沒設 ${key} → '' 選項不含 Inherited from`, async () => {
    renderSection({}, vi.fn(), vi.fn(), 'project', { user: { permissions: { allow: ['Bash(ls:*)'] } } });
    await waitFor(() => expect(getSelect()).toBeTruthy());
    expect(emptyOptionText()).not.toMatch(/Inherited from/);
  });

  it(`B22 本層 ${key}=disable 且 user 有設 → 欄位顯示 Overrides User`, async () => {
    renderSection({ permissions: { [key]: 'disable' } }, vi.fn(), vi.fn(), 'project', { user: { permissions: { [key]: 'disable' } } });
    await waitFor(() => expect(getSelect()).toBeTruthy());
    const field = getSelect().closest('.settings-field') as HTMLElement;
    expect(within(field).getByText('Overrides User')).toBeTruthy();
  });

  it(`B23（守衛）上層有設時選 disable → onSave(permissions, {...perms, ${key}:'disable'})`, async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { allow: ['Bash(ls:*)'] } }, onSave, vi.fn(), 'project', { user: { permissions: { [key]: 'disable' } } });
    await waitFor(() => expect(getSelect()).toBeTruthy());
    fireEvent.change(getSelect(), { target: { value: 'disable' } });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('permissions', { allow: ['Bash(ls:*)'], [key]: 'disable' }));
  });

  it(`B23（守衛）上層有設時選 '' → onSave(permissions, 剩餘物件)，不寫頂層 ${key}`, async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { allow: ['Bash(ls:*)'], [key]: 'disable' } }, onSave, vi.fn(), 'project', { user: { permissions: { [key]: 'disable' } } });
    await waitFor(() => expect(getSelect()).toBeTruthy());
    fireEvent.change(getSelect(), { target: { value: '' } });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('permissions', { allow: ['Bash(ls:*)'] }));
    expect(onSave).not.toHaveBeenCalledWith(key, expect.anything());
  });

  it(`B23（守衛）${key} 是 permissions 唯一 key、上層有設時選 '' → onDelete(permissions)`, async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderSection({ permissions: { [key]: 'disable' } }, onSave, onDelete, 'project', { user: { permissions: { [key]: 'disable' } } });
    await waitFor(() => expect(getSelect()).toBeTruthy());
    fireEvent.change(getSelect(), { target: { value: '' } });
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('permissions'));
    expect(onDelete).not.toHaveBeenCalledWith(key);
  });
});
