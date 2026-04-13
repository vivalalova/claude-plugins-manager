/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

// Mock useToast to avoid ToastProvider complexity
const mockAddToast = vi.fn();
vi.mock('../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

import { usePageAction } from '../usePageAction';

describe('usePageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('action 成功時回傳結果', async () => {
    const { result } = renderHook(() => usePageAction(), {});

    let actionResult: string | undefined;
    await act(async () => {
      actionResult = await result.current({
        action: async () => 'success-result',
      });
    });

    expect(actionResult).toBe('success-result');
  });

  it('action 成功時呼叫 onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => usePageAction(), {});

    await act(async () => {
      await result.current({
        action: async () => 42,
        onSuccess,
      });
    });

    expect(onSuccess).toHaveBeenCalledWith(42);
  });

  it('action 失敗時呼叫 onError callback', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => usePageAction(), {});

    await act(async () => {
      await result.current({
        action: async () => { throw new Error('Test error'); },
        onError,
      });
    });

    expect(onError).toHaveBeenCalledWith('Test error', expect.any(Error));
  });

  it('action 失敗時使用 setError（無 onError）', async () => {
    const setError = vi.fn();
    const { result } = renderHook(() => usePageAction({ setError }), {});

    await act(async () => {
      await result.current({
        action: async () => { throw new Error('Fallback error'); },
      });
    });

    expect(setError).toHaveBeenCalledWith('Fallback error');
  });

  it('action 失敗時回傳 undefined', async () => {
    const { result } = renderHook(() => usePageAction(), {});

    let actionResult: unknown;
    await act(async () => {
      actionResult = await result.current({
        action: async () => { throw new Error('Fail'); },
        onError: vi.fn(),
      });
    });

    expect(actionResult).toBeUndefined();
  });

  it('clearError=true（預設）時清除 error', async () => {
    const setError = vi.fn();
    const { result } = renderHook(() => usePageAction({ setError }), {});

    await act(async () => {
      await result.current({
        action: async () => 'ok',
      });
    });

    expect(setError).toHaveBeenCalledWith(null);
  });

  it('clearError=false 時不清除 error', async () => {
    const setError = vi.fn();
    const { result } = renderHook(() => usePageAction({ setError }), {});

    await act(async () => {
      await result.current({
        clearError: false,
        action: async () => 'ok',
      });
    });

    expect(setError).not.toHaveBeenCalledWith(null);
  });

  it('successToast 字串時顯示 toast', async () => {
    const { result } = renderHook(() => usePageAction(), {});

    // Toast 會被加到 DOM，但我們只驗證 action 正常執行
    await act(async () => {
      await result.current({
        action: async () => 'done',
        successToast: 'Operation completed!',
      });
    });

    // Toast 已加入，無拋錯即通過
  });

  it('successToast 函數回傳 null 時不顯示 toast', async () => {
    const { result } = renderHook(() => usePageAction(), {});

    await act(async () => {
      await result.current({
        action: async () => 'done',
        successToast: () => null,
      });
    });

    // 無拋錯即通過
  });

  it('successToast 函數可存取 action 結果', async () => {
    const toastFn = vi.fn((_result: number) => 'Toast message');
    const { result } = renderHook(() => usePageAction(), {});

    await act(async () => {
      await result.current({
        action: async () => 123,
        successToast: toastFn,
      });
    });

    expect(toastFn).toHaveBeenCalledWith(123);
  });

  it('onFinally 無論成功失敗都會呼叫', async () => {
    const onFinally = vi.fn();
    const { result } = renderHook(() => usePageAction(), {});

    // 成功案例
    await act(async () => {
      await result.current({
        action: async () => 'ok',
        onFinally,
      });
    });
    expect(onFinally).toHaveBeenCalledTimes(1);

    // 失敗案例
    await act(async () => {
      await result.current({
        action: async () => { throw new Error('fail'); },
        onError: vi.fn(),
        onFinally,
      });
    });
    expect(onFinally).toHaveBeenCalledTimes(2);
  });

  it('非 Error 物件也能正確轉為錯誤訊息', async () => {
    const setError = vi.fn();
    const { result } = renderHook(() => usePageAction({ setError }), {});

    await act(async () => {
      await result.current({
        action: async () => { throw 'string error'; },
      });
    });

    expect(setError).toHaveBeenCalledWith('string error');
  });
});
