/**
 * @vitest-environment jsdom
 *
 * #24 — 搜尋結果依 scope 過濾（沿用 getSchemaFieldBindings／isFieldVisibleForScope 同一判準）：
 *   - project scope 搜尋 user-only 欄位（Dialog Expiry）→ 找不到（落到空狀態訊息，而非「還沒渲染」）
 *   - user scope 搜尋同一欄位 → 找得到
 *   - local scope 搜尋 user+local 欄位（Use Auto Mode During Plan）→ 找得到
 *
 * 以及 sandbox 的「已自訂」badge／Customized 分頁只在該 scope 有「可見內容」才計入
 * （project scope 只寫了隱藏子設定的 sandbox 不算已自訂，鏡射 hasVisiblePermissionsContent
 * 的精神；巢狀隱藏子設定——如 network.strictAllowlist——也要蓋到，不能只擋頂層 key）。
 *
 * 全程以 label 文字（getByText('Project')/('Local')）找 tab，不用 querySelectorAll(...)[n]
 * 這種位置索引。
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** label 文字找對應的 scope tab（非位置索引）。 */
function scopeTab(label: 'User' | 'Project' | 'Local'): HTMLButtonElement {
  return screen.getByText(label).closest('button') as HTMLButtonElement;
}

function scopeBadge(label: 'User' | 'Project' | 'Local'): HTMLElement | null {
  return scopeTab(label).querySelector('.settings-scope-badge');
}

function setDefaultMock(): void {
  mockSendRequest.mockImplementation((msg: { type: string }) => {
    if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
    if (msg.type === 'settings.get') return Promise.resolve({});
    if (msg.type === 'settings.set') return Promise.resolve(undefined);
    if (msg.type === 'settings.delete') return Promise.resolve(undefined);
    return Promise.resolve(null);
  });
}

describe('SettingsPage — #24 搜尋依 scope 過濾', () => {
  beforeEach(setDefaultMock);

  it('user scope 搜尋 "Dialog Expiry" → 找得到', async () => {
    renderPage();
    await waitFor(() => screen.getByPlaceholderText('Search settings...'));
    fireEvent.change(screen.getByPlaceholderText('Search settings...'), { target: { value: 'Dialog Expiry' } });
    await waitFor(() => expect(screen.getByText('Forwarded Dialog Expiry')).toBeTruthy());
  });

  it('project scope 搜尋 "Dialog Expiry" → 落到搜尋空狀態（user-only，project 不生效）', async () => {
    renderPage();
    await waitFor(() => expect(scopeTab('Project').disabled).toBe(false));
    fireEvent.click(scopeTab('Project'));
    await waitFor(() => screen.getByPlaceholderText('Search settings...'));
    fireEvent.change(screen.getByPlaceholderText('Search settings...'), { target: { value: 'Dialog Expiry' } });

    // 正向錨點：確認搜尋真的跑完且落到「沒有結果」的空狀態，而非還沒渲染就通過
    await waitFor(() => expect(screen.getByText('No settings found matching your search.')).toBeTruthy());
    expect(screen.queryByText('Forwarded Dialog Expiry')).toBeNull();
  });

  it('local scope 搜尋 "Use Auto Mode During Plan" → 找得到（user+local 生效）', async () => {
    renderPage();
    await waitFor(() => expect(scopeTab('Local').disabled).toBe(false));
    fireEvent.click(scopeTab('Local'));
    await waitFor(() => screen.getByPlaceholderText('Search settings...'));
    fireEvent.change(screen.getByPlaceholderText('Search settings...'), { target: { value: 'Use Auto Mode During Plan' } });
    await waitFor(() => expect(screen.getByText('Use Auto Mode During Plan')).toBeTruthy());
  });
});

describe('SettingsPage — #24 sandbox 已自訂 badge 只在有可見內容時計入', () => {
  beforeEach(setDefaultMock);

  it('project 只寫了隱藏頂層子設定（allowAppleEvents）的 sandbox → badge 不計入', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ sandbox: { allowAppleEvents: true } });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ model: 'x' }); // 錨點：確認 loadScopeCounts 完成
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => expect(scopeTab('Project').disabled).toBe(false));
    await waitFor(() => {
      const localBadge = scopeBadge('Local');
      expect(localBadge).not.toBeNull();
      expect(localBadge!.textContent).toBe('1');
    });

    expect(scopeBadge('Project')).toBeNull();
  });

  it('project 只寫了隱藏的巢狀子設定（network.strictAllowlist）的 sandbox → badge 不計入', async () => {
    // 只擋頂層 key 的實作會誤判：sandbox.network 本身非空（{ strictAllowlist: true }）
    // 但其唯一內容是隱藏子設定，巢狀也要判到「無可見內容」。
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ sandbox: { network: { strictAllowlist: true } } });
      if (msg.type === 'settings.get' && msg.scope === 'local')
        return Promise.resolve({ model: 'x' }); // 錨點
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => expect(scopeTab('Project').disabled).toBe(false));
    await waitFor(() => {
      const localBadge = scopeBadge('Local');
      expect(localBadge).not.toBeNull();
      expect(localBadge!.textContent).toBe('1');
    });

    expect(scopeBadge('Project')).toBeNull();
  });

  it('project 有 sandbox 可見內容（enabled: true）→ badge 計入 1', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ sandbox: { enabled: true } });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => expect(scopeTab('Project').disabled).toBe(false));
    await waitFor(() => {
      const badge = scopeBadge('Project');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });
  });

  it('project 混合可見與隱藏子設定（enabled + allowAppleEvents）→ badge 仍計入 1（不重複計）', async () => {
    mockSendRequest.mockImplementation((msg: { type: string; scope?: string }) => {
      if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
      if (msg.type === 'settings.get' && msg.scope === 'project')
        return Promise.resolve({ sandbox: { enabled: true, allowAppleEvents: true } });
      if (msg.type === 'settings.get') return Promise.resolve({});
      return Promise.resolve(null);
    });

    renderPage();

    await waitFor(() => expect(scopeTab('Project').disabled).toBe(false));
    await waitFor(() => {
      const badge = scopeBadge('Project');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });
  });
});
