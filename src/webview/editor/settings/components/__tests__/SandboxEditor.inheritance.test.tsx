/**
 * @vitest-environment jsdom
 */
// #32 — sandbox 布林勾選框在本層未設時反映最近一個有設的上層值，並加一行「Inherited from {scope}」；
// 點擊寫入＝顯示值取反。經 ObjectFieldEditor 渲染以涵蓋 parentSettings 傳遞。
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../../../__test-utils__/renderWithProviders';
import { ToastProvider } from '../../../../components/Toast';
import { I18nProvider } from '../../../../i18n/I18nContext';
import { ObjectFieldEditor } from '../ObjectFieldEditor';
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

type Scope = 'user' | 'project' | 'local';
type Parents = Partial<Record<Scope, ClaudeSettings>> | undefined;

const editor = (settings: ClaudeSettings, scope: Scope, parentSettings: Parents, onSave: ReturnType<typeof vi.fn>) => (
  <ToastProvider>
    <ObjectFieldEditor
      settingKey="sandbox"
      scope={scope}
      settings={settings}
      parentSettings={parentSettings as any}
      onSave={onSave}
      onDelete={vi.fn().mockResolvedValue(undefined)}
    />
  </ToastProvider>
);

const render = (settings: ClaudeSettings, scope: Scope, parentSettings: Parents) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const result = renderWithI18n(editor(settings, scope, parentSettings, onSave));
  const rerender = (nextSettings: ClaudeSettings, nextParents: Parents) =>
    result.rerender(<I18nProvider locale="en">{editor(nextSettings, scope, nextParents, onSave)}</I18nProvider>);
  return { onSave, rerender };
};

const enabledCb = (): HTMLInputElement => screen.getByRole('checkbox', { name: /^Enable Sandbox/ }) as HTMLInputElement;
const localBindingCb = (): HTMLInputElement =>
  screen.getByRole('checkbox', { name: /^Allow local port binding/ }) as HTMLInputElement;

describe('SandboxEditor — 布林繼承顯示（#32）', () => {
  it('B13 project、本層未設、user enabled=true → 勾選，並顯示 Inherited from User', () => {
    render({}, 'project', { user: { sandbox: { enabled: true } } });
    expect(enabledCb().checked).toBe(true);
    expect(screen.getByText(/Inherited from User/)).toBeTruthy();
  });

  it('B14 local、project 未設、user enabled=true → 勾選，Inherited from User', () => {
    render({}, 'local', { project: {}, user: { sandbox: { enabled: true } } });
    expect(enabledCb().checked).toBe(true);
    expect(screen.getByText(/Inherited from User/)).toBeTruthy();
  });

  it('B15 local、project enabled=false 蓋過 user=true（最近層）→ 未勾，Inherited from Project', () => {
    render({}, 'local', { project: { sandbox: { enabled: false } }, user: { sandbox: { enabled: true } } });
    expect(enabledCb().checked).toBe(false);
    expect(screen.getByText(/Inherited from Project/)).toBeTruthy();
    expect(screen.queryByText(/Inherited from User/)).toBeNull();
  });

  it('B16 繼承勾選 → 點擊 → onSave(sandbox, {enabled:false})；以該值 rerender → 未勾、無繼承字樣', async () => {
    const parents = { user: { sandbox: { enabled: true } } };
    const { onSave, rerender } = render({}, 'project', parents);
    fireEvent.click(enabledCb());
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('sandbox', { enabled: false }));

    rerender({ sandbox: { enabled: false } }, parents);
    expect(enabledCb().checked).toBe(false);
    expect(screen.queryByText(/Inherited from/)).toBeNull();
  });

  it('B17（守衛）上層快照未知 → 未勾、無繼承字樣 → 點擊 → onSave(sandbox, {enabled:true})', async () => {
    const { onSave } = render({}, 'project', undefined);
    expect(enabledCb().checked).toBe(false);
    expect(screen.queryByText(/Inherited from/)).toBeNull();
    fireEvent.click(enabledCb());
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('sandbox', { enabled: true }));
  });

  it('B18 巢狀 network.allowLocalBinding 繼承 true → 勾選 → 點擊 → onSave(sandbox, {network:{allowLocalBinding:false}})', async () => {
    const { onSave } = render({}, 'project', { user: { sandbox: { network: { allowLocalBinding: true } } } });
    expect(localBindingCb().checked).toBe(true);
    expect(screen.getByText(/Inherited from User/)).toBeTruthy();
    fireEvent.click(localBindingCb());
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('sandbox', { network: { allowLocalBinding: false } }));
  });

  it('B19 上層快照後到：parentSettings 從 undefined rerender 成 user enabled=true → 由未勾變勾', () => {
    const { rerender } = render({}, 'project', undefined);
    expect(enabledCb().checked).toBe(false);
    rerender({}, { user: { sandbox: { enabled: true } } });
    expect(enabledCb().checked).toBe(true);
  });

  it('本層有設時以本層為準、不顯示繼承字樣', () => {
    render({ sandbox: { enabled: false } }, 'project', { user: { sandbox: { enabled: true } } });
    expect(enabledCb().checked).toBe(false);
    expect(screen.queryByText(/Inherited from/)).toBeNull();
  });

  it('user scope 沒有上層 → 不顯示繼承字樣', () => {
    render({}, 'user', {});
    expect(enabledCb().checked).toBe(false);
    expect(screen.queryByText(/Inherited from/)).toBeNull();
  });
});
