import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  mockSpawn, mockExistsSync, mockReaddirSync,
  mockReadFile, mockWriteFile, mockMkdir,
  realReadFileSync, realWriteFileSync, realMkdirSync, realMkdtempSync,
} = vi.hoisted(() => {
  // Capture the real fs functions BEFORE the mock replaces them
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const realFs = require('fs') as typeof import('fs');
  return {
    mockSpawn: vi.fn(),
    mockExistsSync: vi.fn(),
    mockReaddirSync: vi.fn(),
    mockReadFile: vi.fn(),
    mockWriteFile: vi.fn(),
    mockMkdir: vi.fn(),
    realReadFileSync: realFs.readFileSync,
    realWriteFileSync: realFs.writeFileSync,
    realMkdirSync: realFs.mkdirSync,
    realMkdtempSync: realFs.mkdtempSync,
  };
});

vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
  };
});

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
}));

vi.mock('../../utils/workspace', () => ({
  getWorkspacePath: () => '/mock/workspace',
}));

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

interface MockChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  killed?: boolean;
}

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = vi.fn(() => {
    child.killed = true;
    child.emit('close', 143, 'SIGTERM');
    return true;
  });
  return child;
}

function mockCliSuccess(stdout: string): void {
  mockSpawn.mockImplementation(() => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.stdout.emit('data', Buffer.from(stdout));
      child.emit('close', 0, null);
    });
    return child;
  });
}

function mockCliFailure(exitCode: number, stderr: string): void {
  mockSpawn.mockImplementation(() => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', exitCode, null);
    });
    return child;
  });
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const SAMPLE_LIST_JSON = JSON.stringify([
  { name: 'my-skill', path: '/home/user/.claude/skills/my-skill', scope: 'global', agents: ['Claude Code'] },
  { name: 'test-skill', path: '/project/.claude/skills/test-skill', scope: 'project', agents: ['Claude Code', 'Cursor'] },
]);

const SAMPLE_FIND_OUTPUT = [
  '\x1b[38;5;145m\x1b[1m   _____ _    _ _ _       \x1b[0m',
  '\x1b[38;5;145m\x1b[1m  / ____| |  (_) | |      \x1b[0m',
  '\x1b[38;5;145m\x1b[1m | (___ | | ___| | |___   \x1b[0m',
  '\x1b[38;5;145m\x1b[1m  \\___ \\| |/ / | | / __|  \x1b[0m',
  '\x1b[38;5;145m\x1b[1m  ____) |   <| | | \\__ \\  \x1b[0m',
  '\x1b[38;5;145m\x1b[1m |_____/|_|\\_\\_|_|_|___/  \x1b[0m',
  '',
  '  Install with: npx skills add owner/repo',
  '',
  '\x1b[38;5;145mvercel-labs/skills@find-skills\x1b[0m \x1b[36m618.0K installs\x1b[0m',
  '\x1b[38;5;102m└ https://skills.sh/vercel-labs/skills/find-skills\x1b[0m',
  '',
  '\x1b[38;5;145mowner/repo@test-skill\x1b[0m \x1b[36m7.7K installs\x1b[0m',
  '\x1b[38;5;102m└ https://skills.sh/owner/repo/test-skill\x1b[0m',
].join('\n');

const SAMPLE_FIND_EMPTY = [
  '\x1b[38;5;145m\x1b[1m   _____ _    _ _ _       \x1b[0m',
  '\x1b[38;5;145m\x1b[1m  / ____| |  (_) | |      \x1b[0m',
  '\x1b[38;5;145m\x1b[1m | (___ | | ___| | |___   \x1b[0m',
  '\x1b[38;5;145m\x1b[1m  \\___ \\| |/ / | | / __|  \x1b[0m',
  '\x1b[38;5;145m\x1b[1m  ____) |   <| | | \\__ \\  \x1b[0m',
  '\x1b[38;5;145m\x1b[1m |_____/|_|\\_\\_|_|_|___/  \x1b[0m',
  '',
  'No skills found for "nonexistent"',
].join('\n');

const SAMPLE_SKILL_MD = `---
name: test-skill
description: A test skill for testing
model: sonnet
allowed-tools: Read, Write, Bash
---

# Test Skill

This is the body of the skill.
`;

// 真實 HTML 格式：Next.js RSC 將資料嵌入 JS 字串，雙引號 escape 為 \"
// 格式：self.__next_f.push([1,"...\"initialSkills\":[{\"source\":\"...\"}]..."])
const SAMPLE_REGISTRY_HTML = `<!DOCTYPE html><html><head></head><body>
<script>self.__next_f.push([1,"17:[\\"$\\",\\"$L1f\\",null,{\\"initialSkills\\":[{\\"source\\":\\"vercel-labs/skills\\",\\"skillId\\":\\"find-skills\\",\\"name\\":\\"find-skills\\",\\"installs\\":618000},{\\"source\\":\\"owner/repo\\",\\"skillId\\":\\"test-skill\\",\\"name\\":\\"test-skill\\",\\"installs\\":7700}],\\"otherProp\\":true}]"])</script>
</body></html>`;

const SAMPLE_REGISTRY_EMPTY_HTML = `<!DOCTYPE html><html><head></head><body>
<script>self.__next_f.push([1,"17:[\\"$\\",\\"$L1f\\",null,{\\"initialSkills\\":[],\\"otherProp\\":true}]"])</script>
</body></html>`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillService', () => {
  let service: InstanceType<typeof import('../SkillService').SkillService>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: npx found at /opt/homebrew/bin/npx
    mockExistsSync.mockImplementation((p: string) => p === '/opt/homebrew/bin/npx');
    mockReaddirSync.mockImplementation(() => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); });

    // readFile (async): pass through for real files (SKILL.md), reject ENOENT for cache file (simulate no cache)
    mockReadFile.mockImplementation((path: unknown, ...rest: unknown[]) => {
      const p = String(path);
      if (p.includes('skill-registry.json')) {
        return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      }
      return Promise.resolve((realReadFileSync as (...args: unknown[]) => unknown)(path, ...rest));
    });
    // writeFile + mkdir (async): no-op (don't write cache to real disk during tests)
    mockWriteFile.mockImplementation(() => Promise.resolve());
    mockMkdir.mockImplementation(() => Promise.resolve());

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Dynamic import to pick up mocks
    const mod = await import('../SkillService');
    service = new mod.SkillService('/tmp/test-cache');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // npx 路徑搜尋
  // -------------------------------------------------------------------------

  describe('npx 路徑搜尋', () => {
    it('NVM 最新版優先（semver 排序）', async () => {
      mockReaddirSync.mockReturnValue(['v18.20.1', 'v24.9.0', 'v20.15.0', 'v23.0.0']);
      mockExistsSync.mockImplementation((p: string) =>
        p.includes('.nvm') || p === '/opt/homebrew/bin/npx',
      );

      mockCliSuccess(JSON.stringify([]));
      await service.list('global');

      const spawnPath = mockSpawn.mock.calls[0][0] as string;
      expect(spawnPath).toContain('v24.9.0');
      expect(spawnPath).toMatch(/\.nvm\/versions\/node\/v24\.9\.0\/bin\/npx$/);
    });

    it('NVM 不存在 → fallback /opt/homebrew/bin/npx', async () => {
      mockReaddirSync.mockImplementation(() => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); });
      mockExistsSync.mockImplementation((p: string) => p === '/opt/homebrew/bin/npx');

      mockCliSuccess(JSON.stringify([]));
      await service.list('global');

      expect(mockSpawn.mock.calls[0][0]).toBe('/opt/homebrew/bin/npx');
    });

    it('所有候選都不存在 → fallback npx', async () => {
      mockReaddirSync.mockImplementation(() => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); });
      mockExistsSync.mockReturnValue(false);

      mockCliSuccess(JSON.stringify([]));
      await service.list('global');

      expect(mockSpawn.mock.calls[0][0]).toBe('npx');
    });

    it('解析後快取，第二次不重新搜尋', async () => {
      mockExistsSync.mockImplementation((p: string) => p === '/opt/homebrew/bin/npx');

      mockCliSuccess(JSON.stringify([]));
      await service.list('global');
      await service.list('global');

      // readdirSync 只在第一次解析時被呼叫
      const readdirCallCount = mockReaddirSync.mock.calls.length;
      expect(readdirCallCount).toBeLessThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // list()
  // -------------------------------------------------------------------------

  describe('list()', () => {
    it('global scope → --global flag，解析為 AgentSkill[]', async () => {
      mockCliSuccess(SAMPLE_LIST_JSON);
      const result = await service.list('global');

      expect(mockSpawn.mock.calls[0][1]).toEqual(['skills', 'list', '--json', '--global']);
      expect(result).toEqual([
        { name: 'my-skill', path: '/home/user/.claude/skills/my-skill', scope: 'global', agents: ['Claude Code'] },
        { name: 'test-skill', path: '/project/.claude/skills/test-skill', scope: 'project', agents: ['Claude Code', 'Cursor'] },
      ]);
    });

    it('project scope → 不帶 --global，帶 cwd', async () => {
      mockCliSuccess(JSON.stringify([]));
      await service.list('project');

      expect(mockSpawn.mock.calls[0][1]).toEqual(['skills', 'list', '--json']);
      const options = mockSpawn.mock.calls[0][2] as { cwd?: string };
      expect(options.cwd).toBe('/mock/workspace');
    });

    it('空結果 → 回傳 []', async () => {
      mockCliSuccess('[]');
      const result = await service.list('global');
      expect(result).toEqual([]);
    });

    it('非 JSON stdout → 拋錯', async () => {
      mockCliSuccess('not valid json');
      await expect(service.list('global')).rejects.toThrow();
    });

    it('無 scope → 合併 global + project，project 優先去重', async () => {
      const globalSkills = [
        { name: 'shared-skill', path: '/global/shared-skill', scope: 'global', agents: ['Claude Code'] },
        { name: 'global-only', path: '/global/global-only', scope: 'global', agents: ['Claude Code'] },
      ];
      const projectSkills = [
        { name: 'shared-skill', path: '/project/shared-skill', scope: 'project', agents: ['Claude Code', 'Cursor'] },
        { name: 'project-only', path: '/project/project-only', scope: 'project', agents: ['Claude Code'] },
      ];

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        const child = createMockChild();
        queueMicrotask(() => {
          callCount++;
          // 第 1 次 = global（帶 --global），第 2 次 = project（帶 cwd）
          const data = callCount === 1 ? globalSkills : projectSkills;
          child.stdout.emit('data', Buffer.from(JSON.stringify(data)));
          child.emit('close', 0, null);
        });
        return child;
      });

      const result = await service.list();

      // 合併後 shared-skill 應為 project 版本
      expect(result).toHaveLength(3);
      expect(result.find(s => s.name === 'shared-skill')?.scope).toBe('project');
      expect(result.find(s => s.name === 'global-only')).toBeDefined();
      expect(result.find(s => s.name === 'project-only')).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // add()
  // -------------------------------------------------------------------------

  describe('add()', () => {
    it('global scope → --yes --all --global', async () => {
      mockCliSuccess('');
      await service.add('vercel-labs/agent-skills', 'global');

      expect(mockSpawn.mock.calls[0][1]).toEqual([
        'skills', 'add', 'vercel-labs/agent-skills', '--yes', '--all', '--global',
      ]);
    });

    it('project scope → --yes --all + cwd，不帶 --global', async () => {
      mockCliSuccess('');
      await service.add('owner/repo', 'project');

      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toEqual(['skills', 'add', 'owner/repo', '--yes', '--all']);
      expect(args).not.toContain('--global');
      const options = mockSpawn.mock.calls[0][2] as { cwd?: string };
      expect(options.cwd).toBe('/mock/workspace');
    });

    it('CLI 失敗 → 拋錯', async () => {
      mockCliFailure(1, 'Failed to clone repository');
      await expect(service.add('invalid/source', 'global')).rejects.toThrow('Failed to clone repository');
    });

    it('agents=["claude-code"] → --skill * --agent claude-code', async () => {
      mockCliSuccess('');
      await service.add('owner/repo', 'global', ['claude-code']);

      expect(mockSpawn.mock.calls[0][1]).toEqual([
        'skills', 'add', 'owner/repo', '--yes', '--skill', '*', '--agent', 'claude-code', '--global',
      ]);
    });

    it('agents=["claude-code","cursor"] → --agent claude-code cursor（空格分隔）', async () => {
      mockCliSuccess('');
      await service.add('owner/repo', 'global', ['claude-code', 'cursor']);

      expect(mockSpawn.mock.calls[0][1]).toEqual([
        'skills', 'add', 'owner/repo', '--yes', '--skill', '*', '--agent', 'claude-code', 'cursor', '--global',
      ]);
    });

    it('agents=undefined → --all（向後相容）', async () => {
      mockCliSuccess('');
      await service.add('owner/repo', 'global');

      expect(mockSpawn.mock.calls[0][1]).toEqual([
        'skills', 'add', 'owner/repo', '--yes', '--all', '--global',
      ]);
    });

    it('agents=[] → --all（空陣列等同 undefined）', async () => {
      mockCliSuccess('');
      await service.add('owner/repo', 'global', []);

      expect(mockSpawn.mock.calls[0][1]).toEqual([
        'skills', 'add', 'owner/repo', '--yes', '--all', '--global',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // remove()
  // -------------------------------------------------------------------------

  describe('remove()', () => {
    it('global scope → --yes --global（不帶 --all 避免移除全部）', async () => {
      mockCliSuccess('');
      await service.remove('my-skill', 'global');

      expect(mockSpawn.mock.calls[0][1]).toEqual([
        'skills', 'remove', 'my-skill', '--yes', '--global',
      ]);
    });

    it('project scope → --yes + cwd', async () => {
      mockCliSuccess('');
      await service.remove('test-skill', 'project');

      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toEqual(['skills', 'remove', 'test-skill', '--yes']);
      expect(args).not.toContain('--global');
      const options = mockSpawn.mock.calls[0][2] as { cwd?: string };
      expect(options.cwd).toBe('/mock/workspace');
    });
  });

  // -------------------------------------------------------------------------
  // find()
  // -------------------------------------------------------------------------

  describe('find()', () => {
    it('解析 ANSI 輸出為 SkillSearchResult[]', async () => {
      mockCliSuccess(SAMPLE_FIND_OUTPUT);
      const result = await service.find('test');

      expect(mockSpawn.mock.calls[0][1]).toEqual(['skills', 'find', 'test']);
      expect(result).toEqual([
        {
          fullId: 'vercel-labs/skills@find-skills',
          name: 'find-skills',
          repo: 'vercel-labs/skills',
          installs: '618.0K',
          url: 'https://skills.sh/vercel-labs/skills/find-skills',
        },
        {
          fullId: 'owner/repo@test-skill',
          name: 'test-skill',
          repo: 'owner/repo',
          installs: '7.7K',
          url: 'https://skills.sh/owner/repo/test-skill',
        },
      ]);
    });

    it('空結果 → 回傳 []', async () => {
      mockCliSuccess(SAMPLE_FIND_EMPTY);
      const result = await service.find('nonexistent');
      expect(result).toEqual([]);
    });

    it('只有 banner 無結果行 → 回傳 []', async () => {
      mockCliSuccess('\x1b[38;5;145m  banner line \x1b[0m\n');
      const result = await service.find('x');
      expect(result).toEqual([]);
    });

    it('空 query → 回傳 []，不呼叫 CLI（避免 TUI hang）', async () => {
      const result = await service.find('');
      expect(result).toEqual([]);
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('空白 query → 回傳 []', async () => {
      const result = await service.find('   ');
      expect(result).toEqual([]);
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // check()
  // -------------------------------------------------------------------------

  describe('check()', () => {
    it('去除 ANSI 回傳文字', async () => {
      mockCliSuccess('\x1b[36mChecking for skill updates...\x1b[0m\nNo skills tracked in lock file.');
      const result = await service.check();
      expect(result).toBe('Checking for skill updates...\nNo skills tracked in lock file.');
    });
  });

  // -------------------------------------------------------------------------
  // update()
  // -------------------------------------------------------------------------

  describe('update()', () => {
    it('呼叫 npx skills update', async () => {
      mockCliSuccess('');
      await service.update();
      expect(mockSpawn.mock.calls[0][1]).toEqual(['skills', 'update']);
    });
  });

  // -------------------------------------------------------------------------
  // getDetail()
  // -------------------------------------------------------------------------

  describe('getDetail()', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = realMkdtempSync(join(tmpdir(), 'skill-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('解析 SKILL.md frontmatter + body', async () => {
      const skillDir = join(tmpDir, 'test-skill');
      realMkdirSync(skillDir, { recursive: true });
      realWriteFileSync(join(skillDir, 'SKILL.md'), SAMPLE_SKILL_MD);

      const result = await service.getDetail(skillDir);

      expect(result.frontmatter).toEqual({
        name: 'test-skill',
        description: 'A test skill for testing',
        model: 'sonnet',
        'allowed-tools': 'Read, Write, Bash',
      });
      expect(result.body).toContain('# Test Skill');
      expect(result.body).toContain('This is the body of the skill.');
    });

    it('無 frontmatter → frontmatter 為空 object', async () => {
      const skillDir = join(tmpDir, 'no-fm');
      realMkdirSync(skillDir, { recursive: true });
      realWriteFileSync(join(skillDir, 'SKILL.md'), '# Just a body\n\nNo frontmatter here.');

      const result = await service.getDetail(skillDir);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toContain('# Just a body');
    });

    it('SKILL.md 不存在 → 拋錯', async () => {
      await expect(service.getDetail('/nonexistent/path')).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // fetchRegistry()
  // -------------------------------------------------------------------------

  describe('fetchRegistry()', () => {
    it('all-time → fetch / 解析 initialSkills JSON', async () => {
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_REGISTRY_HTML) });
      const result = await service.fetchRegistry('all-time');

      expect(fetchMock).toHaveBeenCalledWith('https://skills.sh/', expect.any(Object));
      expect(result).toEqual([
        { rank: 1, name: 'find-skills', repo: 'vercel-labs/skills', installs: '618.0K', url: 'https://skills.sh/vercel-labs/skills/find-skills' },
        { rank: 2, name: 'test-skill', repo: 'owner/repo', installs: '7.7K', url: 'https://skills.sh/owner/repo/test-skill' },
      ]);
    });

    it('trending → fetch /trending', async () => {
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_REGISTRY_HTML) });
      await service.fetchRegistry('trending');
      expect(fetchMock).toHaveBeenCalledWith('https://skills.sh/trending', expect.any(Object));
    });

    it('hot → fetch /hot', async () => {
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_REGISTRY_HTML) });
      await service.fetchRegistry('hot');
      expect(fetchMock).toHaveBeenCalledWith('https://skills.sh/hot', expect.any(Object));
    });

    it('query → append ?q=keyword', async () => {
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_REGISTRY_HTML) });
      await service.fetchRegistry('all-time', 'browser');
      expect(fetchMock).toHaveBeenCalledWith('https://skills.sh/?q=browser', expect.any(Object));
    });

    it('空 initialSkills → 回傳 []', async () => {
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_REGISTRY_EMPTY_HTML) });
      const result = await service.fetchRegistry('all-time');
      expect(result).toEqual([]);
    });

    it('HTML 中無 initialSkills → 拋錯', async () => {
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve('<html></html>') });
      await expect(service.fetchRegistry('all-time')).rejects.toThrow('initialSkills not found');
    });

    it('initialSkills 陣列括號不閉合（malformed）→ 拋錯', async () => {
      // 真實格式：\\\" 為 literal backslash+quote；陣列有 [ 但沒有對應的 ]，不含其他 ] 字元
      const BQ = '\\"'; // backslash + quote（2 chars），符合 HTML 中的 escaped quote
      const malformedHtml = `<html><body>${BQ}initialSkills${BQ}:[{${BQ}source${BQ}:${BQ}a/b${BQ}`;
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(malformedHtml) });
      await expect(service.fetchRegistry('all-time')).rejects.toThrow('malformed');
    });

    it('fetch 失敗 → 拋錯', async () => {
      fetchMock.mockRejectedValue(new Error('network error'));
      await expect(service.fetchRegistry('all-time')).rejects.toThrow('network error');
    });

    it('HTTP 非 200 → 拋錯', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' });
      await expect(service.fetchRegistry('all-time')).rejects.toThrow();
    });

    it('cache hit（TTL 內）→ 直接回傳快取，不呼叫 fetch', async () => {
      const cachedData = [
        { rank: 1, name: 'cached-skill', repo: 'owner/repo', installs: '1.0K', url: 'https://skills.sh/owner/repo/cached-skill' },
      ];
      const cacheContent = JSON.stringify({
        'all-time:': { data: cachedData, timestamp: Date.now() },
      });
      mockReadFile.mockImplementationOnce(() => Promise.resolve(cacheContent));

      const result = await service.fetchRegistry('all-time');

      expect(result).toEqual(cachedData);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('cache 過期（超過 TTL）→ 重新 fetch，更新 cache', async () => {
      const staleData = [
        { rank: 1, name: 'stale-skill', repo: 'owner/repo', installs: '1.0K', url: 'https://skills.sh/owner/repo/stale-skill' },
      ];
      const expiredTimestamp = Date.now() - 5 * 60 * 60 * 1000; // 5 小時前
      const staleCacheContent = JSON.stringify({
        'all-time:': { data: staleData, timestamp: expiredTimestamp },
      });
      mockReadFile.mockImplementationOnce(() => Promise.resolve(staleCacheContent));
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_REGISTRY_HTML) });

      const result = await service.fetchRegistry('all-time');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('cache key 隔離：不同 sort 各自獨立', async () => {
      const allTimeCache = [
        { rank: 1, name: 'alltime-skill', repo: 'owner/repo', installs: '10.0K', url: 'https://skills.sh/owner/repo/alltime-skill' },
      ];
      const cacheContent = JSON.stringify({
        'all-time:': { data: allTimeCache, timestamp: Date.now() },
      });
      // all-time: cache hit → no fetch
      mockReadFile.mockImplementationOnce(() => Promise.resolve(cacheContent));
      const allTimeResult = await service.fetchRegistry('all-time');
      expect(allTimeResult).toEqual(allTimeCache);
      expect(fetchMock).not.toHaveBeenCalled();

      // trending: cache miss → fetch
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_REGISTRY_HTML) });
      const trendingResult = await service.fetchRegistry('trending');
      expect(fetchMock).toHaveBeenCalledWith('https://skills.sh/trending', expect.any(Object));
      expect(trendingResult).toHaveLength(2);
    });

    it('cache 讀取失敗（損毀 JSON）→ 靜默 fallback 到 fetch', async () => {
      mockReadFile.mockImplementationOnce(() => Promise.resolve('not-valid-json{{{'));
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_REGISTRY_HTML) });

      const result = await service.fetchRegistry('all-time');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });

    it('cache 寫入失敗 → 靜默忽略，正常回傳 fetch 結果', async () => {
      mockWriteFile.mockImplementationOnce(() => Promise.reject(new Error('disk full')));
      fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(SAMPLE_REGISTRY_HTML) });

      const result = await service.fetchRegistry('all-time');

      expect(result).toHaveLength(2);
    });
  });
});
