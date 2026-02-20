import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 將輸入值延遲指定毫秒後才更新，避免每次 keystroke 都觸發重算。
 * 回傳 `[debouncedValue, flushValue]`：
 * - `debouncedValue`：延遲後的值
 * - `flushValue(val)`：立即設定 debounced 值並取消待執行的 timer（用於 Clear 等需要即時反應的操作）
 *
 * @param value 要 debounce 的值
 * @param delay 延遲毫秒數
 */
export function useDebouncedValue<T>(value: T, delay: number): [T, (val: T) => void] {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [value, delay]);

  /** 立即設定 debounced 值，取消待執行的 timer */
  const flush = useCallback((val: T) => {
    clearTimeout(timerRef.current);
    setDebouncedValue(val);
  }, []);

  return [debouncedValue, flush];
}
