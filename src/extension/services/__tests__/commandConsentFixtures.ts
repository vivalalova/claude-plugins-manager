/**
 * command-source 同意流程的測試夾具（實測 claude 2.1.322 的拒絕輸出）。
 * 非測試檔，供多個 *.test.ts 共用。
 */
import { CliError } from '../CliService';

export const XCODE_ID = 'xcode@claude-plugins-official';
export const XCODE_COMMAND = 'xcrun agent plugin path --plugin-format claude';
export const XCODE_SHA = 'c932dd31f67e4b6d7ea984434bb2d27943212b36a0d35e469b5ba66af6da6035';
export const OTHER_SHA = '1111111111111111111111111111111111111111111111111111111111111111';

export interface ShownCommandJson {
  kind?: string;
  pluginId?: string;
  command?: string;
  mode?: string;
  catalogRevision?: string;
  sha256?: string;
}

export function shownCommandJson(overrides: ShownCommandJson = {}): Record<string, string> {
  const base: Record<string, string | undefined> = {
    kind: 'command_source',
    pluginId: XCODE_ID,
    command: XCODE_COMMAND,
    mode: 'link',
    catalogRevision: 'gcs:e0ab6e51219eef74e417a0e1d89e5d53e5e763d4',
    sha256: XCODE_SHA,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(base).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;
}

/** 被拒時的 stdout：數行人類說明 + 一行 JSON */
export function refusedStdout(
  shown: ShownCommandJson = {},
  failureCode = 'command_source_refused',
): string {
  const json = JSON.stringify({
    command: 'install',
    outcome: 'failed',
    plugin: XCODE_ID,
    scope: 'local',
    message: 'command source refused',
    failureCode,
    shownCommand: shownCommandJson(shown),
  });
  return [
    'This plugin runs a command on your machine:',
    `  ${shown.command ?? XCODE_COMMAND}`,
    'Re-run with --accept-command to approve.',
    json,
  ].join('\n');
}

/** CLI 拒絕 command-source 時 exec 丟出的錯誤 */
export function createRefusedError(shown: ShownCommandJson = {}): CliError {
  return new CliError(
    'Plugin requires accepting a command source',
    'claude plugin install',
    1,
    'command source refused',
    refusedStdout(shown),
  );
}

/** 一般失敗（not_found）：stdout 一行 JSON、無 shownCommand */
export function createNotFoundError(): CliError {
  const stdout = JSON.stringify({
    command: 'install',
    outcome: 'failed',
    plugin: 'nope@mp',
    scope: 'user',
    message: 'Plugin not found',
    failureCode: 'not_found',
  });
  return new CliError(
    '✘ Failed to install plugin "nope@mp": Plugin not found',
    'claude plugin install',
    1,
    '✘ Failed to install plugin "nope@mp": Plugin not found',
    stdout,
  );
}
