import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import type { CliService } from './CliService';
import { PLUGINS_CACHE_DIR } from '../constants';

const CACHE_PATH = join(PLUGINS_CACHE_DIR, 'hook-explanations.json');
const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

interface CacheEntry {
  explanation: string;
  locale: string;
  createdAt: string;
}

type CacheFile = Record<string, CacheEntry>;

/**
 * Hook 內容 AI 解釋 service。
 * 以 filePath:mtime:locale（或 hash:0:locale）為 key 持久化快取至 ~/.claude/plugins/cache/hook-explanations.json。
 */
export class HookExplanationService {
  constructor(private readonly cli: CliService) {}

  async explain(hookContent: string, eventType: string, locale: string, filePath?: string): Promise<{ explanation: string; fromCache: boolean }> {
    const cache = await this.readCache();
    const key = await this.cacheKey(hookContent, locale, filePath);
    const cachedEntry = cache[key];

    if (cachedEntry && this.isFresh(cachedEntry)) {
      return { explanation: cachedEntry.explanation, fromCache: true };
    }

    const prompt = `請用 ${locale} 解釋這個在 ${eventType} 時機觸發的 hook 的用途，簡短兩句話：\n${hookContent}`;
    const explanation = (await this.cli.exec(
      [
        '--model', 'sonnet',
        '--print',
        '--system-prompt', 'You are a concise assistant that explains hook scripts.',
        '--no-session-persistence',
        '--settings', '{"disableAllHooks":true}',
        prompt,
      ],
      { timeout: 120_000 },
    )).trim();

    if (!explanation) {
      throw new Error('Hook explanation was empty');
    }

    cache[key] = { explanation, locale, createdAt: new Date().toISOString() };
    await this.writeCache(cache);

    return { explanation, fromCache: false };
  }

  async loadCached(items: ReadonlyArray<{ hookContent: string; locale: string; filePath?: string }>): Promise<Record<string, string>> {
    const cache = await this.readCache();
    const result: Record<string, string> = {};
    for (const item of items) {
      const cacheKey = await this.cacheKey(item.hookContent, item.locale, item.filePath);
      const entry = cache[cacheKey];
      if (entry && this.isFresh(entry)) {
        const uiKey = `${item.filePath ?? item.hookContent}:${item.locale}`;
        result[uiKey] = entry.explanation;
      }
    }
    return result;
  }

  async cleanExpired(): Promise<void> {
    const cache = await this.readCache();
    const cleaned: CacheFile = {};
    for (const [key, entry] of Object.entries(cache)) {
      if (this.isFresh(entry)) {
        cleaned[key] = entry;
      }
    }
    await this.writeCache(cleaned);
  }

  private async cacheKey(hookContent: string, locale: string, filePath?: string): Promise<string> {
    if (filePath) {
      const resolved = filePath.startsWith('~/')
        ? join(homedir(), filePath.slice(2))
        : filePath;
      try {
        const { mtimeMs } = await stat(resolved);
        return `${resolved}:${mtimeMs}:${locale}`;
      } catch {
        // file not accessible, fall through to hash
      }
    }
    const hash = createHash('sha256').update(hookContent).digest('hex').slice(0, 8);
    return `${hash}:0:${locale}`;
  }

  private isFresh(entry: CacheEntry): boolean {
    return Date.now() - new Date(entry.createdAt).getTime() <= CACHE_TTL_MS;
  }

  private async readCache(): Promise<CacheFile> {
    try {
      const raw = await readFile(CACHE_PATH, 'utf-8');
      return JSON.parse(raw) as CacheFile;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw e;
    }
  }

  private async writeCache(cache: CacheFile): Promise<void> {
    await mkdir(PLUGINS_CACHE_DIR, { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  }
}
