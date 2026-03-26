import * as vscode from 'vscode';

/** 無 workspace 時拋出的型別化錯誤，供 catch 端用 instanceof 判斷 */
export class NoWorkspaceError extends Error {
  constructor() {
    super('No workspace folder open.');
    this.name = 'NoWorkspaceError';
  }
}

/**
 * 取得當前 workspace 的根目錄路徑。
 * 如果沒有開啟 workspace，拋出 NoWorkspaceError。
 */
export function getWorkspacePath(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new NoWorkspaceError();
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
