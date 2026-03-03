/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useDebouncedValue } from '../useDebounce';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('值變更後只在 delay 到期才更新 debouncedValue', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'alpha', delay: 300 } },
    );

    expect(result.current[0]).toBe('alpha');

    rerender({ value: 'beta', delay: 300 });
    expect(result.current[0]).toBe('alpha');

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current[0]).toBe('alpha');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current[0]).toBe('beta');
  });

  it('flush 會立即更新並取消待執行 timer', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'alpha', delay: 300 } },
    );

    rerender({ value: 'beta', delay: 300 });

    act(() => {
      result.current[1]('cleared');
    });
    expect(result.current[0]).toBe('cleared');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current[0]).toBe('cleared');
  });
});
