import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { CLI_TIMEOUT_MS } from '../constants';
import { CliError } from '../types';

const execFileAsync = promisify(execFile);

/** CLI 執行選項 */
export interface CliExecOptions {
  /** timeout 毫秒，預設 CLI_TIMEOUT_MS */
  timeout?: number;
  /** 工作目錄（project scope 操作需要） */
  cwd?: string;
}

/**
 * Claude CLI 封裝層。
 * 透過 child_process.execFile 呼叫 claude，避免 shell injection。
 */
export class CliService {
  /** claude CLI 完整路徑（VSCode extension host 的 PATH 不含 ~/.local/bin） */
  private readonly claudePath: string;

  constructor() {
    const candidates = [
      join(homedir(), '.local', 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      'claude',
    ];
    this.claudePath = candidates.find((p) => p === 'claude' || existsSync(p)) ?? 'claude';
  }

  /** 執行 claude CLI 並回傳 stdout */
  async exec(args: string[], options?: CliExecOptions): Promise<string> {
    const timeout = options?.timeout ?? CLI_TIMEOUT_MS;
    const command = `claude ${args.join(' ')}`;

    try {
      const env = { ...process.env };
      delete env.CLAUDECODE;

      const { stdout } = await execFileAsync(this.claudePath, args, {
        timeout,
        cwd: options?.cwd,
        maxBuffer: 10 * 1024 * 1024,
        env,
      });
      return stdout.trim();
    } catch (error: unknown) {
      const err = error as {
        code?: string;
        killed?: boolean;
        exitCode?: number;
        stderr?: string;
        message?: string;
      };

      if (err.code === 'ENOENT') {
        throw new CliError(
          'Claude CLI not found. Ensure "claude" is installed and available in PATH.',
          command,
          null,
          '',
        );
      }

      if (err.killed || err.code === 'ETIMEDOUT') {
        throw new CliError(
          `CLI timeout after ${timeout}ms: ${command}`,
          command,
          null,
          '',
        );
      }

      throw new CliError(
        err.stderr || err.message || `CLI failed: ${command}`,
        command,
        err.exitCode ?? null,
        err.stderr ?? '',
      );
    }
  }

  /** 執行 claude CLI 並解析 JSON stdout */
  async execJson<T>(args: string[], options?: CliExecOptions): Promise<T> {
    const stdout = await this.exec(args, options);
    try {
      return JSON.parse(stdout) as T;
    } catch {
      throw new CliError(
        `Failed to parse JSON from CLI output: ${stdout.slice(0, 200)}`,
        `claude ${args.join(' ')}`,
        null,
        '',
      );
    }
  }
}
