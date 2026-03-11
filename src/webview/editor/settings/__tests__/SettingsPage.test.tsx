/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';

/* ── Mock vscode bridge ── */
const { mockSendRequest, mockOnPushMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
}));

vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

import { SettingsPage } from '../SettingsPage';
import { ToastProvider } from '../../../components/Toast';

const renderPage = () => renderWithI18n(<ToastProvider><SettingsPage /></ToastProvider>);

describe('SettingsPage', () => {
  beforeEach(() => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({});
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('渲染 scope tabs：User / Project / Local', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('User')).toBeTruthy();
      expect(screen.getByText('Project')).toBeTruthy();
      expect(screen.getByText('Local')).toBeTruthy();
    });
  });

  it('渲染左側 nav：Model / Permissions / Env / Hooks / General', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Model')).toBeTruthy();
      expect(screen.getByText('Permissions')).toBeTruthy();
      expect(screen.getByText('Env')).toBeTruthy();
      expect(screen.getByText('Hooks')).toBeTruthy();
      expect(screen.getByText('General')).toBeTruthy();
    });
  });

  it('預設顯示 Model 區塊', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy();
    });
  });

  it('無 workspace 時 Project/Local tab 為 disabled', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([]);
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => {
      const projectTab = screen.getByText('Project').closest('button');
      expect(projectTab?.disabled).toBe(true);
      const localTab = screen.getByText('Local').closest('button');
      expect(localTab?.disabled).toBe(true);
    });
  });

  it('有 workspace 時 Project tab 可點擊', async () => {
    renderPage();

    await waitFor(() => {
      const projectTab = screen.getByText('Project').closest('button');
      expect(projectTab?.disabled).toBe(false);
    });
  });

  it('model 已設定時，Select 顯示對應值', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ model: 'claude-opus-4-6' });
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('claude-opus-4-6');
    });
  });

  it('點擊切換到 Project scope → 重新 fetch settings', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Project'));
    fireEvent.click(screen.getByText('Project').closest('button')!);

    await waitFor(() => {
      const settingsGetCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.get',
      );
      // user scope + project scope = 2 calls
      expect(settingsGetCalls.length).toBeGreaterThanOrEqual(2);
      expect(settingsGetCalls.some((c: any[]) => c[0]?.scope === 'project')).toBe(true);
    });
  });

  it('選擇 model 並點擊 Save → sendRequest settings.set', async () => {
    renderPage();

    await waitFor(() => screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'claude-sonnet-4-6' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      const setCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.set',
      );
      expect(setCalls.length).toBe(1);
      expect(setCalls[0][0]).toMatchObject({
        type: 'settings.set',
        scope: 'user',
        key: 'model',
        value: 'claude-sonnet-4-6',
      });
    });
  });

  it('model 已設定時顯示 Clear 按鈕，點擊後 sendRequest settings.delete', async () => {
    mockSendRequest.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get') return Promise.resolve({ model: 'claude-sonnet-4-6' });
      if (msg.type === 'settings.delete') return Promise.resolve(undefined);
      if (msg.type === 'settings.set') return Promise.resolve(undefined);
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => screen.getByText('Clear'));
    fireEvent.click(screen.getByText('Clear'));

    await waitFor(() => {
      const deleteCalls = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.delete',
      );
      expect(deleteCalls.length).toBe(1);
      expect(deleteCalls[0][0]).toMatchObject({
        type: 'settings.delete',
        scope: 'user',
        key: 'model',
      });
    });
  });

  it('點擊非 model nav（如 Permissions）→ 顯示 coming soon 文字', async () => {
    renderPage();

    await waitFor(() => screen.getByText('Permissions'));
    fireEvent.click(screen.getByText('Permissions').closest('button')!);

    await waitFor(() => {
      expect(screen.getByText(/Coming soon/i)).toBeTruthy();
    });
  });

  it('settings.refresh push message → 重新 fetch', async () => {
    let pushHandler: ((msg: { type: string }) => void) | null = null;
    mockOnPushMessage.mockImplementation((handler: (msg: { type: string }) => void) => {
      pushHandler = handler;
      return () => {};
    });

    renderPage();
    await waitFor(() => screen.getByRole('combobox'));

    const beforeCount = mockSendRequest.mock.calls.filter(
      (c: any[]) => c[0]?.type === 'settings.get',
    ).length;

    // 觸發 push message
    pushHandler?.({ type: 'settings.refresh' });

    await waitFor(() => {
      const afterCount = mockSendRequest.mock.calls.filter(
        (c: any[]) => c[0]?.type === 'settings.get',
      ).length;
      expect(afterCount).toBeGreaterThan(beforeCount);
    });
  });
});
