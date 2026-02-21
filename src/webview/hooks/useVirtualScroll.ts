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

/** Binary search: first index in [0, len) where arr[index] > target */
function upperBound(arr: Float64Array, target: number, len: number): number {
  let lo = 0;
  let hi = len;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Binary search: first index in [0, len) where arr[index] >= target */
function lowerBound(arr: Float64Array, target: number, len: number): number {
  let lo = 0;
  let hi = len;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function useVirtualScroll({
  itemCount,
  estimatedItemHeight,
  overscan = 5,
  enabled = true,
  containerRef,
  cacheVersion,
}: UseVirtualScrollOptions): UseVirtualScrollResult {
  // heights[i] = item i 的高度（量測值或 estimatedItemHeight）
  const heightsRef = useRef<Float64Array>(new Float64Array(0));
  // prefixSums[i] = heights[0..i-1] 的總和，length = itemCount + 1
  const prefixSumsRef = useRef<Float64Array>(new Float64Array(1));
  const totalHeightRef = useRef(0);
  const prevRebuildRef = useRef({ itemCount: -1, cacheVersion: undefined as number | undefined });

  const [scrollTick, setScrollTick] = useState(0);
  const rafRef = useRef(0);

  // itemCount / cacheVersion 變更 → 同步重建 prefix sums（render phase，無延遲）
  if (prevRebuildRef.current.itemCount !== itemCount || prevRebuildRef.current.cacheVersion !== cacheVersion) {
    prevRebuildRef.current = { itemCount, cacheVersion };
    const heights = new Float64Array(itemCount);
    const prefixSums = new Float64Array(itemCount + 1);
    for (let i = 0; i < itemCount; i++) {
      heights[i] = estimatedItemHeight;
      prefixSums[i + 1] = prefixSums[i] + estimatedItemHeight;
    }
    heightsRef.current = heights;
    prefixSumsRef.current = prefixSums;
    totalHeightRef.current = prefixSums[itemCount];
  }

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

  // mount 後觸發初次計算
  useLayoutEffect(() => {
    if (enabled) setScrollTick((t) => t + 1);
  }, [enabled]);

  const measureHeight = useCallback((index: number, height: number): void => {
    const heights = heightsRef.current;
    if (index >= heights.length) return;
    const prev = heights[index];
    if (prev === height) return;
    const diff = height - prev;
    heights[index] = height;
    // Incremental prefix sum update: O(n-index)
    const prefixSums = prefixSumsRef.current;
    for (let i = index + 1; i < prefixSums.length; i++) {
      prefixSums[i] += diff;
    }
    totalHeightRef.current += diff;
    setScrollTick((t) => t + 1);
  }, []);

  const computed = useMemo(() => {
    if (!enabled) {
      return { virtualRange: null, paddingTop: 0, paddingBottom: 0 };
    }

    const container = containerRef?.current;
    if (!container) {
      return { virtualRange: null, paddingTop: 0, paddingBottom: 0 };
    }

    const n = itemCount;
    if (n === 0) {
      return { virtualRange: { start: 0, end: -1 }, paddingTop: 0, paddingBottom: 0 };
    }

    const prefixSums = prefixSumsRef.current;
    const viewportHeight = window.innerHeight;
    const rect = container.getBoundingClientRect();

    const scrolledIntoContainer = -rect.top;
    const visibleStart = Math.max(0, scrolledIntoContainer);
    const visibleEnd = Math.max(0, scrolledIntoContainer + viewportHeight);

    // O(log n) binary search for visible range
    const startIndex = Math.max(0, Math.min(upperBound(prefixSums, visibleStart, n + 1) - 1, n - 1));
    const endIndex = Math.max(startIndex, Math.min(lowerBound(prefixSums, visibleEnd, n + 1) - 1, n - 1));

    // overscan
    const start = Math.max(0, startIndex - overscan);
    const end = Math.min(n - 1, endIndex + overscan);

    // O(1) padding from prefix sums
    const paddingTop = prefixSums[start];
    const paddingBottom = Math.max(0, totalHeightRef.current - prefixSums[end + 1]);

    return {
      virtualRange: { start, end },
      paddingTop,
      paddingBottom,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, containerRef, itemCount, overscan, scrollTick]);

  return {
    ...computed,
    totalHeight: totalHeightRef.current,
    measureHeight,
  };
}
