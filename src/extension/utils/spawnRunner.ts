import { spawn } from 'child_process';

export interface SpawnError {
  code?: string | number;
  exitCode?: number | null;
  killed?: boolean;
  stderr: string;
  message: string;
}

export interface SpawnResult {
  stdout: string;
  stderr: string;
}

export interface SpawnOptions {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  timeout: number;
  maxBuffer?: number;
}

const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

/** 執行 child process 並回傳 stdout/stderr，逾時後 SIGTERM。reject 一個 SpawnError plain object（非 Error instance）。 */
export function spawnWithTimeout(options: SpawnOptions): Promise<SpawnResult> {
  const { command, args, env, cwd, timeout } = options;
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;

  return new Promise<SpawnResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timedOut = false;

    const finishResolve = (stdoutValue: string, stderrValue: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve({ stdout: stdoutValue.trim(), stderr: stderrValue });
    };

    const finishReject = (error: SpawnError): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    };

    const appendChunk = (stream: 'stdout' | 'stderr', chunk: Buffer | string): void => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString();
      const bytes = Buffer.byteLength(text);

      if (stream === 'stdout') {
        stdoutBytes += bytes;
        if (stdoutBytes > maxBuffer) {
          child.kill('SIGTERM');
          finishReject({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', message: 'stdout maxBuffer length exceeded', stderr });
          return;
        }
        stdout += text;
        return;
      }

      stderrBytes += bytes;
      if (stderrBytes > maxBuffer) {
        child.kill('SIGTERM');
        finishReject({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', message: 'stderr maxBuffer length exceeded', stderr });
        return;
      }
      stderr += text;
    };

    child.stdout.on('data', (chunk) => appendChunk('stdout', chunk));
    child.stderr.on('data', (chunk) => appendChunk('stderr', chunk));

    child.on('error', (error: NodeJS.ErrnoException) => {
      finishReject({
        code: error.code,
        killed: child.killed,
        stderr,
        message: error.message,
      });
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      if (timedOut) {
        finishReject({ killed: true, code: 'ETIMEDOUT', stderr, message: `Command timed out after ${timeout}ms` });
        return;
      }
      if (signal) {
        finishReject({
          killed: true,
          code: signal,
          stderr,
          message: stderr || `Command terminated by signal ${signal}`,
        });
        return;
      }
      if (code === 0) {
        finishResolve(stdout, stderr);
        return;
      }
      finishReject({
        exitCode: code ?? null,
        stderr,
        message: stderr || `Command failed with exit code ${code ?? 'unknown'}`,
      });
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeout);
  });
}
