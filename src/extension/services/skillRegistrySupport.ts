import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import type { RegistrySkill, RegistrySort } from '../../shared/types';
import { SKILL_REGISTRY_URL } from '../constants';
import { WriteQueue } from '../utils/WriteQueue';

const REGISTRY_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

interface RegistryCacheEntry {
  data: RegistrySkill[];
  timestamp: number;
}

interface RegistryCacheFile {
  [cacheKey: string]: RegistryCacheEntry;
}

export function buildSkillRegistryUrl(sort: RegistrySort, query?: string): string {
  const encodedQuery = query ? `?q=${encodeURIComponent(query)}` : '';
  if (sort === 'all-time') {
    return `${SKILL_REGISTRY_URL}/${encodedQuery}`;
  }
  return `${SKILL_REGISTRY_URL}/${sort}${encodedQuery}`;
}

export function parseSkillRegistryHtml(html: string): RegistrySkill[] {
  // Next.js RSC 將資料嵌入 __next_f.push([1,"..."]) 的 JS 字串中，
  // 雙引號被 escape 為 \"，因此 key 格式為 \"initialSkills\":[...]
  const match = /\\"initialSkills\\":([\s\S]*)/.exec(html);
  if (!match) {
    throw new Error(
      'Failed to parse skills.sh: initialSkills not found in HTML. The page structure may have changed.',
    );
  }

  // 以 balanced brackets 找到陣列結尾（陣列內容同樣是 escaped JSON）
  const raw = match[1];
  const arrayEndIndex = findBalancedArrayEnd(raw);
  if (arrayEndIndex === 0) {
    throw new Error('Failed to parse skills.sh: initialSkills array is malformed.');
  }

  const jsonStr = raw.slice(0, arrayEndIndex).replace(/\\(["\\/bfnrt])/g, (_, ch: string) => {
    const escapeMap: Record<string, string> = {
      '"': '"', '\\': '\\', '/': '/', 'b': '\b', 'f': '\f', 'n': '\n', 'r': '\r', 't': '\t',
    };
    return escapeMap[ch] ?? ch;
  });
  const items = JSON.parse(jsonStr) as Array<{
    source: string;
    skillId: string;
    name: string;
    installs: number;
  }>;

  return items.map((item, index) => ({
    rank: index + 1,
    name: item.name,
    repo: item.source,
    installs: formatInstalls(item.installs),
    url: `${SKILL_REGISTRY_URL}/${item.source}/${item.skillId}`,
  }));
}

export async function readSkillRegistryCache(
  registryCachePath: string,
  key: string,
): Promise<RegistrySkill[] | null> {
  try {
    const raw = await readFile(registryCachePath, 'utf-8');
    const cache = JSON.parse(raw) as RegistryCacheFile;
    const entry = cache[key];
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.timestamp > REGISTRY_CACHE_TTL_MS) {
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function writeSkillRegistryCache(
  registryCachePath: string,
  registryCacheWriteQueue: WriteQueue,
  key: string,
  data: RegistrySkill[],
): Promise<void> {
  return registryCacheWriteQueue.enqueue(async () => {
    try {
      await mkdir(dirname(registryCachePath), { recursive: true });
      let cache: RegistryCacheFile = {};
      try {
        cache = JSON.parse(await readFile(registryCachePath, 'utf-8')) as RegistryCacheFile;
      } catch {
        // 檔案不存在或損毀，從空物件開始
      }
      cache[key] = { data, timestamp: Date.now() };
      await writeFile(registryCachePath, JSON.stringify(cache), 'utf-8');
    } catch {
      // cache 寫入失敗不影響主流程
    }
  });
}

function findBalancedArrayEnd(raw: string): number {
  let depth = 0;

  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '[') {
      depth++;
    } else if (raw[i] === ']') {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
    }
  }

  return 0;
}

function formatInstalls(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}
