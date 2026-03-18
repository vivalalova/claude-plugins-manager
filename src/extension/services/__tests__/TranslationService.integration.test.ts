/**
 * TranslationService 整合測試。
 * 用真實 filesystem（tmpdir）驗證 cache 操作，mock fetch（不呼叫真實 API）。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { TranslationService } from '../TranslationService';

/* ── 建立 suite 共用的 tmpdir ── */
const SUITE_TMP = mkdtempSync(join(tmpdir(), 'trans-int-'));
const SUITE_CACHE_DIR = join(SUITE_TMP, 'cache');
const CACHE_PATH = join(SUITE_CACHE_DIR, 'translations.json');

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

/** 模擬 MyMemory API：將每行 [N] text 翻譯為 [N] text_translated */
function mockFetchTranslate(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
    const body = init.body;
    const qMatch = body.match(/q=([^&]+)/);
    const decoded = decodeURIComponent(qMatch?.[1] ?? '');
    // 將每行 [N] text → [N] text_translated
    const translated = decoded.split('\n').map((line) => {
      const m = line.match(/^\[(\d+)\]\s*(.+)/);
      return m ? `[${m[1]}] ${m[2]}_translated` : line;
    }).join('\n');
    return {
      ok: true,
      json: () => Promise.resolve({
        responseStatus: 200,
        responseData: { translatedText: translated },
      }),
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function readCacheFile(): Record<string, unknown> {
  return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
}

describe('TranslationService integration', () => {
  let svc: TranslationService;

  beforeEach(() => {
    // 清理 cache 目錄，每個 test 從乾淨狀態開始
    if (existsSync(SUITE_CACHE_DIR)) rmSync(SUITE_CACHE_DIR, { recursive: true, force: true });
    mkdirSync(SUITE_TMP, { recursive: true });
    svc = new TranslationService(SUITE_CACHE_DIR);
    vi.restoreAllMocks();
  });

  it('fresh install（無 cache 檔）：translate 不拋 ENOENT，cache 檔被建立', async () => {
    const fetchMock = mockFetchTranslate();
    expect(existsSync(CACHE_PATH)).toBe(false);

    const result = await svc.translate(['hello'], 'ja');

    expect(result.translations['hello']).toBe('hello_translated');
    expect(existsSync(CACHE_PATH)).toBe(true);
    const cache = readCacheFile();
    expect(cache).toHaveProperty('version', 1);
    expect(cache).toHaveProperty('entries');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('cache hit：第二次 translate 不呼叫 API', async () => {
    const fetchMock = mockFetchTranslate();

    await svc.translate(['hello'], 'ja');
    expect(fetchMock).toHaveBeenCalledOnce();

    // 第二次 — cache hit
    const result = await svc.translate(['hello'], 'ja');
    expect(result.translations['hello']).toBe('hello_translated');
    expect(fetchMock).toHaveBeenCalledOnce(); // 仍然只有 1 次
  });

  it('25 個不同 key：batch split 後全部出現在結果中', async () => {
    mockFetchTranslate();
    const keys = Array.from({ length: 25 }, (_, i) => `description_${i}`);

    const result = await svc.translate(keys, 'zh-TW');

    for (const key of keys) {
      expect(result.translations[key], `missing: ${key}`).toBe(`${key}_translated`);
    }
    // cache 檔含所有 25 個 entry
    const cache = readCacheFile() as { entries: Record<string, Record<string, string>> };
    const cachedValues = Object.values(cache.entries['zh-TW'] ?? {});
    expect(cachedValues.length).toBe(25);
  });

  it('3 個並行 translate()：cache 檔為有效 JSON 且不拋錯', async () => {
    mockFetchTranslate();

    // 先 warm up cache（避免 loadCache 並發 race：多個 call 同時 readFile → 各自建立不同 cache 物件）
    await svc.translate(['warmup'], 'ja');

    const groups = [
      ['alpha', 'beta'],
      ['gamma', 'delta'],
      ['epsilon', 'zeta'],
    ];

    const results = await Promise.all(groups.map((texts) => svc.translate(texts, 'ja')));

    // 每個 translate 回傳都正確
    for (let i = 0; i < groups.length; i++) {
      for (const text of groups[i]) {
        expect(results[i].translations[text]).toBe(`${text}_translated`);
      }
    }

    // cache 檔為有效 JSON（pendingSave queue 保證不損壞）
    const cache = readCacheFile() as { version: number; entries: Record<string, Record<string, string>> };
    expect(cache.version).toBe(1);
    const cachedValues = Object.values(cache.entries['ja'] ?? {});
    // warmup + 6 = 7 entries（共用 in-memory cache）
    expect(cachedValues.length).toBe(7);
  });

  it('cache persistence：新 instance 讀取前次存檔', async () => {
    mockFetchTranslate();

    // 第一個 instance 翻譯並儲存
    await svc.translate(['persistent'], 'ja');

    // 第二個 instance 讀取 cache
    const fetchMock2 = mockFetchTranslate();
    const svc2 = new TranslationService(SUITE_CACHE_DIR);
    const result = await svc2.translate(['persistent'], 'ja');

    expect(result.translations['persistent']).toBe('persistent_translated');
    expect(fetchMock2).not.toHaveBeenCalled(); // cache hit
  });

  it('API 暫時性失敗後 retry 恢復 → 翻譯成功且 cache 寫入', async () => {
    const sleepSpy = vi.spyOn(
      svc as unknown as { sleep: (ms: number) => Promise<void> },
      'sleep',
    ).mockResolvedValue(undefined);

    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new TypeError('fetch failed'));
      }
      const body = init.body;
      const qMatch = body.match(/q=([^&]+)/);
      const decoded = decodeURIComponent(qMatch?.[1] ?? '');
      const translated = decoded.split('\n').map((line) => {
        const m = line.match(/^\[(\d+)\]\s*(.+)/);
        return m ? `[${m[1]}] ${m[2]}_translated` : line;
      }).join('\n');
      return {
        ok: true,
        json: () => Promise.resolve({
          responseStatus: 200,
          responseData: { translatedText: translated },
        }),
      };
    }));

    const result = await svc.translate(['retry-test'], 'ja');

    expect(result.translations['retry-test']).toBe('retry-test_translated');
    expect(callCount).toBe(2);
    expect(sleepSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalledWith(1000);
    expect(existsSync(CACHE_PATH)).toBe(true);
  });
});
