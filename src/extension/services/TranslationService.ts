import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import https from 'https';
import { TRANSLATE_LANGS } from '../../shared/types';

/** 翻譯 cache 目錄 */
const CACHE_DIR = join(homedir(), '.claude', 'plugins', '.cache');

/** MyMemory API timeout（毫秒） */
const API_TIMEOUT_MS = 15_000;

/** 匿名呼叫字元上限（MyMemory 無 email 每日限制較低） */
const MAX_CHARS_ANONYMOUS = 450;

/** 附 email 呼叫字元上限（MyMemory 附 email 上限 10K，留餘裕用 4K） */
const MAX_CHARS_WITH_EMAIL = 4000;

/** Cache 檔案結構 */
interface TranslationCache {
  version: 1;
  entries: Record<string, Record<string, string>>;
  // entries[targetLang][hash] = translated
}

/** translate() 回傳結構 */
export interface TranslateResult {
  translations: Record<string, string>;
  /** API quota 耗盡等警告訊息 */
  warning?: string;
}

/**
 * Plugin description 翻譯服務。
 * 使用 MyMemory API，將多筆 description 以編號行合併成單一 request。
 */
export class TranslationService {
  private cache: TranslationCache | null = null;
  private pendingSave: Promise<void> = Promise.resolve();

  /**
   * 批次翻譯。回傳 translations map + 可選 warning。
   * 已 cache 的直接回傳，未 cache 的合併成單次 API 呼叫。
   */
  async translate(
    texts: string[],
    targetLang: string,
    email?: string,
  ): Promise<TranslateResult> {
    if (!(targetLang in TRANSLATE_LANGS)) {
      throw new Error(`Invalid target language: ${targetLang}`);
    }

    const cache = await this.loadCache();
    const langCache = cache.entries[targetLang] ??= {};

    const translations: Record<string, string> = {};
    const uncached: Array<{ text: string; hash: string }> = [];

    // 分離已 cache / 未 cache
    const unique = [...new Set(texts)];
    for (const text of unique) {
      const hash = this.hash(text);
      if (langCache[hash]) {
        translations[text] = langCache[hash];
      } else {
        uncached.push({ text, hash });
      }
    }

    if (uncached.length === 0) return { translations };

    // 按字元上限分批（附 email 額度較高）
    const maxChars = email ? MAX_CHARS_WITH_EMAIL : MAX_CHARS_ANONYMOUS;
    const batches = this.buildBatches(uncached.map((u) => u.text), maxChars);

    let warning: string | undefined;

    for (const batch of batches) {
      try {
        const translated = await this.callApiBatch(batch, targetLang, email);
        for (let i = 0; i < batch.length; i++) {
          const original = batch[i];
          const trans = translated[i];
          if (trans) {
            const hash = this.hash(original);
            langCache[hash] = trans;
            translations[original] = trans;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('429')) {
          warning = 'Daily translation quota exceeded. Remaining texts will use cache when available.';
          break; // 429 = 今日額度用完，不必再試
        }
        // 其他錯誤：子批次失敗不影響其他批次
      }
    }

    await this.saveCache(cache);
    return { translations, warning };
  }

  /**
   * 將多筆文字以編號行合併成單一 API 呼叫，回來再拆。
   * 格式：`[1] text1\n[2] text2\n...`
   */
  private async callApiBatch(
    texts: string[],
    targetLang: string,
    email?: string,
  ): Promise<string[]> {
    // 組合編號行
    const numbered = texts
      .map((t, i) => `[${i + 1}] ${t.replace(/\n/g, ' ')}`)
      .join('\n');

    const raw = await this.callApi(numbered, targetLang, email);

    // 解析回傳：`[1] 翻譯1\n[2] 翻譯2`
    const parsed = new Map<number, string>();
    for (const line of raw.split('\n')) {
      const match = line.match(/^\[(\d+)\]\s*(.+)/);
      if (match) {
        parsed.set(Number(match[1]), match[2].trim());
      }
    }

    return texts.map((_, i) => parsed.get(i + 1) ?? '');
  }

  /** 按字元上限將文字分批 */
  private buildBatches(texts: string[], maxChars: number): string[][] {
    const batches: string[][] = [];
    let current: string[] = [];
    let currentLen = 0;

    for (const text of texts) {
      // 每行格式 `[N] text\n`，預估長度
      const lineLen = text.length + 10;
      if (current.length > 0 && currentLen + lineLen > maxChars) {
        batches.push(current);
        current = [];
        currentLen = 0;
      }
      current.push(text);
      currentLen += lineLen;
    }
    if (current.length > 0) batches.push(current);
    return batches;
  }

  /** 呼叫 MyMemory 翻譯 API（POST 避免 URL 長度限制） */
  private callApi(text: string, targetLang: string, email?: string): Promise<string> {
    let postData = `q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;
    if (email) postData += `&de=${encodeURIComponent(email)}`;

    return new Promise((resolve, reject) => {
      const req = https.request(
        'https://api.mymemory.translated.net/get',
        {
          method: 'POST',
          timeout: API_TIMEOUT_MS,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            try {
              const json = JSON.parse(data) as {
                responseStatus: number;
                responseData?: { translatedText?: string };
              };
              if (json.responseStatus === 200 && json.responseData?.translatedText) {
                resolve(json.responseData.translatedText);
              } else {
                reject(new Error(`API status: ${json.responseStatus}`));
              }
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.write(postData);
      req.end();
    });
  }

  /** SHA-256 hash（前 16 字元） */
  private hash(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }

  /** 載入 cache */
  private async loadCache(): Promise<TranslationCache> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.cachePath(), 'utf-8');
      this.cache = JSON.parse(raw) as TranslationCache;
    } catch {
      this.cache = { version: 1, entries: {} };
    }
    return this.cache;
  }

  /** 儲存 cache（排隊寫入，避免並發損壞檔案） */
  private saveCache(cache: TranslationCache): Promise<void> {
    this.pendingSave = this.pendingSave.then(async () => {
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(this.cachePath(), JSON.stringify(cache, null, 2));
    }).catch(() => { /* 寫入失敗不影響主流程 */ });
    return this.pendingSave;
  }

  /** Cache 檔案路徑 */
  private cachePath(): string {
    return join(CACHE_DIR, 'translations.json');
  }
}
