import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildSkillRegistryUrl,
  parseSkillRegistryHtml,
  readSkillRegistryCache,
  writeSkillRegistryCache,
} from '../skillRegistrySupport';
import { SKILL_REGISTRY_URL } from '../../constants';
import { WriteQueue } from '../../utils/WriteQueue';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { readFile, writeFile, mkdir } from 'fs/promises';

describe('skillRegistrySupport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSkillRegistryUrl', () => {
    it('sort=all-time 時不加 path segment', () => {
      const url = buildSkillRegistryUrl('all-time');
      expect(url).toBe(`${SKILL_REGISTRY_URL}/`);
    });

    it('sort=trending 時加 /trending', () => {
      const url = buildSkillRegistryUrl('trending');
      expect(url).toBe(`${SKILL_REGISTRY_URL}/trending`);
    });

    it('sort=hot 時加 /hot', () => {
      const url = buildSkillRegistryUrl('hot');
      expect(url).toBe(`${SKILL_REGISTRY_URL}/hot`);
    });

    it('有 query 時加 ?q=...', () => {
      const url = buildSkillRegistryUrl('trending', 'search term');
      expect(url).toBe(`${SKILL_REGISTRY_URL}/trending?q=search%20term`);
    });

    it('query 含特殊字元時正確 encode', () => {
      const url = buildSkillRegistryUrl('all-time', 'a&b=c');
      expect(url).toBe(`${SKILL_REGISTRY_URL}/?q=a%26b%3Dc`);
    });
  });

  describe('parseSkillRegistryHtml', () => {
    const createMockHtml = (skills: Array<{ source: string; skillId: string; name: string; installs: number }>) => {
      const escaped = JSON.stringify(skills).replace(/"/g, '\\"');
      return `<html><script>self.__next_f.push([1,"\\"initialSkills\\":${escaped}\\n"])</script></html>`;
    };

    it('正常解析 RSC payload', () => {
      const html = createMockHtml([
        { source: 'user/repo', skillId: 'skill-1', name: 'My Skill', installs: 100 },
      ]);

      const result = parseSkillRegistryHtml(html);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        rank: 1,
        name: 'My Skill',
        repo: 'user/repo',
        installs: '100',
        url: `${SKILL_REGISTRY_URL}/user/repo/skill-1`,
      });
    });

    it('多個 skill 正確排序 rank', () => {
      const html = createMockHtml([
        { source: 'a/b', skillId: 's1', name: 'First', installs: 1000 },
        { source: 'c/d', skillId: 's2', name: 'Second', installs: 500 },
      ]);

      const result = parseSkillRegistryHtml(html);

      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });

    it('installs >= 1000 顯示為 K', () => {
      const html = createMockHtml([
        { source: 'a/b', skillId: 's1', name: 'Test', installs: 1500 },
      ]);

      const result = parseSkillRegistryHtml(html);

      expect(result[0].installs).toBe('1.5K');
    });

    it('installs >= 1000000 顯示為 M', () => {
      const html = createMockHtml([
        { source: 'a/b', skillId: 's1', name: 'Test', installs: 2500000 },
      ]);

      const result = parseSkillRegistryHtml(html);

      expect(result[0].installs).toBe('2.5M');
    });

    it('initialSkills 不存在時拋錯', () => {
      const html = '<html><body>No skills here</body></html>';

      expect(() => parseSkillRegistryHtml(html)).toThrow(
        'Failed to parse skills.sh: initialSkills not found in HTML',
      );
    });

    it('陣列格式損壞時拋錯', () => {
      // 沒有正確結尾的陣列
      const html = '<html><script>self.__next_f.push([1,"\\"initialSkills\\":[{broken"])</script></html>';

      expect(() => parseSkillRegistryHtml(html)).toThrow();
    });
  });

  describe('readSkillRegistryCache', () => {
    it('cache 存在且未過期時回傳資料', async () => {
      const cached = {
        'weekly:': {
          data: [{ rank: 1, name: 'Test', repo: 'a/b', installs: '100', url: 'http://...' }],
          timestamp: Date.now() - 1000, // 1 秒前
        },
      };
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(cached));

      const result = await readSkillRegistryCache('/cache/path', 'weekly:');

      expect(result).toEqual(cached['weekly:'].data);
    });

    it('cache 過期時回傳 null', async () => {
      const cached = {
        'weekly:': {
          data: [{ rank: 1, name: 'Test', repo: 'a/b', installs: '100', url: 'http://...' }],
          timestamp: Date.now() - 5 * 60 * 60 * 1000, // 5 小時前（超過 4 小時 TTL）
        },
      };
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(cached));

      const result = await readSkillRegistryCache('/cache/path', 'weekly:');

      expect(result).toBeNull();
    });

    it('cache key 不存在時回傳 null', async () => {
      const cached = { 'other-key': { data: [], timestamp: Date.now() } };
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(cached));

      const result = await readSkillRegistryCache('/cache/path', 'weekly:');

      expect(result).toBeNull();
    });

    it('檔案不存在時回傳 null', async () => {
      vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT'));

      const result = await readSkillRegistryCache('/cache/path', 'weekly:');

      expect(result).toBeNull();
    });
  });

  describe('writeSkillRegistryCache', () => {
    it('寫入新 cache entry', async () => {
      vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT')); // 檔案不存在
      const queue = new WriteQueue();
      const data = [{ rank: 1, name: 'Test', repo: 'a/b', installs: '100', url: 'http://...' }];

      await writeSkillRegistryCache('/cache/registry.json', queue, 'weekly:', data as never);

      expect(mkdir).toHaveBeenCalledWith('/cache', { recursive: true });
      expect(writeFile).toHaveBeenCalled();
      const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
      expect(written['weekly:'].data).toEqual(data);
      expect(written['weekly:'].timestamp).toBeGreaterThan(0);
    });

    it('合併現有 cache entries', async () => {
      const existing = {
        'monthly:': { data: [{ name: 'Old' }], timestamp: 123 },
      };
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(existing));
      const queue = new WriteQueue();
      const data = [{ rank: 1, name: 'New', repo: 'a/b', installs: '100', url: 'http://...' }];

      await writeSkillRegistryCache('/cache/registry.json', queue, 'weekly:', data as never);

      const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
      expect(written['monthly:']).toEqual(existing['monthly:']);
      expect(written['weekly:'].data).toEqual(data);
    });
  });
});
