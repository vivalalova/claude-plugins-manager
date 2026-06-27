/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { useRemoteListQuery } from '../useRemoteListQuery';

afterEach(() => {
  cleanup();
});

describe('useRemoteListQuery', () => {
  it('cache-hit 早返回不遞增 latestRequestIdRef → in-flight A 仍通過守衛覆寫 cachedB (regression #17)', async () => {
    // 穩定參照：load/getCacheKey 不因 rerender 重建而造成額外 effect 重跑
    const resultB = ['item-B-1', 'item-B-2'];
    const resultA = ['item-A-1', 'item-A-2'];

    let resolveA: (items: string[]) => void;
    const deferredA = new Promise<string[]>((resolve) => {
      resolveA = resolve;
    });

    const load = vi.fn((query: string): Promise<string[]> => {
      if (query === 'A') return deferredA;
      // B 立即 resolve
      return Promise.resolve(resultB);
    });

    const getCacheKey = vi.fn((q: string) => q);

    // Step 1: 先讓 B 完成並進 cache
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) =>
        useRemoteListQuery({
          enabled: true,
          query,
          debounceMs: 0,
          getCacheKey,
          load,
        }),
      { initialProps: { query: 'B' } },
    );

    // 等 B 完成，進 cache，items = resultB
    await waitFor(() => {
      expect(result.current.items).toEqual(resultB);
    });
    expect(load).toHaveBeenCalledWith('B');
    expect(result.current.loading).toBe(false);

    // Step 2: 改 query 為 A，A 的 load in-flight（尚未 resolve）
    rerender({ query: 'A' });

    // 必須確認 load('A') 真的被呼叫（effect 跑到 in-flight 分支）
    // 若 debounce 把 A 吞掉 → load('A') 不會被叫 → test 自身缺陷
    await waitFor(() => {
      expect(load).toHaveBeenCalledWith('A');
    });
    // A 未 resolve，loading 應為 true
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Step 3: 趁 A in-flight，把 query 改回 B → cache-hit，items 應立即變 cachedB
    rerender({ query: 'B' });

    // 確認 cache-hit 分支執行：loading 回 false（cache-hit 設 setLoading(false)），items = resultB
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // B 是 cache-hit，load 只被叫 2 次（B 一次、A 一次）
    expect(load).toHaveBeenCalledTimes(2);

    // items 此刻應為 cachedB
    expect(result.current.items).toBe(resultB);

    // Step 4: 現在才讓 A 的 in-flight resolve
    await act(async () => {
      resolveA!(resultA);
    });

    // 斷言：A 的遲到 resolve 不應覆寫 cachedB
    // Bug 前（latestRequestIdRef 未遞增）：requestId(A) === latestRef → setItems(resultA) 覆寫 → 斷言紅
    // Bug 修後（cache-hit 遞增）：requestId(A) < latestRef → 守衛擋住 → items 維持 resultB → 斷言綠
    expect(result.current.items).toBe(resultB);
  });
});
