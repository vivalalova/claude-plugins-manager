import { spawn } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SKILL_CLI_TIMEOUT_MS, SKILL_CLI_LONG_TIMEOUT_MS, SKILL_REGISTRY_URL } from '../constants';
import { getWorkspacePath } from '../utils/workspace';
import type { AgentSkill, RegistrySkill, RegistrySort, SkillScope, SkillSearchResult } from '../../shared/types';

/** SkillService 執行錯誤 */
export class SkillError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'SkillError';
  }
}

const MAX_STDIO_BUFFER_BYTES = 10 * 1024 * 1024;

/** execFile 錯誤的型別（Node.js child_process） */
interface ExecError {
  code?: string | number;
  killed?: boolean;
  exitCode?: number | null;
  stderr?: string;
  message?: string;
}

/**
 * npx skills CLI 封裝 + skills.sh registry 解析。
 * 職責分離：不依賴 CliService（不同的 CLI、不同的 env 處理）。
 */
export class SkillService {
  private npxPath: string | null = null;

  /** 去除 ANSI escape codes（SGR + cursor + erase + mode sequences） */
  static stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
  }

  /** 格式化安裝數為人類可讀字串（配合 skills.sh 格式：K/M 一律一位小數） */
  static formatInstalls(count: number): string {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K`;
    }
    return String(count);
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
    const options: { cwd?: string } = {};

    if (scope === 'global') {
      args.push('--global');
    } else {
      options.cwd = getWorkspacePath();
    }

    return this.execJsonList(args, options);
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

  /** 執行 npx skills list --json 並解析回傳 */
  private async execJsonList(args: string[], options: { cwd?: string }): Promise<AgentSkill[]> {
    const stdout = await this.exec(args, options);
    try {
      return JSON.parse(stdout) as AgentSkill[];
    } catch {
      throw new SkillError(
        `Failed to parse JSON from npx skills list: ${stdout.slice(0, 200)}`,
        `npx ${args.join(' ')}`,
        null,
        '',
      );
    }
  }

  /** 安裝 skill */
  async add(source: string, scope: SkillScope): Promise<void> {
    const args = ['skills', 'add', source, '--yes', '--all'];
    const options: { cwd?: string; timeout?: number } = { timeout: SKILL_CLI_LONG_TIMEOUT_MS };

    if (scope === 'global') {
      args.push('--global');
    } else {
      options.cwd = getWorkspacePath();
    }

    await this.exec(args, options);
  }

  /**
   * 移除 skill。
   * ⚠️ 不帶 --all：CLI 的 `remove <name> --all` 會忽略 name 移除全部。
   */
  async remove(name: string, scope: SkillScope): Promise<void> {
    const args = ['skills', 'remove', name, '--yes'];
    const options: { cwd?: string } = {};

    if (scope === 'global') {
      args.push('--global');
    } else {
      options.cwd = getWorkspacePath();
    }

    await this.exec(args, options);
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
    return SkillService.stripAnsi(stdout);
  }

  /** 更新所有 skills */
  async update(): Promise<void> {
    await this.exec(['skills', 'update']);
  }

  /** 讀取 SKILL.md 取得 frontmatter + body */
  async getDetail(skillPath: string): Promise<{ frontmatter: Record<string, string>; body: string }> {
    const mdPath = join(skillPath, 'SKILL.md');
    const content = readFileSync(mdPath, 'utf-8');
    return this.parseFrontmatter(content);
  }

  /** 從 skills.sh 取得 registry 列表 */
  async fetchRegistry(sort: RegistrySort, query?: string): Promise<RegistrySkill[]> {
    let url: string;
    if (query) {
      url = sort === 'all-time'
        ? `${SKILL_REGISTRY_URL}/?q=${encodeURIComponent(query)}`
        : `${SKILL_REGISTRY_URL}/${sort}?q=${encodeURIComponent(query)}`;
    } else {
      url = sort === 'all-time'
        ? `${SKILL_REGISTRY_URL}/`
        : `${SKILL_REGISTRY_URL}/${sort}`;
    }

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
    return this.parseRegistryHtml(html);
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
  private exec(args: string[], options?: { cwd?: string; timeout?: number }): Promise<string> {
    const timeout = options?.timeout ?? SKILL_CLI_TIMEOUT_MS;
    const npxPath = this.resolveNpxPath();

    return new Promise<string>((resolve, reject) => {
      const child = spawn(npxPath, args, {
        cwd: options?.cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let settled = false;
      let timedOut = false;

      const finish = (error?: ExecError): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (error) {
          reject(new SkillError(
            error.stderr || error.message || `npx skills failed`,
            `npx ${args.join(' ')}`,
            error.exitCode ?? null,
            error.stderr ?? '',
          ));
        } else {
          resolve(stdout.trim());
        }
      };

      const appendChunk = (stream: 'stdout' | 'stderr', chunk: Buffer | string): void => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString();
        const bytes = Buffer.byteLength(text);

        if (stream === 'stdout') {
          stdoutBytes += bytes;
          if (stdoutBytes > MAX_STDIO_BUFFER_BYTES) {
            child.kill('SIGTERM');
            finish({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', message: 'stdout exceeded', stderr });
            return;
          }
          stdout += text;
        } else {
          stderrBytes += bytes;
          if (stderrBytes > MAX_STDIO_BUFFER_BYTES) {
            child.kill('SIGTERM');
            finish({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', message: 'stderr exceeded', stderr });
            return;
          }
          stderr += text;
        }
      };

      child.stdout.on('data', (chunk) => appendChunk('stdout', chunk));
      child.stderr.on('data', (chunk) => appendChunk('stderr', chunk));

      child.on('error', (error: NodeJS.ErrnoException) => {
        finish({ code: error.code, killed: child.killed, stderr, message: error.message });
      });

      child.on('close', (code, signal) => {
        if (settled) return;
        if (timedOut) {
          finish({ killed: true, code: 'ETIMEDOUT', stderr, message: `Command timed out after ${timeout}ms` });
          return;
        }
        if (signal) {
          finish({ killed: true, code: signal, stderr, message: stderr || `Terminated by ${signal}` });
          return;
        }
        if (code === 0) {
          finish();
          return;
        }
        finish({ exitCode: code ?? null, stderr, message: stderr || `Exit code ${code ?? 'unknown'}` });
      });

      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeout);
    });
  }

  /** 解析 npx skills find 的文字輸出 */
  private parseFindOutput(stdout: string): SkillSearchResult[] {
    const lines = SkillService.stripAnsi(stdout).split('\n');
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

  /** 從 skills.sh HTML 解析 initialSkills JSON */
  private parseRegistryHtml(html: string): RegistrySkill[] {
    // Next.js RSC embeds data in __next_f.push scripts
    const match = /initialSkills:(\[.*?\])/.exec(html);
    if (!match) {
      throw new SkillError(
        'Failed to parse skills.sh: initialSkills not found in HTML. The page structure may have changed.',
        'parseRegistryHtml',
        null,
        '',
      );
    }

    // The JSON is escaped within the JS string
    const jsonStr = match[1].replace(/\\"/g, '"');
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
      installs: SkillService.formatInstalls(item.installs),
      url: `${SKILL_REGISTRY_URL}/${item.source}/${item.skillId}`,
    }));
  }

  /** 解析 SKILL.md frontmatter */
  private parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
    const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = fmRegex.exec(content);

    if (!match) {
      return { frontmatter: {}, body: content.trim() };
    }

    const fmBlock = match[1];
    const body = match[2].trim();
    const frontmatter: Record<string, string> = {};

    for (const line of fmBlock.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (key) frontmatter[key] = value;
    }

    return { frontmatter, body };
  }
}
