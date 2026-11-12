import type { ConsentOutcome } from '../../shared/types';
import type { CliExecOptions, CliService } from './CliService';
import { CommandError } from '../utils/errors';

/** CLI `--json` 結果行回報、需由人過目的 marketplace 宣告命令 */
export interface ShownCommand {
  pluginId: string;
  kind: string;
  command: string;
  mode: string;
  sha256: string;
}

export type CommandConsentAction = 'install' | 'update';
export type ConfirmFn = (shown: ShownCommand, action: CommandConsentAction) => Promise<boolean>;

const SHOWN_COMMAND_FIELDS = ['pluginId', 'kind', 'command', 'mode', 'sha256'] as const;

/** 從 CLI stdout 由後往前找 command_source_refused 結果行；不是這種拒絕回 null */
function parseRefusal(stdout: string): ShownCommand | null {
  const lines = stdout.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('{')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const result = parsed as { failureCode?: unknown; shownCommand?: Record<string, unknown> };
    if (result.failureCode !== 'command_source_refused') return null;
    const shown = result.shownCommand;
    if (!shown || SHOWN_COMMAND_FIELDS.some((field) => typeof shown[field] !== 'string')) return null;
    return {
      pluginId: shown.pluginId as string,
      kind: shown.kind as string,
      command: shown.command as string,
      mode: shown.mode as string,
      sha256: shown.sha256 as string,
    };
  }
  return null;
}

/**
 * 執行 `claude plugin install|update`。CLI 以「需執行 marketplace 宣告的命令」拒絕時，
 * 把命令交給 confirm 給人看；同意才帶 `--accept-command <sha256>` 重跑。
 * 同意後重跑又被拒：顯示內容（命令／模式／來源）變了才再問一次；
 * 內容與剛同意的相同（同一個 sha，或 CLI 每次回報不同 sha——catalog 版本讀不到時）則原樣拋出，不反覆詢問。
 * 其餘失敗一律原樣拋出同一個錯誤物件。
 */
export async function runWithCommandConsent(
  cli: Pick<CliService, 'exec'>,
  baseArgs: string[],
  opts: CliExecOptions | undefined,
  action: CommandConsentAction,
  confirm: ConfirmFn,
): Promise<ConsentOutcome> {
  let accepted: ShownCommand | undefined;
  for (;;) {
    const args = [...baseArgs, '--json', ...(accepted ? ['--accept-command', accepted.sha256] : [])];
    try {
      await cli.exec(args, opts);
      return { cancelled: false };
    } catch (error) {
      const shown = error instanceof CommandError ? parseRefusal(error.stdout) : null;
      if (!shown) throw error;
      const sameAsAccepted = accepted !== undefined
        && SHOWN_COMMAND_FIELDS.every((field) => field === 'sha256' || shown[field] === accepted?.[field]);
      if (sameAsAccepted) throw error;
      if (!(await confirm(shown, action))) return { cancelled: true };
      accepted = shown;
    }
  }
}
