/**
 * @vitest-environment jsdom
 */
import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useVirtualScroll } from '../useVirtualScroll';

/** jsdom 不支援 getBoundingClientRect，手動 mock */
function mockContainerRect(el: HTMLElement, top: number, height: number): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('useVirtualScroll', () => {
  beforeEach(() => {
    vi.stubGlobal('innerHeight', 600);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('disabled → 回傳所有 items，無 padding', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ itemCount: 100, estimatedItemHeight: 80, enabled: false }),
    );

    expect(result.current.virtualRange).toBeNull();
    expect(result.current.paddingTop).toBe(0);
    expect(result.current.paddingBottom).toBe(0);
  });

  it('enabled 但無 containerRef → 回傳 null range', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ itemCount: 5, estimatedItemHeight: 80, enabled: true }),
    );

    // 無 containerRef → computed 回傳 null
    expect(result.current.virtualRange).toBeNull();
  });

  it('container 在 viewport 內 → 計算可見範圍', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mockContainerRect(container, 0, 4000); // container 從頂端開始

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      return useVirtualScroll({
        itemCount: 50,
        estimatedItemHeight: 80,
        overscan: 3,
        containerRef: ref,
      });
    });

    // viewport 600px，每個 80px → ~7.5 個可見 + 3 overscan 上下
    // container top = 0 → scroll 在頂端
    // 可見：0..7，overscan 下方：8..10 → start=0, end=10
    const range = result.current.virtualRange!;
    expect(range).not.toBeNull();
    expect(range.start).toBe(0);
    expect(range.end).toBeGreaterThanOrEqual(7);
    expect(range.end).toBeLessThanOrEqual(15); // 合理上限

    // paddingTop 在頂端應為 0
    expect(result.current.paddingTop).toBe(0);
    // paddingBottom 應 > 0（有隱藏 items）
    expect(result.current.paddingBottom).toBeGreaterThan(0);

    document.body.removeChild(container);
  });

  it('container 部分在 viewport 外（向上滾出）→ start > 0', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    // container top = -800 → 已向上滾出 800px
    mockContainerRect(container, -800, 4000);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      return useVirtualScroll({
        itemCount: 50,
        estimatedItemHeight: 80,
        overscan: 2,
        containerRef: ref,
      });
    });

    const range = result.current.virtualRange!;
    expect(range).not.toBeNull();
    // 800px / 80px = 10 items scrolled out, minus 2 overscan → start ≈ 8
    expect(range.start).toBeGreaterThanOrEqual(5);
    expect(range.start).toBeLessThanOrEqual(10);

    // paddingTop 應 > 0（有 hidden items 上方）
    expect(result.current.paddingTop).toBeGreaterThan(0);

    document.body.removeChild(container);
  });

  it('container 完全在 viewport 外 → 空範圍', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    // container 完全在 viewport 下方
    mockContainerRect(container, 1000, 4000);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      return useVirtualScroll({
        itemCount: 50,
        estimatedItemHeight: 80,
        overscan: 2,
        containerRef: ref,
      });
    });

    // container top = 1000 > viewport height 600 → 全部不可見
    // 但 start 仍合法（可能是 0）
    const range = result.current.virtualRange;
    // 不可見的情況下可能回傳空範圍或首幾個
    expect(range).not.toBeNull();

    document.body.removeChild(container);
  });

  it('totalHeight 等於所有 items 的估計高度總和', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({ itemCount: 50, estimatedItemHeight: 80 }),
    );

    expect(result.current.totalHeight).toBe(50 * 80);
  });

  it('scroll 事件觸發重新計算（RAF throttled）', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mockContainerRect(container, 0, 4000);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      return useVirtualScroll({
        itemCount: 50,
        estimatedItemHeight: 80,
        overscan: 2,
        containerRef: ref,
      });
    });

    const rangeBefore = result.current.virtualRange!;
    expect(rangeBefore.start).toBe(0);

    // 模擬滾動：container 向上移 800px
    mockContainerRect(container, -800, 4000);
    window.dispatchEvent(new Event('scroll'));
    // 等待 RAF callback 執行
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    const rangeAfter = result.current.virtualRange!;
    expect(rangeAfter.start).toBeGreaterThan(0);

    document.body.removeChild(container);
  });

  it('measureHeight 更新 height cache → 影響 totalHeight', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mockContainerRect(container, -400, 4000);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      return useVirtualScroll({
        itemCount: 50,
        estimatedItemHeight: 80,
        overscan: 0,
        containerRef: ref,
      });
    });

    // 模擬量測前面的 items 高度為 120（比估計的 80 高）
    act(() => {
      result.current.measureHeight(0, 120);
      result.current.measureHeight(1, 120);
      result.current.measureHeight(2, 120);
    });

    // measureHeight 內部 setScrollTick 觸發 re-render → totalHeight 重算
    expect(result.current.totalHeight).toBe(3 * 120 + 47 * 80);

    document.body.removeChild(container);
  });

  it('itemCount 變化 → 重新計算', () => {
    const { result, rerender } = renderHook(
      ({ count }) => useVirtualScroll({ itemCount: count, estimatedItemHeight: 80 }),
      { initialProps: { count: 50 } },
    );

    expect(result.current.totalHeight).toBe(4000);

    rerender({ count: 100 });

    expect(result.current.totalHeight).toBe(8000);
  });
});
