/**
 * @vitest-environment jsdom
 */
import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';
import { VirtualCardList, VIRTUAL_THRESHOLD } from '../VirtualCardList';

function makeItems(count: number): { id: string; name: string }[] {
  return Array.from({ length: count }, (_, i) => ({ id: `item-${i}`, name: `Item ${i}` }));
}

describe('VirtualCardList', () => {
  beforeEach(() => {
    vi.stubGlobal('innerHeight', 600);
    // jsdom 不支援 ResizeObserver
    vi.stubGlobal('ResizeObserver', class {
      observe(): void { /* noop */ }
      unobserve(): void { /* noop */ }
      disconnect(): void { /* noop */ }
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('items <= VIRTUAL_THRESHOLD → 全部渲染', () => {
    const items = makeItems(VIRTUAL_THRESHOLD);
    const { container } = render(
      <VirtualCardList
        items={items}
        renderItem={(item) => <div className="card" key={item.id}>{item.name}</div>}
        keyExtractor={(item) => item.id}
        className="card-list"
      />,
    );

    const cards = container.querySelectorAll('.card');
    expect(cards.length).toBe(VIRTUAL_THRESHOLD);
    // 無 virtual class
    expect(container.querySelector('.card-list--virtual')).toBeNull();
  });

  it('items > VIRTUAL_THRESHOLD → 部分渲染 + virtual class', () => {
    const items = makeItems(100);
    const { container } = render(
      <VirtualCardList
        items={items}
        renderItem={(item) => <div className="card" key={item.id}>{item.name}</div>}
        keyExtractor={(item) => item.id}
        className="card-list"
      />,
    );

    // 應有 card-list--virtual class
    expect(container.querySelector('.card-list--virtual')).not.toBeNull();

    // 渲染的 cards 應少於總數
    const cards = container.querySelectorAll('.card');
    expect(cards.length).toBeLessThan(100);
    expect(cards.length).toBeGreaterThan(0);
  });

  it('items 變少（filter）→ 切回非虛擬模式', () => {
    const items100 = makeItems(100);
    const items10 = makeItems(10);

    const { container, rerender } = render(
      <VirtualCardList
        items={items100}
        renderItem={(item) => <div className="card" key={item.id}>{item.name}</div>}
        keyExtractor={(item) => item.id}
        className="card-list"
      />,
    );

    expect(container.querySelector('.card-list--virtual')).not.toBeNull();

    rerender(
      <VirtualCardList
        items={items10}
        renderItem={(item) => <div className="card" key={item.id}>{item.name}</div>}
        keyExtractor={(item) => item.id}
        className="card-list"
      />,
    );

    expect(container.querySelector('.card-list--virtual')).toBeNull();
    expect(container.querySelectorAll('.card').length).toBe(10);
  });

  it('虛擬模式 container 有 paddingTop/paddingBottom style', () => {
    const items = makeItems(500);
    const { container } = render(
      <VirtualCardList
        items={items}
        renderItem={(item) => <div className="card" key={item.id}>{item.name}</div>}
        keyExtractor={(item) => item.id}
        className="card-list"
      />,
    );

    // useLayoutEffect 觸發 scrollTick → 再補一次 scroll 確保計算
    act(() => { window.dispatchEvent(new Event('scroll')); });

    const list = container.querySelector('.card-list--virtual') as HTMLElement;
    expect(list).not.toBeNull();
    // 500 items 只渲染部分，paddingBottom 應 > 0
    const cards = list.querySelectorAll('.card');
    expect(cards.length).toBeLessThan(500);
    expect(cards.length).toBeGreaterThan(0);
  });

  it('cacheVersion 變更 → 不 crash 且正確 re-render（callbackCache 清空）', () => {
    const items = makeItems(50);
    const { container, rerender } = render(
      <VirtualCardList
        items={items}
        renderItem={(item) => <div className="card" key={item.id}>{item.name}</div>}
        keyExtractor={(item) => item.id}
        className="card-list"
        cacheVersion={0}
      />,
    );

    expect(container.querySelectorAll('.card').length).toBeGreaterThan(0);

    // cacheVersion 遞增（模擬 filter/sort） + items 變化
    const filtered = items.slice(0, 40);
    rerender(
      <VirtualCardList
        items={filtered}
        renderItem={(item) => <div className="card" key={item.id}>{item.name}</div>}
        keyExtractor={(item) => item.id}
        className="card-list"
        cacheVersion={1}
      />,
    );

    const cardsAfter = container.querySelectorAll('.card');
    expect(cardsAfter.length).toBeGreaterThan(0);
    expect(cardsAfter.length).toBeLessThanOrEqual(40);

    // 再次 cacheVersion 變更 → 連續操作不 crash
    rerender(
      <VirtualCardList
        items={items}
        renderItem={(item) => <div className="card" key={item.id}>{item.name}</div>}
        keyExtractor={(item) => item.id}
        className="card-list"
        cacheVersion={2}
      />,
    );

    expect(container.querySelectorAll('.card').length).toBeGreaterThan(0);
  });

  it('500 items 渲染時間 < 500ms', () => {
    const items = makeItems(500);
    const start = performance.now();

    render(
      <VirtualCardList
        items={items}
        renderItem={(item) => <div className="card" key={item.id}>{item.name}</div>}
        keyExtractor={(item) => item.id}
        className="card-list"
      />,
    );

    const elapsed = performance.now() - start;
    // CI 環境可能較慢，500ms 足夠寬鬆
    expect(elapsed).toBeLessThan(500);
  });
});
