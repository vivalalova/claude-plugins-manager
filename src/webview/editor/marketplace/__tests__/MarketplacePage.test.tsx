/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act, within } from '@testing-library/react';

/* ── Mock vscode bridge ── */
const { mockSendRequest, mockOnPushMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
}));
vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
}));

import { MarketplacePage } from '../MarketplacePage';
import { ToastProvider } from '../../../components/Toast';
import type { Marketplace } from '../../../../shared/types';

const renderPage = () => render(<ToastProvider><MarketplacePage /></ToastProvider>);

function makeMarketplace(name: string, autoUpdate = true): Marketplace {
  return {
    name,
    source: 'github',
    repo: `owner/${name}`,
    installLocation: `/home/.claude/plugins/marketplaces/${name}`,
    autoUpdate,
    lastUpdated: '2026-01-01T00:00:00Z',
  };
}

describe('MarketplacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('載入完成顯示 marketplace 卡片列表', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'marketplace.list') {
        return [makeMarketplace('alpha'), makeMarketplace('beta')];
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeTruthy();
      expect(screen.getByText('beta')).toBeTruthy();
    });
  });

  it('載入中顯示 Loading spinner', () => {
    // sendRequest 永遠不 resolve → 保持 loading 狀態
    mockSendRequest.mockImplementation(() => new Promise(() => {}));

    renderPage();
    expect(screen.getByText('Loading marketplaces...')).toBeTruthy();
  });

  it('空列表顯示 "No marketplaces configured"', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'marketplace.list') return [];
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No marketplaces configured')).toBeTruthy();
    });
  });

  it('新增 marketplace：輸入 source → 點 Add → 送出 marketplace.add → 刷新列表', async () => {
    const calls: { type: string; source?: string }[] = [];
    mockSendRequest.mockImplementation(async (req: { type: string; source?: string }) => {
      calls.push(req);
      if (req.type === 'marketplace.list') {
        // 第一次回空，新增後回一筆
        const isAfterAdd = calls.filter((c) => c.type === 'marketplace.add').length > 0;
        return isAfterAdd ? [makeMarketplace('new-mp')] : [];
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No marketplaces configured')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Git URL, GitHub owner/repo, or local path');
    fireEvent.change(input, { target: { value: 'owner/new-mp' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Add'));
    });

    await waitFor(() => {
      expect(screen.getByText('new-mp')).toBeTruthy();
    });

    const addCall = calls.find((c) => c.type === 'marketplace.add');
    expect(addCall).toBeDefined();
    expect(addCall?.source).toBe('owner/new-mp');
  });

  it('新增 marketplace：空白 source → 不送出 marketplace.add', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'marketplace.list') return [];
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No marketplaces configured')).toBeTruthy();
    });

    // Add 按鈕在輸入為空時應該 disabled
    const addBtn = screen.getByRole('button', { name: 'Add' });
    expect((addBtn as HTMLButtonElement).disabled).toBe(true);

    // 強制 click 後列表仍顯示空狀態（未送出 → 未刷新 → 無新資料）
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(screen.getByText('No marketplaces configured')).toBeTruthy();
  });

  it('移除 marketplace：點 Remove → ConfirmDialog → 確認 → 送出 marketplace.remove → 刷新', async () => {
    const calls: { type: string; name?: string }[] = [];
    mockSendRequest.mockImplementation(async (req: { type: string; name?: string }) => {
      calls.push(req);
      if (req.type === 'marketplace.list') {
        const isAfterRemove = calls.filter((c) => c.type === 'marketplace.remove').length > 0;
        return isAfterRemove ? [] : [makeMarketplace('alpha')];
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeTruthy();
    });

    // 點 Remove → ConfirmDialog 出現
    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => {
      expect(screen.getByText('Remove Marketplace')).toBeTruthy();
    });

    // 確認移除（dialog scope + 語義化 query，不依賴 CSS class）
    await act(async () => {
      const dialog = within(screen.getByRole('dialog'));
      fireEvent.click(dialog.getByRole('button', { name: 'Remove' }));
    });

    await waitFor(() => {
      expect(screen.getByText('No marketplaces configured')).toBeTruthy();
    });

    const removeCall = calls.find((c) => c.type === 'marketplace.remove');
    expect(removeCall).toBeDefined();
    expect(removeCall?.name).toBe('alpha');
  });

  it('載入失敗顯示 ErrorBanner，可 dismiss', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'marketplace.list') throw new Error('network failure');
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('network failure')).toBeTruthy();
    });

    // dismiss 錯誤
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('network failure')).toBeNull();
  });

  it('Update All 按鈕送出 marketplace.update（無 name）→ 刷新', async () => {
    const calls: { type: string; name?: string }[] = [];
    mockSendRequest.mockImplementation(async (req: { type: string; name?: string }) => {
      calls.push(req);
      if (req.type === 'marketplace.list') return [makeMarketplace('alpha')];
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Update All'));
    });

    await waitFor(() => {
      // 按鈕回到 'Update All'（更新完成，不再顯示 'Updating...'）
      expect(screen.getByText('Update All')).toBeTruthy();
    });

    // marketplace.update payload 驗證：name 應為 undefined（更新全部）
    const updateCall = calls.find((c) => c.type === 'marketplace.update');
    expect(updateCall).toBeDefined();
    expect(updateCall?.name).toBeUndefined();

    // 更新後卡片仍顯示（刷新成功）
    expect(screen.getByText('alpha')).toBeTruthy();
  });

  it('marketplace.refresh push → 靜默刷新列表（不顯示 spinner）', async () => {
    let pushCallback: ((msg: Record<string, unknown>) => void) | undefined;
    mockOnPushMessage.mockImplementation((cb: (msg: Record<string, unknown>) => void) => {
      pushCallback = cb;
      return () => {};
    });

    let listCallCount = 0;
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'marketplace.list') {
        listCallCount++;
        // 第二次呼叫回傳新資料
        return listCallCount === 1
          ? [makeMarketplace('alpha')]
          : [makeMarketplace('alpha'), makeMarketplace('beta')];
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeTruthy();
    });

    // 觸發 marketplace.refresh push
    await act(async () => {
      pushCallback!({ type: 'marketplace.refresh' });
    });

    await waitFor(() => {
      // beta 出現（靜默刷新成功）
      expect(screen.getByText('beta')).toBeTruthy();
    });

    // 靜默刷新不應顯示 spinner
    expect(screen.queryByText('Loading marketplaces...')).toBeNull();
  });

  it('Enter 鍵新增 marketplace', async () => {
    const calls: { type: string; source?: string }[] = [];
    mockSendRequest.mockImplementation(async (req: { type: string; source?: string }) => {
      calls.push(req);
      if (req.type === 'marketplace.list') {
        const isAfterAdd = calls.filter((c) => c.type === 'marketplace.add').length > 0;
        return isAfterAdd ? [makeMarketplace('enter-mp')] : [];
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No marketplaces configured')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Git URL, GitHub owner/repo, or local path');
    fireEvent.change(input, { target: { value: 'owner/enter-mp' } });

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText('enter-mp')).toBeTruthy();
    });

    const addCall = calls.find((c) => c.type === 'marketplace.add');
    expect(addCall).toBeDefined();
    expect(addCall?.source).toBe('owner/enter-mp');
  });

  it('取消移除 ConfirmDialog → marketplace 留存，不送出 marketplace.remove', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'marketplace.list') return [makeMarketplace('alpha')];
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeTruthy();
    });

    // 點 Remove → ConfirmDialog 出現
    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => {
      expect(screen.getByText('Remove Marketplace')).toBeTruthy();
    });

    // 點 Cancel → Dialog 消失，alpha 仍在
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Remove Marketplace')).toBeNull();
    expect(screen.getByText('alpha')).toBeTruthy();
  });

  it('多個 marketplace → 各自顯示獨立的 Update / Remove 按鈕', async () => {
    mockSendRequest.mockImplementation(async (req: { type: string }) => {
      if (req.type === 'marketplace.list') {
        return [makeMarketplace('alpha'), makeMarketplace('beta')];
      }
      return undefined;
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeTruthy();
      expect(screen.getByText('beta')).toBeTruthy();
    });

    // 應有兩個 Update 與兩個 Remove 按鈕（卡片各一）
    const updateBtns = screen.getAllByText('Update');
    const removeBtns = screen.getAllByText('Remove');
    expect(updateBtns).toHaveLength(2);
    expect(removeBtns).toHaveLength(2);
  });
});
