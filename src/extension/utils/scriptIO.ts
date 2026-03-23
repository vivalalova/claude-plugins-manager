import * as vscode from 'vscode';
import { parseShellToken } from './shellTokenParser';
import { toErrorMessage } from '../../shared/errorUtils';

/** Export 設定 */
export interface ExportScriptConfig {
  defaultFilename: string;
  header: string;
  lines: string[];
  count: number;
}

/** Import 設定 */
export interface ImportScriptConfig {
  prefix: string;
  /** 從 prefix 後的 rest 解析成要執行的參數。回傳 null 則跳過該行。 */
  parseLine: (token: string, rest: string) => { id: string; successLabel: string; execute: () => Promise<void> } | null;
  emptyMessage: string;
}

/** 匯出 shell script：showSaveDialog → writeFile → showInformationMessage。 */
export async function exportShellScript(config: ExportScriptConfig): Promise<void> {
  const { defaultFilename, header, lines, count } = config;

  const scriptLines = [
    '#!/bin/bash',
    header,
    `# Exported ${count} item(s)`,
    '',
    ...lines,
  ];

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(defaultFilename),
    filters: { 'Shell Script': ['sh'] },
  });
  if (!uri) return;

  await vscode.workspace.fs.writeFile(uri, Buffer.from(scriptLines.join('\n') + '\n'));
  vscode.window.showInformationMessage(`Exported ${count} item(s) to ${uri.fsPath}`);
}

/**
 * 匯入 shell script：showOpenDialog → readFile → 逐行 parseShellToken + 執行。
 * 回傳每筆結果摘要。
 */
export async function importShellScript(config: ImportScriptConfig): Promise<string[]> {
  const { prefix, parseLine, emptyMessage } = config;

  const uris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectMany: false,
    filters: {
      'Shell Script': ['sh'],
      'All Files': ['*'],
    },
  });
  if (!uris || uris.length === 0) return [];

  const rawFile = await vscode.workspace.fs.readFile(uris[0]);
  const content = Buffer.from(rawFile).toString('utf-8');

  const tasks: Array<{ id: string; successLabel: string; execute: () => Promise<void> }> = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith(prefix)) continue;
    try {
      const parsed = parseShellToken(line.slice(prefix.length).trim());
      if (!parsed) continue;
      const task = parseLine(parsed.token, parsed.rest);
      if (task) tasks.push(task);
    } catch {
      // skip malformed line
    }
  }

  if (tasks.length === 0) {
    throw new Error(emptyMessage);
  }

  const results: string[] = [];
  for (const task of tasks) {
    try {
      await task.execute();
      results.push(task.successLabel);
    } catch (e) {
      results.push(`Failed: ${task.id} — ${toErrorMessage(e)}`);
    }
  }
  return results;
}
