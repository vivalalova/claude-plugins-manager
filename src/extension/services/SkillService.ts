import { existsSync, readdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { SKILL_CLI_TIMEOUT_MS, SKILL_CLI_LONG_TIMEOUT_MS } from '../constants';
import { getWorkspacePath } from '../utils/workspace';
import type { AgentSkill, RegistrySkill, RegistrySort, SkillScope, SkillSearchResult } from '../../shared/types';
import { WriteQueue } from '../utils/WriteQueue';
import { spawnWithTimeout } from '../utils/spawnRunner';
import { parseFrontmatter } from '../utils/frontmatter';
import { stripAnsi } from '../utils/ansi';
import type { SpawnError } from '../utils/spawnRunner';
import {
  buildSkillRegistryUrl,
  parseSkillRegistryHtml,
  readSkillRegistryCache,
  writeSkillRegistryCache,
} from './skillRegistrySupport';

import { CommandError } from '../utils/errors';

/** SkillService 執行錯誤 */
export class SkillError extends CommandError {}

/**
 * npx skills CLI 封裝 + skills.sh registry 解析。
 * 職責分離：不依賴 CliService（不同的 CLI、不同的 env 處理）。
 */
export class SkillService {
  private npxPath: string | null = null;
  private readonly registryCacheWriteQueue = new WriteQueue();
  private readonly registryCachePath: string;

  constructor(cacheDir: string) {
    this.registryCachePath = join(cacheDir, 'skill-registry.json');
  }

  private getScopedExecContext(
    scope: SkillScope,
    timeout?: number,
  ): { args: string[]; options: { cwd?: string; timeout?: number } } {
    const args: string[] = [];
    const options: { cwd?: string; timeout?: number } = {};

    if (timeout !== undefined) {
      options.timeout = timeout;
    }

    if (scope === 'global') {
      args.push('--global');
    } else {
      options.cwd = getWorkspacePath();
    }

    return { args, options };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** 列出已安裝 skills。無 scope 時合併 global + project 結果（依 name 去重，project 優先）。 */
  async list(scope?: SkillScope): Promise<AgentSkill[]> {
    if (!scope) {
      const [globalSkills, projectSkills] = await Promise.all([
        this.list('global'),
        this.listProject(),
      ]);
      // project scope 優先（覆蓋同名 global skill）
      const map = new Map<string, AgentSkill>();
      for (const s of globalSkills) map.set(s.name, s);
      for (const s of projectSkills) map.set(s.name, s);
      return [...map.values()];
    }

    const args = ['skills', 'list', '--json'];
    const scoped = this.getScopedExecContext(scope);
    args.push(...scoped.args);

    return this.execJsonList(args, scoped.options);
  }

  /** project scope list — 獨立方法避免 getWorkspacePath 在無 workspace 時拋錯影響 global 結果 */
  private async listProject(): Promise<AgentSkill[]> {
    try {
      return await this.execJsonList(
        ['skills', 'list', '--json'],
        { cwd: getWorkspacePath() },
      );
    } catch {
      return []; // 無 workspace 時 project scope 回傳空
    }
  }

  /** 執行 npx skills list --json 並解析回傳，再從 SKILL.md frontmatter 補 description */
  private async execJsonList(args: string[], options: { cwd?: string }): Promise<AgentSkill[]> {
    const stdout = await this.exec(args, options);
    let skills: AgentSkill[];
    try {
      skills = JSON.parse(stdout) as AgentSkill[];
    } catch {
      throw new SkillError(
        `Failed to parse JSON from npx skills list: ${stdout.slice(0, 200)}`,
        `npx ${args.join(' ')}`,
        null,
        '',
      );
    }

    // 批次讀 SKILL.md frontmatter 補 description
    await Promise.all(skills.map(async (skill) => {
      if (skill.description || !skill.path) return;
      try {
        const content = await readFile(join(skill.path, 'SKILL.md'), 'utf-8');
        const { frontmatter } = parseFrontmatter(content);
        if (frontmatter.description) {
          skill.description = frontmatter.description;
        }
      } catch {
        // SKILL.md 不存在或無法讀取，略過
      }
    }));

    return skills;
  }

  /** 安裝 skill */
  async add(source: string, scope: SkillScope, agents?: string[], skillName?: string): Promise<void> {
    const args = ['skills', 'add', source, '--yes'];
    if (agents && agents.length > 0) {
      args.push('--skill', skillName ?? '*', '--agent', ...agents);
    } else {
      args.push('--all');
    }
    const scoped = this.getScopedExecContext(scope, SKILL_CLI_LONG_TIMEOUT_MS);
    args.push(...scoped.args);

    await this.exec(args, scoped.options);
  }

  /**
   * 移除 skill。
   * ⚠️ 不帶 --all：CLI 的 `remove <name> --all` 會忽略 name 移除全部。
   */
  async remove(name: string, scope: SkillScope): Promise<void> {
    const args = ['skills', 'remove', name, '--yes'];
    const scoped = this.getScopedExecContext(scope);
    args.push(...scoped.args);

    await this.exec(args, scoped.options);
  }

  /** 搜尋 skills（npx skills find）。空 query 會進入 interactive TUI，直接回傳空。 */
  async find(query: string): Promise<SkillSearchResult[]> {
    if (!query.trim()) return [];
    const stdout = await this.exec(['skills', 'find', query]);
    return this.parseFindOutput(stdout);
  }

  /** 檢查更新 */
  async check(): Promise<string> {
    const stdout = await this.exec(['skills', 'check']);
    return stripAnsi(stdout);
  }

  /** 更新所有 skills */
  async update(): Promise<void> {
    await this.exec(['skills', 'update']);
  }

  /** 讀取 SKILL.md 取得 frontmatter + body */
  async getDetail(skillPath: string): Promise<{ frontmatter: Record<string, string>; body: string }> {
    const mdPath = join(skillPath, 'SKILL.md');
    const content = await readFile(mdPath, 'utf-8');
    return parseFrontmatter(content);
  }

  /** 從 skills.sh 取得 registry 列表（4 小時 file-based cache） */
  async fetchRegistry(sort: RegistrySort, query?: string): Promise<RegistrySkill[]> {
    const cacheKey = `${sort}:${query ?? ''}`;
    const cached = await readSkillRegistryCache(this.registryCachePath, cacheKey);
    if (cached) return cached;

    const url = buildSkillRegistryUrl(sort, query);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'claude-plugins-manager' },
    });
    if (!response.ok) {
      throw new SkillError(
        `skills.sh returned ${response.status} ${response.statusText}`,
        `GET ${url}`,
        null,
        '',
      );
    }

    const html = await response.text();
    const data = parseSkillRegistryHtml(html);
    await writeSkillRegistryCache(
      this.registryCachePath,
      this.registryCacheWriteQueue,
      cacheKey,
      data,
    );
    return data;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /** 解析 npx 路徑（lazy + cached） */
  private resolveNpxPath(): string {
    if (this.npxPath) return this.npxPath;

    const candidates: string[] = [];

    // NVM：取最新版
    try {
      const nvmDir = join(homedir(), '.nvm', 'versions', 'node');
      const versions = readdirSync(nvmDir)
        .filter((v: string) => v.startsWith('v'))
        .sort((a: string, b: string) => {
          const pa = a.slice(1).split('.').map(Number);
          const pb = b.slice(1).split('.').map(Number);
          for (let i = 0; i < 3; i++) {
            if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
          }
          return 0;
        });
      if (versions.length > 0) {
        candidates.push(join(nvmDir, versions[0], 'bin', 'npx'));
      }
    } catch {
      // NVM 不存在，跳過
    }

    candidates.push('/usr/local/bin/npx', '/opt/homebrew/bin/npx');

    this.npxPath = candidates.find((p) => existsSync(p)) ?? 'npx';
    return this.npxPath;
  }

  /** 執行 npx CLI 並回傳 stdout */
  private async exec(args: string[], options?: { cwd?: string; timeout?: number }): Promise<string> {
    const timeout = options?.timeout ?? SKILL_CLI_TIMEOUT_MS;
    const npxPath = this.resolveNpxPath();

    // 清除 CLAUDECODE 避免 nested session 衝突（同 CliService）
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith('CLAUDECODE')) {
        delete env[key];
      }
    }

    try {
      const result = await spawnWithTimeout({
        command: npxPath,
        args,
        env,
        cwd: options?.cwd,
        timeout,
      });
      return result.stdout;
    } catch (error) {
      const err = error as SpawnError;
      throw new SkillError(
        err.stderr || err.message || 'npx skills failed',
        `npx ${args.join(' ')}`,
        err.exitCode ?? null,
        err.stderr ?? '',
      );
    }
  }

  /** 解析 npx skills find 的文字輸出 */
  private parseFindOutput(stdout: string): SkillSearchResult[] {
    const lines = stripAnsi(stdout).split('\n');
    const results: SkillSearchResult[] = [];

    // fullId line pattern: `owner/repo@skill-name  NNK installs`
    const idRegex = /^(\S+\/\S+@\S+)\s+(.+?)\s+installs\s*$/;
    // URL line pattern: `└ https://skills.sh/...`
    const urlRegex = /└\s+(https:\/\/skills\.sh\/\S+)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const idMatch = idRegex.exec(line);
      if (!idMatch) continue;

      const fullId = idMatch[1];
      const installs = idMatch[2].trim();
      const atIdx = fullId.indexOf('@');
      const repo = fullId.slice(0, atIdx);
      const name = fullId.slice(atIdx + 1);

      // 下一行可能是 URL
      let url: string | undefined;
      if (i + 1 < lines.length) {
        const urlMatch = urlRegex.exec(lines[i + 1].trim());
        if (urlMatch) {
          url = urlMatch[1];
          i++; // skip URL line
        }
      }

      results.push({ fullId, name, repo, installs, url });
    }

    return results;
  }

  /** 清除 in-memory cache 狀態（磁碟快取由 cacheDir rm 處理） */
  invalidateCache(): void {
    this.registryCacheWriteQueue.reset();
  }

}
