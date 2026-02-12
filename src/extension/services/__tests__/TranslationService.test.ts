import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationService } from '../TranslationService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockMkdir = vi.hoisted(() => vi.fn());
const mockHttpsRequest = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
}));

vi.mock('https', () => ({
  default: { request: mockHttpsRequest },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 模擬 MyMemory API 回應 */
function mockApiResponse(translatedText: string, status = 200): void {
  mockHttpsRequest.mockImplementation((_url: string, _opts: unknown, cb: (res: unknown) => void) => {
    const res = {
      on: (event: string, handler: (data?: Buffer) => void) => {
        if (event === 'data') {
          handler(Buffer.from(JSON.stringify({
            responseStatus: status,
            responseData: { translatedText },
          })));
        }
        if (event === 'end') handler();
      },
    };
    cb(res);
    return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
  });
}

/** 從 mock 呼叫中取出 API 傳送的 q 參數 */
function getApiQuery(): string {
  const req = mockHttpsRequest.mock.results[0]?.value as { write: ReturnType<typeof vi.fn> };
  const postData = req.write.mock.calls[0][0] as string;
  const params = new URLSearchParams(postData);
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
  });

  describe('translate — 基本行為', () => {
    it('合併多筆 description 為編號行，單一 API 呼叫', async () => {
      mockApiResponse('[1] 翻譯A\n[2] 翻譯B');

      const { translations } = await service.translate(
        ['Description A', 'Description B'],
        'zh-TW',
      );

      expect(mockHttpsRequest).toHaveBeenCalledTimes(1);
      expect(getApiQuery()).toBe('[1] Description A\n[2] Description B');
      expect(translations).toEqual({
        'Description A': '翻譯A',
        'Description B': '翻譯B',
      });
    });

    it('去重：相同文字只翻譯一次', async () => {
      mockApiResponse('[1] 翻譯');

      const { translations } = await service.translate(
        ['same text', 'same text', 'same text'],
        'zh-TW',
      );

      expect(getApiQuery()).toBe('[1] same text');
      expect(translations).toEqual({ 'same text': '翻譯' });
    });

    it('空陣列不呼叫 API', async () => {
      const { translations } = await service.translate([], 'zh-TW');

      expect(mockHttpsRequest).not.toHaveBeenCalled();
      expect(translations).toEqual({});
    });
  });

  describe('translate — cache', () => {
    it('已 cache 的文字不再呼叫 API', async () => {
      // 第一次呼叫
      mockApiResponse('[1] 翻譯A');
      await service.translate(['text A'], 'zh-TW');

      vi.clearAllMocks();

      // 第二次呼叫：應該從 cache 讀取
      const { translations } = await service.translate(['text A'], 'zh-TW');

      expect(mockHttpsRequest).not.toHaveBeenCalled();
      expect(translations).toEqual({ 'text A': '翻譯A' });
    });

    it('不同語言分開 cache', async () => {
      mockApiResponse('[1] 翻譯A');
      await service.translate(['text'], 'zh-TW');

      vi.clearAllMocks();
      mockApiResponse('[1] テキスト');

      const { translations } = await service.translate(['text'], 'ja');

      // 不同語言應該呼叫 API
      expect(mockHttpsRequest).toHaveBeenCalledTimes(1);
      expect(translations).toEqual({ text: 'テキスト' });
    });

    it('混合 cached / uncached：只翻譯未 cache 的', async () => {
      mockApiResponse('[1] 翻譯A');
      await service.translate(['cached text'], 'zh-TW');

      vi.clearAllMocks();
      mockApiResponse('[1] 翻譯B');

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
      mockApiResponse('[1] 翻譯');

      await service.translate(['hello'], 'zh-TW');

      expect(mockMkdir).toHaveBeenCalled();
      // writeFile: 僅 1 次存 cache
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const saved = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(saved.version).toBe(1);
      expect(Object.keys(saved.entries['zh-TW']).length).toBe(1);
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
      // hash('hello') 的前 16 字元
      mockApiResponse('[1] 新翻譯');
      const { translations } = await svc.translate(['other text'], 'zh-TW');

      // 應該只翻譯 other text，不含 cached hello
      expect(mockHttpsRequest).toHaveBeenCalledTimes(1);
      expect(translations).toEqual({ 'other text': '新翻譯' });
    });
  });

  describe('translate — API 回應解析', () => {
    it('API 回傳多餘空白仍能正確解析', async () => {
      mockApiResponse('[1]  翻譯A \n[2]   翻譯B  ');

      const { translations } = await service.translate(['a', 'b'], 'zh-TW');

      expect(translations).toEqual({ a: '翻譯A', b: '翻譯B' });
    });

    it('API 回傳缺少某編號：該筆為空字串', async () => {
      // 只回傳 [1]，缺 [2]
      mockApiResponse('[1] 翻譯A');

      const { translations } = await service.translate(['a', 'b'], 'zh-TW');

      expect(translations).toEqual({ a: '翻譯A' });
      // b 沒有翻譯結果（空字串不存入 result）
      expect(translations).not.toHaveProperty('b');
    });
  });

  describe('translate — API 錯誤', () => {
    it('API 網路錯誤時回傳空結果（不 throw）', async () => {
      mockHttpsRequest.mockImplementation((_url: string, _opts: unknown, _cb: unknown) => {
        return {
          on: (event: string, handler: (err: Error) => void) => {
            if (event === 'error') handler(new Error('network error'));
          },
        };
      });

      const { translations } = await service.translate(['text'], 'zh-TW');
      expect(translations).toEqual({});
    });

    it('API 回傳 429 時回傳 warning 且中斷後續批次', async () => {
      mockApiResponse('', 429);

      const { translations, warning } = await service.translate(['text'], 'zh-TW');
      expect(translations).toEqual({});
      expect(warning).toContain('quota exceeded');
    });

    it('API 回傳非 429 錯誤時無 warning（靜默跳過）', async () => {
      mockApiResponse('', 500);

      const { translations, warning } = await service.translate(['text'], 'zh-TW');
      expect(translations).toEqual({});
      expect(warning).toBeUndefined();
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
      mockHttpsRequest.mockImplementation((_url: string, _opts: unknown, cb: (res: unknown) => void) => {
        callCount++;
        if (callCount === 1) {
          // 第一批成功
          const res = {
            on: (event: string, handler: (data?: Buffer) => void) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({
                  responseStatus: 200,
                  responseData: { translatedText: '[1] 翻譯A\n[2] 翻譯B' },
                })));
              }
              if (event === 'end') handler();
            },
          };
          cb(res);
          return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
        } else {
          // 第二批網路錯誤
          return {
            on: (event: string, handler: (err: Error) => void) => {
              if (event === 'error') handler(new Error('network error'));
            },
            write: vi.fn(),
            end: vi.fn(),
          };
        }
      });

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
      mockHttpsRequest.mockImplementation((_url: string, _opts: unknown, cb: (res: unknown) => void) => {
        callCount++;
        const res = {
          on: (event: string, handler: (data?: Buffer) => void) => {
            if (event === 'data') {
              handler(Buffer.from(JSON.stringify({
                responseStatus: 429,
                responseData: { translatedText: 'QUOTA EXCEEDED' },
              })));
            }
            if (event === 'end') handler();
          },
        };
        cb(res);
        return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
      });

      const longText1 = 'A'.repeat(200);
      const longText2 = 'B'.repeat(200);
      const longText3 = 'C'.repeat(200);

      const { warning } = await service.translate([longText1, longText2, longText3], 'zh-TW');

      // 429 後 break，只呼叫 1 次 API
      expect(callCount).toBe(1);
      expect(warning).toContain('quota exceeded');
    });
  });
});
