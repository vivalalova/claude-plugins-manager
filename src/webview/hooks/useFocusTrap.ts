import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Dialog 用 focus trap hook。
 * - mount（或 active 變 true）時自動 focus 第一個互動元素
 * - Tab / Shift+Tab 限制在容器內循環
 * - Escape 呼叫 onClose
 * - unmount（或 active 變 false）時 focus 回到開啟前的元素
 *
 * @param onClose Escape 時呼叫的 callback
 * @param active 是否啟用（inline dialog 用 dialogOpen 控制）
 */
export function useFocusTrap(
  onClose: () => void,
  active = true,
): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;

    // 記住開啟前的 focus 元素
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    // Auto-focus 第一個互動元素
    const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (firstFocusable) {
      firstFocusable.focus();
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // 還原 focus
      previousFocusRef.current?.focus();
    };
  }, [active]);

  return containerRef;
}
