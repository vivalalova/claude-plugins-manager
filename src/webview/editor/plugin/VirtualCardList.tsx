import React, { useRef, useCallback, useEffect } from 'react';
import { useVirtualScroll } from '../../hooks/useVirtualScroll';

/** 超過此數量才啟用虛擬滾動 */
export const VIRTUAL_THRESHOLD = 30;
/** 收合時的估計 card 高度 (px) */
const ESTIMATED_CARD_HEIGHT = 80;

interface VirtualCardListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
  keyExtractor: (item: T) => string;
  className?: string;
  /** items 變更時的版本號（filter/sort 時遞增，清空 height cache） */
  cacheVersion?: number;
}

/**
 * 虛擬滾動的 card 列表。
 * items 少於門檻時正常渲染，超過時只渲染 viewport 內的 items。
 * 虛擬模式下每個 item 包在 wrapper div 中以追蹤高度。
 */
export function VirtualCardList<T>({
  items,
  renderItem,
  keyExtractor,
  className,
  cacheVersion,
}: VirtualCardListProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<number, HTMLElement>());
  const callbackCache = useRef(new Map<number, (el: HTMLElement | null) => void>());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const shouldVirtualize = items.length > VIRTUAL_THRESHOLD;

  const { virtualRange, paddingTop, paddingBottom, measureHeight } = useVirtualScroll({
    itemCount: items.length,
    estimatedItemHeight: ESTIMATED_CARD_HEIGHT,
    overscan: 5,
    enabled: shouldVirtualize,
    containerRef: containerRef as React.RefObject<HTMLElement>,
    cacheVersion,
  });

  // ResizeObserver 追蹤可見 card 的高度變化（展開/收合）
  useEffect(() => {
    if (!shouldVirtualize) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const index = Number(el.dataset.virtualIndex);
        if (!Number.isNaN(index)) {
          measureHeight(index, entry.contentRect.height);
        }
      }
    });
    resizeObserverRef.current = ro;

    // 觀察當前所有已掛載的 items
    for (const el of itemRefs.current.values()) {
      ro.observe(el);
    }

    return () => ro.disconnect();
  }, [shouldVirtualize, measureHeight]);

  // 穩定的 ref callback — 每個 index 只建立一次 closure
  const getRefCallback = useCallback(
    (index: number): ((el: HTMLElement | null) => void) => {
      let cb = callbackCache.current.get(index);
      if (!cb) {
        cb = (el: HTMLElement | null) => {
          const ro = resizeObserverRef.current;
          const prev = itemRefs.current.get(index);
          if (prev && prev !== el && ro) {
            ro.unobserve(prev);
          }
          if (el) {
            itemRefs.current.set(index, el);
            if (ro) ro.observe(el);
            measureHeight(index, el.getBoundingClientRect().height);
          } else {
            itemRefs.current.delete(index);
          }
        };
        callbackCache.current.set(index, cb);
      }
      return cb;
    },
    [measureHeight],
  );

  // 非虛擬模式：正常渲染
  if (!virtualRange) {
    return (
      <div ref={containerRef} className={className}>
        {items.map((item, i) => renderItem(item, i))}
      </div>
    );
  }

  // 虛擬模式：只渲染可見範圍
  const virtualClassName = className ? `${className} card-list--virtual` : 'card-list--virtual';
  const isAtBottom = virtualRange.end >= items.length - 1;
  const visibleItems: React.ReactElement[] = [];
  for (let i = virtualRange.start; i <= virtualRange.end && i < items.length; i++) {
    const isLast = i === items.length - 1;
    visibleItems.push(
      <div
        key={keyExtractor(items[i])}
        data-virtual-index={i}
        data-is-last={isLast || undefined}
        ref={getRefCallback(i)}
      >
        {renderItem(items[i], i)}
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${virtualClassName}${isAtBottom ? ' card-list--at-bottom' : ''}`}
      style={{ paddingTop, paddingBottom }}
    >
      {visibleItems}
    </div>
  );
}
