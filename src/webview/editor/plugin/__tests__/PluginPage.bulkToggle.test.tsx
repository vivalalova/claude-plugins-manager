/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';
import { render, screen, waitFor, fireEvent, cleanup, act, within } from '@testing-library/react';

/* ── Mock vscode bridge ── */
const { mockSendRequest, mockOnPushMessage, mockViewState } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
  mockViewState: {} as Record<string, unknown>,
}));
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
  getViewState: (key: string, fallback: unknown) => key in mockViewState ? mockViewState[key] : fallback,
  setViewState: (key: string, value: unknown) => { mockViewState[key] = value; },
}));

import { PluginPage } from '../PluginPage';
import { ToastProvider } from '../../../components/Toast';
import type {
  InstalledPlugin,
  AvailablePlugin,
  PluginListResponse,
} from '../../../../shared/types';

const renderPage = () => renderWithI18n(<ToastProvider><PluginPage /></ToastProvider>);

function makeInstalled(name: string, mp: string, enabled: boolean): InstalledPlugin {
  return {
    id: `${name}@${mp}`,
    version: '1.0.0',
    scope: 'user',
    enabled,
    installPath: `/path/${name}`,
    installedAt: '2026-01-01T00:00:00Z',
    lastUpdated: '2026-01-01T00:00:00Z',
  };
}

function makeAvailable(name: string, mp: string): AvailablePlugin {
  return {
    pluginId: `${name}@${mp}`,
    name,
    description: `${name} description`,
    marketplaceName: mp,
  };
}

function makeResponse(
  installed: InstalledPlugin[],
  available: AvailablePlugin[],
): PluginListResponse {
  return { installed, available, marketplaceSources: {} };
}

/** 點擊 section "Enable All" → 等待 dialog → 確認 */
async function clickEnableAllWithDialog(): Promise<void> {
  // 點擊 section header 的 "Enable All" 按鈕（開啟 dialog）
  const sectionBtn = screen.getAllByText('Enable All').find(
    (el) => el.classList.contains('section-bulk-btn'),
  )!;
  await act(async () => { fireEvent.click(sectionBtn); });

  // dialog 出現後，點擊 dialog 內的 "Enable All" 確認按鈕
  const dialog = await screen.findByRole('dialog');
  const confirmBtn = within(dialog).getByText('Enable All');
  await act(async () => { fireEvent.click(confirmBtn); });
}

/** 從 mock.calls 中篩選指定 type 的呼叫 */
function filterCalls(type: string): { type: string; plugin?: string; scope?: string }[] {
  return mockSendRequest.mock.calls
    .map((args: unknown[]) => args[0] as { type: string; plugin?: string; scope?: string })
    .filter((req) => req.type === type);
}

describe('PluginPage — Marketplace Bulk Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockViewState)) delete mockViewState[key];
  });

  afterEach(() => {
    cleanup();
  });

  it('未安裝 plugin → section header 顯示 "Enable All"', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'workspace.getFolders') return [];
      if (req.type === 'plugin.listAvailable') {
        return makeResponse([], [
          makeAvailable('alpha', 'mp1'),
          makeAvailable('beta', 'mp1'),
        ]);
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Enable All')).toBeTruthy();
    });
  });

  it('全部 user-enabled → section header 顯示 "Disable All"', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'workspace.getFolders') return [];
      if (req.type === 'plugin.listAvailable') {
        return makeResponse(
          [
            makeInstalled('alpha', 'mp1', true),
            makeInstalled('beta', 'mp1', true),
          ],
          [makeAvailable('alpha', 'mp1'), makeAvailable('beta', 'mp1')],
        );
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Disable All')).toBeTruthy();
    });
  });

  it('部分 enabled → 顯示 "Enable All"', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'workspace.getFolders') return [];
      if (req.type === 'plugin.listAvailable') {
        return makeResponse(
          [makeInstalled('alpha', 'mp1', true)],
          [makeAvailable('alpha', 'mp1'), makeAvailable('beta', 'mp1')],
        );
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Enable All')).toBeTruthy();
    });
  });

  it('點擊 "Enable All" → scope dialog → 串行 install 未啟用的 plugin', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'workspace.getFolders') return [];
      if (req.type === 'plugin.listAvailable') {
        return makeResponse(
          [makeInstalled('alpha', 'mp1', true)],
          [makeAvailable('alpha', 'mp1'), makeAvailable('beta', 'mp1')],
        );
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Enable All')).toBeTruthy();
    });

    await clickEnableAllWithDialog();

    // beta（未安裝）應被 install；alpha（已啟用）應被跳過
    const installCalls = filterCalls('plugin.install');
    expect(installCalls).toHaveLength(1);
    expect(installCalls[0]).toEqual({
      type: 'plugin.install',
      plugin: 'beta@mp1',
      scope: 'user',
    });

    // install 自動 enable，不應額外呼叫 plugin.enable
    expect(filterCalls('plugin.enable')).toHaveLength(0);
  });

  it('已安裝但 disabled 的 plugin → dialog 確認 → 只呼叫 enable（不重新 install）', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'workspace.getFolders') return [];
      if (req.type === 'plugin.listAvailable') {
        return makeResponse(
          [makeInstalled('alpha', 'mp1', false)],
          [makeAvailable('alpha', 'mp1')],
        );
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Enable All')).toBeTruthy();
    });

    await clickEnableAllWithDialog();

    // 已安裝但 disabled → enable only, no install
    const installCalls = filterCalls('plugin.install');
    const enableCalls = filterCalls('plugin.enable');
    expect(installCalls).toHaveLength(0);
    expect(enableCalls).toHaveLength(1);
    expect(enableCalls[0].plugin).toBe('alpha@mp1');
  });

  it('點擊 "Disable All" → 串行 disable 已啟用的 plugin', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'workspace.getFolders') return [];
      if (req.type === 'plugin.listAvailable') {
        return makeResponse(
          [
            makeInstalled('alpha', 'mp1', true),
            makeInstalled('beta', 'mp1', true),
          ],
          [makeAvailable('alpha', 'mp1'), makeAvailable('beta', 'mp1')],
        );
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Disable All')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Disable All'));
    });

    const disableCalls = filterCalls('plugin.disable');
    expect(disableCalls).toHaveLength(2);
    expect(disableCalls[0].plugin).toBe('alpha@mp1');
    expect(disableCalls[1].plugin).toBe('beta@mp1');
  });

  it('部分失敗 → 不中斷，顯示錯誤摘要', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string; plugin?: string }) => {
      if (req.type === 'workspace.getFolders') return [];
      if (req.type === 'plugin.listAvailable') {
        return makeResponse([], [
          makeAvailable('alpha', 'mp1'),
          makeAvailable('beta', 'mp1'),
        ]);
      }
      // alpha install 失敗
      if (req.type === 'plugin.install' && req.plugin === 'alpha@mp1') {
        throw new Error('network error');
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Enable All')).toBeTruthy();
    });

    await clickEnableAllWithDialog();

    // beta 仍然被 install（不中斷）
    const installCalls = filterCalls('plugin.install');
    expect(installCalls).toHaveLength(2);

    // 錯誤摘要顯示
    await waitFor(() => {
      expect(screen.getByText(/Bulk toggle: 1 failed/)).toBeTruthy();
    });
  });

  it('多個 marketplace → 各自獨立的 bulk 按鈕', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'workspace.getFolders') return [];
      if (req.type === 'plugin.listAvailable') {
        return makeResponse(
          [makeInstalled('alpha', 'mp1', true)],
          [
            makeAvailable('alpha', 'mp1'),
            makeAvailable('gamma', 'mp2'),
          ],
        );
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      // mp1 只有 alpha 且已 enabled → Disable All
      // mp2 只有 gamma 且未安裝 → Enable All
      const buttons = screen.getAllByRole('button');
      const bulkBtns = buttons.filter(
        (b) => b.textContent === 'Enable All' || b.textContent === 'Disable All',
      );
      expect(bulkBtns).toHaveLength(2);
    });
  });
});
