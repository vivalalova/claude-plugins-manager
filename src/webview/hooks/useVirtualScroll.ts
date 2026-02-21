import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';

export interface VirtualRange {
  start: number;
  end: number;
}

interface UseVirtualScrollOptions {
  itemCount: number;
  estimatedItemHeight: number;
  /** 可見範圍外額外渲染的 item 數量（上下各 overscan 個） */
  overscan?: number;
  /** 是否啟用虛擬滾動 */
  enabled?: boolean;
  /** card-list 容器的 ref */
  containerRef?: React.RefObject<HTMLElement>;
  /** items 變更時的版本號（filter/sort 時遞增，清空 height cache） */
  cacheVersion?: number;
}

interface UseVirtualScrollResult {
  /** 可見範圍（null = 全渲染） */
  virtualRange: VirtualRange | null;
  /** card-list 的 paddingTop（上方隱藏 items 的高度） */
  paddingTop: number;
  /** card-list 的 paddingBottom（下方隱藏 items 的高度） */
  paddingBottom: number;
  /** 所有 items 的總高度 */
  totalHeight: number;
  /** 通知 hook 某 item 的實際量測高度 */
  measureHeight: (index: number, height: number) => void;
}

export function useVirtualScroll({
  itemCount,
  estimatedItemHeight,
  overscan = 5,
  enabled = true,
  containerRef,
  cacheVersion,
}: UseVirtualScrollOptions): UseVirtualScrollResult {
  const heightCache = useRef(new Map<number, number>());
  const [scrollTick, setScrollTick] = useState(0);
  const rafRef = useRef(0);

  // items 變更（filter/sort/cacheVersion）→ 清空 height cache
  useEffect(() => {
    heightCache.current.clear();
  }, [cacheVersion, itemCount]);

  const getItemHeight = useCallback(
    (index: number): number => heightCache.current.get(index) ?? estimatedItemHeight,
    [estimatedItemHeight],
  );

  const totalHeight = useMemo(() => {
    let h = 0;
    for (let i = 0; i < itemCount; i++) h += getItemHeight(i);
    return h;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount, getItemHeight, scrollTick]);

  // Scroll listener with RAF throttle
  useEffect(() => {
    if (!enabled) return;
    const onScroll = (): void => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setScrollTick((t) => t + 1);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [enabled]);

  // containerRef 在首次 render 時為 null，mount 後觸發重新計算
  useLayoutEffect(() => {
    if (enabled) setScrollTick((t) => t + 1);
  }, [enabled]);

  const measureHeight = useCallback((index: number, height: number): void => {
    const prev = heightCache.current.get(index);
    if (prev !== height) {
      heightCache.current.set(index, height);
      setScrollTick((t) => t + 1);
    }
  }, []);

  const computed = useMemo(() => {
    if (!enabled) {
      return { virtualRange: null, paddingTop: 0, paddingBottom: 0 };
    }

    const container = containerRef?.current;
    if (!container) {
      return { virtualRange: null, paddingTop: 0, paddingBottom: 0 };
    }

    const viewportHeight = window.innerHeight;
    const rect = container.getBoundingClientRect();

    // 可見範圍起點：viewport top 相對於 container top 的偏移
    const scrolledIntoContainer = -rect.top;
    const visibleStart = Math.max(0, scrolledIntoContainer);
    const visibleEnd = Math.max(0, scrolledIntoContainer + viewportHeight);

    // 找到可見範圍的 item index
    let cumHeight = 0;
    let startIndex = itemCount; // 預設：全部滾出
    for (let i = 0; i < itemCount; i++) {
      const h = getItemHeight(i);
      if (cumHeight + h > visibleStart) {
        startIndex = i;
        break;
      }
      cumHeight += h;
    }

    let endIndex = startIndex;
    let endCumHeight = cumHeight;
    for (let i = startIndex; i < itemCount; i++) {
      endCumHeight += getItemHeight(i);
      endIndex = i;
      if (endCumHeight >= visibleEnd) break;
    }

    // 加上 overscan
    const start = Math.max(0, startIndex - overscan);
    const end = Math.min(itemCount - 1, endIndex + overscan);

    // 計算 padding
    let paddingTop = 0;
    for (let i = 0; i < start; i++) paddingTop += getItemHeight(i);

    let paddingBottom = 0;
    for (let i = end + 1; i < itemCount; i++) paddingBottom += getItemHeight(i);

    return {
      virtualRange: { start, end },
      paddingTop,
      paddingBottom,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, containerRef, itemCount, getItemHeight, overscan, scrollTick]);

  return {
    ...computed,
    totalHeight,
    measureHeight,
  };
}
