/**
 * KeyedWriteQueue：#33 C10 改泛型後 getSettings 依賴「enqueue 回傳任務結果」。
 */
import { describe, it, expect } from 'vitest';
import { KeyedWriteQueue } from '../WriteQueue';

/** 可由測試手動放行的 promise */
function gate(): { promise: Promise<void>; release: () => void } {
  let release!: () => void;
  const promise = new Promise<void>((r) => { release = r; });
  return { promise, release };
}

describe('KeyedWriteQueue', () => {
  it('enqueue 回傳任務的結果值', async () => {
    const q = new KeyedWriteQueue();
    await expect(q.enqueue('k', async () => ({ a: 1 }))).resolves.toEqual({ a: 1 });
  });

  it('同 key 任務拋錯 → 呼叫端拿到錯誤，下一筆同 key 任務仍執行', async () => {
    const q = new KeyedWriteQueue();
    const failed = q.enqueue('k', async () => { throw new Error('boom'); });
    const next = q.enqueue('k', async () => 'ok');
    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('同 key 依序執行：前一筆未完成時後一筆不開始', async () => {
    const q = new KeyedWriteQueue();
    const g = gate();
    const order: string[] = [];
    const first = q.enqueue('k', async () => { await g.promise; order.push('first'); });
    const second = q.enqueue('k', async () => { order.push('second'); });
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual([]);
    g.release();
    await Promise.all([first, second]);
    expect(order).toEqual(['first', 'second']);
  });

  it('不同 key 不互相等待', async () => {
    const q = new KeyedWriteQueue();
    const g = gate();
    const blocked = q.enqueue('a', async () => { await g.promise; });
    await expect(q.enqueue('b', async () => 'b-done')).resolves.toBe('b-done');
    g.release();
    await blocked;
  });
});
