import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TranslationService } from '../TranslationService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockMkdir = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 模擬 MyMemory API 成功回應 */
function mockFetchResponse(translatedText: string, apiStatus = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      responseStatus: apiStatus,
      responseData: { translatedText },
    }),
  }));
}

/** 模擬 fetch HTTP 錯誤（非 2xx） */
function mockFetchHttpError(httpStatus: number): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status: httpStatus,
    json: () => Promise.resolve({}),
  }));
}

/** 模擬 fetch 網路錯誤 */
function mockFetchNetworkError(): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
}

/** 從 fetch mock 呼叫中取出 API 傳送的 q 參數 */
function getApiQuery(): string {
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
  const body = fetchMock.mock.calls[0][1]?.body as string;
  const params = new URLSearchParams(body);
  return params.get('q') ?? '';
}

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    vi.clearAllMocks();
    // 預設無 cache 檔案
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    service = new TranslationService();
    // spy sleep to avoid real delays during retry
    vi.spyOn(
      service as unknown as { sleep: (ms: number) => Promise<void> },
      'sleep',
    ).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('translate — 基本行為', () => {
    it('合併多筆 description 為編號行，單一 API 呼叫', async () => {
      mockFetchResponse('[1] 翻譯A\n[2] 翻譯B');

      const { translations } = await service.translate(
        ['Description A', 'Description B'],
        'zh-TW',
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(getApiQuery()).toBe('[1] Description A\n[2] Description B');
      expect(translations).toEqual({
        'Description A': '翻譯A',
        'Description B': '翻譯B',
      });
    });

    it('去重：相同文字只翻譯一次', async () => {
      mockFetchResponse('[1] 翻譯');

      const { translations } = await service.translate(
        ['same text', 'same text', 'same text'],
        'zh-TW',
      );

      expect(getApiQuery()).toBe('[1] same text');
      expect(translations).toEqual({ 'same text': '翻譯' });
    });

    it('空陣列不呼叫 API', async () => {
      mockFetchResponse('unused');

      const { translations } = await service.translate([], 'zh-TW');

      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(translations).toEqual({});
    });
  });

  describe('translate — cache', () => {
    it('已 cache 的文字不再呼叫 API', async () => {
      // 第一次呼叫
      mockFetchResponse('[1] 翻譯A');
      await service.translate(['text A'], 'zh-TW');

      vi.clearAllMocks();
      mockFetchResponse('unused');

      // 第二次呼叫：應該從 cache 讀取
      const { translations } = await service.translate(['text A'], 'zh-TW');

      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(translations).toEqual({ 'text A': '翻譯A' });
    });

    it('不同語言分開 cache', async () => {
      mockFetchResponse('[1] 翻譯A');
      await service.translate(['text'], 'zh-TW');

      vi.clearAllMocks();
      mockFetchResponse('[1] テキスト');

      const { translations } = await service.translate(['text'], 'ja');

      // 不同語言應該呼叫 API
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(translations).toEqual({ text: 'テキスト' });
    });

    it('混合 cached / uncached：只翻譯未 cache 的', async () => {
      mockFetchResponse('[1] 翻譯A');
      await service.translate(['cached text'], 'zh-TW');

      vi.clearAllMocks();
      mockFetchResponse('[1] 翻譯B');

      const { translations } = await service.translate(
        ['cached text', 'new text'],
        'zh-TW',
      );

      // 只翻譯 new text
      expect(getApiQuery()).toBe('[1] new text');
      expect(translations).toEqual({
        'cached text': '翻譯A',
        'new text': '翻譯B',
      });
    });

    it('translate 完成後儲存 cache 檔案', async () => {
      mockFetchResponse('[1] 翻譯');

      await service.translate(['hello'], 'zh-TW');

      expect(mockMkdir).toHaveBeenCalled();
      // writeFile: 僅 1 次存 cache
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const saved = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(saved.version).toBe(1);
      expect(Object.keys(saved.entries['zh-TW']).length).toBe(1);
    });

    it('第二次 saveCache 跳過 mkdir（dirCreated 去重）', async () => {
      mockFetchResponse('[1] 翻譯A');
      await service.translate(['text1'], 'zh-TW');
      expect(mockMkdir).toHaveBeenCalledTimes(1);

      mockMkdir.mockClear();
      mockFetchResponse('[1] 翻譯B');
      await service.translate(['text2'], 'zh-TW');
      expect(mockMkdir).not.toHaveBeenCalled();
    });

    it('載入既有 cache 檔案', async () => {
      const existingCache = {
        version: 1,
        entries: {
          'zh-TW': { '2cf24dba5fb0a30e': '你好世界' },
        },
      };
      mockReadFile.mockResolvedValue(JSON.stringify(existingCache));

      // 建立新的 service 使其重新載入 cache
      const svc = new TranslationService();
      mockFetchResponse('[1] 新翻譯');
      const { translations } = await svc.translate(['other text'], 'zh-TW');

      // 應該只翻譯 other text，不含 cached hello
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(translations).toEqual({ 'other text': '新翻譯' });
    });
  });

  describe('translate — API 回應解析', () => {
    it('API 回傳多餘空白仍能正確解析', async () => {
      mockFetchResponse('[1]  翻譯A \n[2]   翻譯B  ');

      const { translations } = await service.translate(['a', 'b'], 'zh-TW');

      expect(translations).toEqual({ a: '翻譯A', b: '翻譯B' });
    });

    it('API 回傳缺少某編號：該筆為空字串', async () => {
      // 只回傳 [1]，缺 [2]
      mockFetchResponse('[1] 翻譯A');

      const { translations } = await service.translate(['a', 'b'], 'zh-TW');

      expect(translations).toEqual({ a: '翻譯A' });
      // b 沒有翻譯結果（空字串不存入 result）
      expect(translations).not.toHaveProperty('b');
    });
  });

  describe('translate — API 錯誤', () => {
    it('API 網路錯誤時回傳空結果（不 throw）', async () => {
      mockFetchNetworkError();

      const { translations } = await service.translate(['text'], 'zh-TW');
      expect(translations).toEqual({});
    });

    it('API 回傳 429 時回傳 warning 且中斷後續批次', async () => {
      mockFetchResponse('', 429);

      const { translations, warning } = await service.translate(['text'], 'zh-TW');
      expect(translations).toEqual({});
      expect(warning).toContain('per-IP');
    });

    it('MYMEMORY WARNING 假翻譯視為 429、不 cache', async () => {
      const warningText = 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.';
      mockFetchResponse(warningText, 200);

      const { translations, warning } = await service.translate(['text'], 'zh-TW');
      expect(translations).toEqual({});
      expect(warning).toContain('per-IP');

      // 確認沒有 cache 垃圾
      vi.clearAllMocks();
      mockFetchResponse('[1] 正確翻譯');
      const result2 = await service.translate(['text'], 'zh-TW');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(result2.translations).toEqual({ text: '正確翻譯' });
    });

    it('API 回傳非 429 錯誤時無 warning（靜默跳過）', async () => {
      mockFetchResponse('', 500);

      const { translations, warning } = await service.translate(['text'], 'zh-TW');
      expect(translations).toEqual({});
      expect(warning).toBeUndefined();
    });

    it('API HTTP 錯誤（非 2xx）時回傳空結果（不 throw）', async () => {
      mockFetchHttpError(503);

      const { translations } = await service.translate(['text'], 'zh-TW');
      expect(translations).toEqual({});
    });
  });

  describe('translate — 輸入驗證', () => {
    it('非法語言代碼 throw Error', async () => {
      await expect(service.translate(['text'], 'invalid-lang'))
        .rejects.toThrow('Invalid target language: invalid-lang');
    });

    it('注入嘗試 throw Error', async () => {
      await expect(service.translate(['text'], 'zh-TW&de=evil@hack.com'))
        .rejects.toThrow('Invalid target language');
    });
  });

  describe('translate — 子批次部分失敗', () => {
    it('子批次失敗時回傳已成功的部分結果', async () => {
      let callCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              responseStatus: 200,
              responseData: { translatedText: '[1] 翻譯A\n[2] 翻譯B' },
            }),
          });
        }
        return Promise.reject(new Error('network error'));
      }));

      // 產生超過 MAX_CHARS_ANONYMOUS (450) 的文字以觸發多批
      const longText1 = 'A'.repeat(200);
      const longText2 = 'B'.repeat(200);
      const longText3 = 'C'.repeat(200);

      const { translations } = await service.translate([longText1, longText2, longText3], 'zh-TW');

      // 應回傳第一批的部分結果，不 throw
      expect(Object.keys(translations).length).toBeGreaterThan(0);
    });

    it('429 quota 耗盡時 break 不再嘗試後續批次', async () => {
      let callCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            responseStatus: 429,
            responseData: { translatedText: 'QUOTA EXCEEDED' },
          }),
        });
      }));

      const longText1 = 'A'.repeat(200);
      const longText2 = 'B'.repeat(200);
      const longText3 = 'C'.repeat(200);

      const { warning } = await service.translate([longText1, longText2, longText3], 'zh-TW');

      // 429 後 break，只呼叫 1 次 API
      expect(callCount).toBe(1);
      expect(warning).toContain('per-IP');
    });
  });

  describe('callApi — retry + exponential backoff', () => {
    let sleepSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      sleepSpy = vi.spyOn(
        service as unknown as { sleep: (ms: number) => Promise<void> },
        'sleep',
      ).mockResolvedValue(undefined);
    });

    it('503 第一次失敗、第二次成功 → 回傳翻譯結果', async () => {
      let callCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            responseStatus: 200,
            responseData: { translatedText: '[1] 翻譯A' },
          }),
        });
      }));

      const { translations } = await service.translate(['text A'], 'zh-TW');

      expect(callCount).toBe(2);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      expect(sleepSpy).toHaveBeenCalledWith(1000);
      expect(translations).toEqual({ 'text A': '翻譯A' });
    });

    it('連續 4 次 timeout → 最終 fallback 空結果', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
        Object.assign(new Error('signal timed out'), { name: 'TimeoutError' }),
      ));

      const { translations } = await service.translate(['text'], 'zh-TW');

      expect((globalThis.fetch as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(4);
      expect(sleepSpy).toHaveBeenCalledTimes(3);
      expect(sleepSpy.mock.calls.map((c) => c[0])).toEqual([1000, 2000, 4000]);
      expect(translations).toEqual({});
    });

    it('network error（TypeError）→ retry 後成功', async () => {
      let callCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new TypeError('fetch failed'));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            responseStatus: 200,
            responseData: { translatedText: '[1] 翻譯' },
          }),
        });
      }));

      const { translations } = await service.translate(['text'], 'zh-TW');

      expect(callCount).toBe(2);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      expect(translations).toEqual({ text: '翻譯' });
    });

    it('HTTP 429 → 不 retry', async () => {
      mockFetchHttpError(429);

      const { translations, warning } = await service.translate(['text'], 'zh-TW');

      expect((globalThis.fetch as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect(sleepSpy).not.toHaveBeenCalled();
      expect(translations).toEqual({});
      expect(warning).toContain('per-IP');
    });

    it('HTTP 400 → 不 retry', async () => {
      mockFetchHttpError(400);

      const { translations } = await service.translate(['text'], 'zh-TW');

      expect((globalThis.fetch as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect(sleepSpy).not.toHaveBeenCalled();
      expect(translations).toEqual({});
    });

    it('API responseStatus 429（body 內）→ 不 retry', async () => {
      mockFetchResponse('', 429);

      const { translations, warning } = await service.translate(['text'], 'zh-TW');

      expect((globalThis.fetch as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
      expect(sleepSpy).not.toHaveBeenCalled();
      expect(translations).toEqual({});
      expect(warning).toContain('per-IP');
    });

    it('API responseStatus 500（body 內）→ retry 後成功', async () => {
      let callCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ responseStatus: 500 }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            responseStatus: 200,
            responseData: { translatedText: '[1] 翻譯' },
          }),
        });
      }));

      const { translations } = await service.translate(['text'], 'zh-TW');

      expect(callCount).toBe(2);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      expect(translations).toEqual({ text: '翻譯' });
    });

    it('指數退避間隔正確：1s → 2s → 4s', async () => {
      mockFetchHttpError(503);

      await service.translate(['text'], 'zh-TW');

      expect(sleepSpy).toHaveBeenCalledTimes(3);
      expect(sleepSpy.mock.calls.map((c) => c[0])).toEqual([1000, 2000, 4000]);
    });
  });
});
