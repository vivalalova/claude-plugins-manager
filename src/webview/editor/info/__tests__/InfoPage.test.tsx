/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import type { ExtensionInfo } from '../../../../shared/types';

const { mockSendRequest } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
}));

vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
}));

import { InfoPage } from '../InfoPage';
import { ToastProvider } from '../../../components/Toast';

const renderPage = () => renderWithI18n(<ToastProvider><InfoPage /></ToastProvider>);

function makeInfo(overrides: Partial<ExtensionInfo> = {}): ExtensionInfo {
  return {
    extensionVersion: '1.2.3',
    extensionName: 'Claude Plugins Manager',
    publisher: 'vibeai',
    repoUrl: 'https://github.com/vibeai/claude-plugins',
    cliPath: '/usr/local/bin/claude',
    cliVersion: '1.0.5',
    cacheDirPath: { path: '/Users/test/.claude/plugins/cache', exists: true },
    pluginsDirPath: { path: '/Users/test/.claude/plugins', exists: true },
    dataDirPath: { path: '/Users/test/.claude/plugins/data', exists: true },
    installedPluginsPath: { path: '/Users/test/.claude/plugins/installed_plugins.json', exists: true },
    knownMarketplacesPath: { path: '/Users/test/.claude/plugins/known_marketplaces.json', exists: true },
    extensionPath: { path: '/Users/test/.vscode/extensions/claude-plugins', exists: true },
    preferencesPath: { path: '/Users/test/.claude/claude-plugins-manager/preferences.json', exists: true },
    homeDirPrefix: '/Users/test',
    ...overrides,
  };
}

describe('InfoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('載入完成後顯示 extension 資訊', async () => {
    mockSendRequest.mockResolvedValue(makeInfo());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Claude Plugins Manager')).toBeTruthy();
      expect(screen.getByText('1.2.3')).toBeTruthy();
      expect(screen.getByText('vibeai')).toBeTruthy();
    });
  });

  it('顯示 CLI 路徑與版本', async () => {
    mockSendRequest.mockResolvedValue(makeInfo());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('/usr/local/bin/claude')).toBeTruthy();
      expect(screen.getByText('1.0.5')).toBeTruthy();
    });
  });

  it('cliVersion 為 null 時顯示 "Not found"', async () => {
    mockSendRequest.mockResolvedValue(makeInfo({ cliVersion: null, cliPath: null }));

    renderPage();

    await waitFor(() => {
      // "Not found" appears twice (cliPath + cliVersion)
      const notFounds = screen.getAllByText('Not found');
      expect(notFounds.length).toBe(2);
    });
  });

  it('顯示所有路徑列與 Open 按鈕', async () => {
    mockSendRequest.mockResolvedValue(makeInfo());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Cache Directory')).toBeTruthy();
      expect(screen.getByText('Plugins Directory')).toBeTruthy();
      expect(screen.getByText('Extension Path')).toBeTruthy();
      // 6 paths → 6+ "Open" buttons
      const openBtns = screen.getAllByRole('button', { name: 'Open' });
      expect(openBtns.length).toBe(7);
    });
  });

  it('點擊 Open → 發送 extension.revealPath', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'extension.getInfo') return makeInfo();
      return undefined;
    });

    renderPage();

    await waitFor(() => screen.getAllByRole('button', { name: 'Open' }));

    const openBtns = screen.getAllByRole('button', { name: 'Open' });
    fireEvent.click(openBtns[0]);

    await waitFor(() => {
      const revealCall = mockSendRequest.mock.calls.find(
        ([req]) => (req as { type: string }).type === 'extension.revealPath',
      );
      expect(revealCall).toBeTruthy();
      expect(revealCall?.[0]).toMatchObject({
        type: 'extension.revealPath',
        path: '/Users/test/.claude/plugins/cache',
      });
    });
  });

  it('點擊 repo link → 發送 openExternal', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'extension.getInfo') return makeInfo();
      return undefined;
    });

    renderPage();

    await waitFor(() => screen.getByText('https://github.com/vibeai/claude-plugins'));

    const repoLink = screen.getByText('https://github.com/vibeai/claude-plugins');
    fireEvent.click(repoLink);

    await waitFor(() => {
      const externalCall = mockSendRequest.mock.calls.find(
        ([req]) => (req as { type: string }).type === 'openExternal',
      );
      expect(externalCall).toBeTruthy();
    });
  });

  it('點擊 Clear Cache → 顯示 confirm dialog → 確認 → 發送 extension.clearCache → toast', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'extension.getInfo') return makeInfo();
      return { cleared: true };
    });

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'Clear Cache' }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear Cache' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    const confirmBtn = screen.getByRole('button', { name: 'Clear' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      const clearCall = mockSendRequest.mock.calls.find(
        ([req]) => (req as { type: string }).type === 'extension.clearCache',
      );
      expect(clearCall).toBeTruthy();
      // Toast should show success message
      expect(screen.getByText('Cache cleared')).toBeTruthy();
    });
  });

  it('取消 Clear Cache confirm → 不發送 extension.clearCache', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'extension.getInfo') return makeInfo();
      return undefined;
    });

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'Clear Cache' }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear Cache' }));

    await waitFor(() => screen.getByRole('dialog'));

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    const clearCalls = mockSendRequest.mock.calls.filter(
      ([req]) => (req as { type: string }).type === 'extension.clearCache',
    );
    expect(clearCalls).toHaveLength(0);
  });

  it('getInfo 失敗時顯示 error 訊息', async () => {
    mockSendRequest.mockRejectedValue(new Error('network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load extension info/)).toBeTruthy();
    });
  });

  it('repoUrl 為 null 時不顯示 repo link', async () => {
    mockSendRequest.mockResolvedValue(makeInfo({ repoUrl: null }));

    renderPage();

    await waitFor(() => screen.getByText('Claude Plugins Manager'));

    expect(screen.queryByText('https://github.com/vibeai/claude-plugins')).toBeNull();
  });

  it('exists=false 的路徑顯示 "(not exists)" badge + 灰色樣式', async () => {
    mockSendRequest.mockResolvedValue(makeInfo({
      preferencesPath: { path: '/Users/test/.claude/prefs.json', exists: false },
    }));

    const { container } = renderPage();

    await waitFor(() => {
      expect(screen.getByText('(not exists)')).toBeTruthy();
      const missingRows = container.querySelectorAll('.info-path-row--missing');
      expect(missingRows.length).toBe(1);
    });
  });

  it('所有路徑 exists=true 時不顯示 "(not exists)" badge', async () => {
    mockSendRequest.mockResolvedValue(makeInfo());

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Open' }).length).toBe(7);
      expect(screen.queryByText('(not exists)')).toBeNull();
    });
  });
});
