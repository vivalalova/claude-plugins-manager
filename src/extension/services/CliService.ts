import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { CLI_TIMEOUT_MS, CLI_MAX_RETRIES, CLI_BASE_BACKOFF_MS, CLI_RETRYABLE_CODES } from '../constants';
import { spawnWithTimeout } from '../utils/spawnRunner';
import type { SpawnError } from '../utils/spawnRunner';
/** CLI 執行錯誤 */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

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
 * 暫時性錯誤（ETIMEDOUT、ECONNRESET 等）自動重試，指數退避。
 */
export class CliService {
  /** claude CLI 完整路徑（VSCode extension host 的 PATH 不含 ~/.local/bin） */
  readonly claudePath: string;

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
    const totalTimeout = options?.timeout ?? CLI_TIMEOUT_MS;
    const command = `claude ${args.join(' ')}`;

    // 建構 env 一次，避免每次重試重複 spread process.env
    const env = { ...process.env };
    delete env.CLAUDECODE;

    try {
      return await this.withRetry(async (remainingTimeout) => {
        return this.runCommand(args, env, options?.cwd, remainingTimeout);
      }, totalTimeout);
    } catch (error: unknown) {
      throw this.toCliError(error, command, totalTimeout);
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

  /**
   * 通用重試包裝器。
   * 遇到可重試錯誤自動重試最多 CLI_MAX_RETRIES 次，指數退避（1s → 2s → 4s）。
   * 總耗時（含退避等待）不超過 totalTimeout。
   */
  private async withRetry<T>(
    fn: (remainingTimeout: number) => Promise<T>,
    totalTimeout: number,
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: unknown;

    for (let attempt = 0; attempt <= CLI_MAX_RETRIES; attempt++) {
      const elapsed = Date.now() - startTime;
      const remaining = totalTimeout - elapsed;
      if (remaining <= 0) break;

      // 非首次嘗試：等待退避時間
      if (attempt > 0) {
        const backoff = CLI_BASE_BACKOFF_MS * (2 ** (attempt - 1));
        if (backoff >= remaining) break; // 退避時間已超過剩餘，放棄
        await this.sleep(backoff);
      }

      // sleep 後重新計算剩餘時間；<= 0 代表已超時，不再呼叫（避免 timeout=0 = 不限時）
      const callRemaining = totalTimeout - (Date.now() - startTime);
      if (callRemaining <= 0) break;

      try {
        return await fn(callRemaining);
      } catch (error: unknown) {
        lastError = error;
        if (!CliService.isRetryable(error)) break;
      }
    }

    // lastError 可能為 undefined（totalTimeout <= 0 邊界），防禦性拋出
    throw lastError ?? new Error(`CLI retry exhausted (timeout: ${totalTimeout}ms)`);
  }

  /**
   * 判斷錯誤是否為暫時性、可重試。
   * killed 優先（process 被 signal 殺掉可能同時帶 exitCode），
   * ENOENT（CLI 找不到）和非零 exit code（CLI 正常執行但回報錯誤）不重試。
   */
  static isRetryable(error: unknown): boolean {
    const err = error as SpawnError;
    // killed 優先：process 被 timeout kill 時可能同時帶 exitCode
    if (err.killed === true) return true;
    if (err.code === 'ENOENT') return false;
    if (err.exitCode !== undefined && err.exitCode !== null) return false;
    return typeof err.code === 'string' && CLI_RETRYABLE_CODES.has(err.code);
  }

  /** 等待指定毫秒（子類別或測試可覆寫） */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runCommand(
    args: string[],
    env: NodeJS.ProcessEnv,
    cwd: string | undefined,
    timeout: number,
  ): Promise<string> {
    const result = await spawnWithTimeout({
      command: this.claudePath,
      args,
      env,
      cwd,
      timeout,
    });
    return result.stdout;
  }

  /** 將原始 execFile 錯誤轉換為 CliError */
  private toCliError(error: unknown, command: string, timeout: number): CliError {
    const err = error as SpawnError;

    if (err.code === 'ENOENT') {
      return new CliError(
        'Claude CLI not found. Ensure "claude" is installed and available in PATH.',
        command,
        null,
        '',
      );
    }

    if (err.killed || err.code === 'ETIMEDOUT') {
      return new CliError(
        `CLI timeout after ${timeout}ms: ${command}`,
        command,
        null,
        '',
      );
    }

    return new CliError(
      err.stderr || err.message || `CLI failed: ${command}`,
      command,
      err.exitCode ?? null,
      err.stderr ?? '',
    );
  }
}
