import type { Memento } from 'vscode';
import { readFile, rm, readdir, rmdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { WriteQueue } from '../utils/WriteQueue';

/** 舊版 preferences.json 路徑 */
const OLD_PREFS_DIR = join(homedir(), '.claude', 'claude-plugins-manager');
const OLD_PREFS_PATH = join(OLD_PREFS_DIR, 'preferences.json');
const MIGRATED_KEY = '_preferences_migrated';

/**
 * UI 偏好持久化服務。
 * 封裝 VSCode context.globalState，取代自訂 preferences.json 檔案。
 */
export class PreferencesService {
  private static readonly STATE_KEY = 'preferences';
  private readonly writeQueue = new WriteQueue();

  constructor(private readonly state: Memento) {}

  /** 讀取所有 UI 偏好 */
  readAll(): Record<string, unknown> {
    return this.state.get<Record<string, unknown>>(PreferencesService.STATE_KEY, {});
  }

  /** 寫入單一 UI 偏好 key（序列化避免併發覆蓋） */
  async write(key: string, value: unknown): Promise<void> {
    return this.writeQueue.enqueue(async () => {
      const prefs = this.readAll();
      prefs[key] = value;
      await this.state.update(PreferencesService.STATE_KEY, prefs);
    });
  }

  /**
   * 從舊版 preferences.json 遷移至 globalState。
   * 已遷移則跳過，遷移失敗僅 console.warn。
   */
  async migrateFromFile(): Promise<void> {
    const prefs = this.readAll();
    if (prefs[MIGRATED_KEY]) return;

    let oldPrefs: Record<string, unknown>;
    try {
      const raw = await readFile(OLD_PREFS_PATH, 'utf-8');
      oldPrefs = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // 舊檔不存在或無法讀取 → 標記已遷移，跳過
      await this.state.update(PreferencesService.STATE_KEY, { ...prefs, [MIGRATED_KEY]: true });
      return;
    }

    // 合併：舊檔 key 寫入 globalState（不覆蓋已有值）
    const merged = { ...oldPrefs, ...prefs, [MIGRATED_KEY]: true };
    await this.state.update(PreferencesService.STATE_KEY, merged);

    // 清理舊檔（失敗僅 warn）
    try {
      await rm(OLD_PREFS_PATH, { force: true });
      const entries = await readdir(OLD_PREFS_DIR);
      if (entries.length === 0) {
        await rmdir(OLD_PREFS_DIR);
      }
    } catch (e) {
      console.warn('[PreferencesService] Failed to clean old preferences file:', e);
    }
  }
}
