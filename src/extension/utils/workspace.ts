import * as vscode from 'vscode';

/**
 * 取得當前 workspace 的根目錄路徑。
 * 如果沒有開啟 workspace，拋出錯誤。
 */
export function getWorkspacePath(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error('No workspace folder open.');
  }
  return folder.uri.fsPath;
}

/**
 * Shell escape 單引號字串。
 * 將 ' 替換為 '\''，確保在 shell script 中安全使用。
 */
export function escapeShellArg(arg: string): string {
  return arg.replace(/'/g, "'\\''");
}
