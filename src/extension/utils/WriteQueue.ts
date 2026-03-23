/**
 * Promise-chain 序列化寫入佇列。
 * 確保同一 queue 內的非同步操作依序執行，避免並發覆蓋。
 */
export class WriteQueue {
  private queue: Promise<void> = Promise.resolve();

  /** 將非同步操作排入佇列，保證序列執行。 */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.queue.then(fn);
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }

  /**
   * 重置佇列（cache invalidation 時使用）。
   * 注意：已排入但尚未完成的 task 仍會繼續執行，reset 後的新 enqueue 不等待舊 task。
   * 適用於 cache 失效場景（舊 task 寫入的資料已無意義）。
   */
  reset(): void {
    this.queue = Promise.resolve();
  }
}

/**
 * 以 key 分組的序列化寫入佇列。
 * 同一 key 內序列化，不同 key 可並行。
 */
export class KeyedWriteQueue {
  private queues = new Map<string, Promise<void>>();

  /** 將非同步操作排入指定 key 的佇列。 */
  enqueue(key: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.queues.get(key) ?? Promise.resolve();
    const task = prev.then(fn);
    this.queues.set(key, task.catch(() => {}));
    return task;
  }
}
