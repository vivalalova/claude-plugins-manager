/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { usePushSyncedResource } from '../usePushSyncedResource';

// Mock vscode API
const mockUnsubscribe = vi.fn();
let capturedCallback: ((msg: unknown) => void) | null = null;

vi.mock('../../vscode', () => ({
  onPushMessage: vi.fn((cb: (msg: unknown) => void) => {
    capturedCallback = cb;
    return mockUnsubscribe;
  }),
}));

import { onPushMessage } from '../../vscode';

describe('usePushSyncedResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('初始載入 → loading → data', async () => {
    const load = vi.fn().mockResolvedValue({ items: [1, 2, 3] });

    const { result } = renderHook(() =>
      usePushSyncedResource({
        initialData: { items: [] },
        load,
      }),
    );

    // 初始狀態
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual({ items: [] });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ items: [1, 2, 3] });
    expect(result.current.error).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('load 拋錯 → error 狀態', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      usePushSyncedResource({
        initialData: [],
        load,
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toEqual([]);
  });

  it('refresh(false) 不顯示 loading spinner', async () => {
    let resolveLoad: (value: string[]) => void;
    const load = vi.fn().mockImplementation(
      () => new Promise<string[]>((resolve) => { resolveLoad = resolve; }),
    );

    const { result } = renderHook(() =>
      usePushSyncedResource({
        initialData: ['initial'],
        load,
      }),
    );

    // 等待初始載入完成
    await act(async () => { resolveLoad(['first']); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 第二次 refresh，showSpinner=false
    await act(async () => {
      const promise = result.current.refresh(false);
      // loading 應該保持 false
      expect(result.current.loading).toBe(false);
      resolveLoad(['second']);
      await promise;
    });

    expect(result.current.data).toEqual(['second']);
  });

  it('較舊 request 完成時不覆寫較新結果 (race condition)', async () => {
    let firstResolve: (value: number) => void;
    let secondResolve: (value: number) => void;

    const load = vi.fn()
      .mockImplementationOnce(() => new Promise<number>((r) => { firstResolve = r; }))
      .mockImplementationOnce(() => new Promise<number>((r) => { secondResolve = r; }));

    const { result } = renderHook(() =>
      usePushSyncedResource({
        initialData: 0,
        load,
      }),
    );

    // 等初始載入開始
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    // 觸發第二次 refresh（在第一次完成前）
    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    // 先完成第二次（較新）
    await act(async () => { secondResolve(200); });
    await waitFor(() => expect(result.current.data).toBe(200));

    // 再完成第一次（較舊）- 應該被忽略
    await act(async () => { firstResolve(100); });

    // 資料應該保持 200，不被 100 覆蓋
    expect(result.current.data).toBe(200);
  });

  it('pushFilter 匹配時觸發 silent refresh', async () => {
    const load = vi.fn().mockResolvedValue('data');
    const pushFilter = vi.fn((msg: { type?: string }) => msg.type === 'update');

    renderHook(() =>
      usePushSyncedResource({
        initialData: null,
        load,
        pushFilter,
      }),
    );

    // 等待初始載入
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    // 使用 capturedCallback 模擬 push message
    expect(capturedCallback).not.toBeNull();

    // 發送不匹配的 message
    await act(async () => {
      capturedCallback!({ type: 'other' });
    });
    expect(load).toHaveBeenCalledTimes(1); // 不觸發

    // 發送匹配的 message
    await act(async () => {
      capturedCallback!({ type: 'update' });
    });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('unmount 時取消 push 訂閱', async () => {
    const load = vi.fn().mockResolvedValue([]);
    const pushFilter = vi.fn(() => false);

    const { unmount } = renderHook(() =>
      usePushSyncedResource({
        initialData: [],
        load,
        pushFilter,
      }),
    );

    await waitFor(() => expect(onPushMessage).toHaveBeenCalled());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('setData 可直接更新資料', async () => {
    const load = vi.fn().mockResolvedValue(['loaded']);

    const { result } = renderHook(() =>
      usePushSyncedResource({
        initialData: ['initial'],
        load,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setData(['manually set']);
    });

    expect(result.current.data).toEqual(['manually set']);
  });

  it('setError 可直接設定錯誤', async () => {
    const load = vi.fn().mockResolvedValue([]);

    const { result } = renderHook(() =>
      usePushSyncedResource({
        initialData: [],
        load,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setError('Custom error');
    });

    expect(result.current.error).toBe('Custom error');
  });
});
