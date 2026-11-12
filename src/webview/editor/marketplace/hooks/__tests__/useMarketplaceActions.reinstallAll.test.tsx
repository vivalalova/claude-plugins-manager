/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const { mockSendRequest, addToastMock } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  addToastMock: vi.fn(),
}));

vi.mock('../../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  USER_CONFIRM_REQUEST_TIMEOUT_MS: 30 * 60_000,
}));

vi.mock('../../../../components/Toast', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

import { useMarketplaceActions } from '../useMarketplaceActions';

describe('useMarketplaceActions — 重新安裝全部', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('marketplace.reinstallAll 以使用者確認逾時（30 分鐘）送出，等得到使用者在確認框的決定', async () => {
    mockSendRequest.mockResolvedValue({ total: 2, succeeded: 2, failed: [], cancelledPlugins: [] });
    const fetchList = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useMarketplaceActions({ fetchList, setError: vi.fn() }));

    await act(async () => {
      await result.current.handleReinstallAll();
    });

    expect(mockSendRequest).toHaveBeenCalledWith({ type: 'marketplace.reinstallAll' }, 30 * 60_000);
    expect(fetchList).toHaveBeenCalled();
    expect(result.current.reinstalling).toBe(false);
  });

  it('有取消的外掛但無失敗 → 不顯示錯誤、仍重新抓清單', async () => {
    mockSendRequest.mockResolvedValue({
      total: 2,
      succeeded: 2,
      failed: [],
      cancelledPlugins: ['xcode@mp (user)'],
    });
    const fetchList = vi.fn().mockResolvedValue(undefined);
    const setError = vi.fn();

    const { result } = renderHook(() => useMarketplaceActions({ fetchList, setError }));

    await act(async () => {
      await result.current.handleReinstallAll();
    });

    expect(setError).not.toHaveBeenCalledWith(expect.any(String));
    expect(fetchList).toHaveBeenCalled();
  });
});
