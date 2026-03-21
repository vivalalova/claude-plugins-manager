import type { Memento } from 'vscode';

/**
 * UI 偏好持久化服務。
 * 封裝 VSCode context.globalState，取代自訂 preferences.json 檔案。
 */
export class PreferencesService {
  private static readonly STATE_KEY = 'preferences';
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly state: Memento) {}

  /** 讀取所有 UI 偏好 */
  readAll(): Record<string, unknown> {
    return this.state.get<Record<string, unknown>>(PreferencesService.STATE_KEY, {});
  }

  /** 寫入單一 UI 偏好 key（序列化避免併發覆蓋） */
  async write(key: string, value: unknown): Promise<void> {
    const task = this.writeQueue.then(async () => {
      const prefs = this.readAll();
      prefs[key] = value;
      await this.state.update(PreferencesService.STATE_KEY, prefs);
    });
    this.writeQueue = task.catch(() => {});
    return task;
  }
}
