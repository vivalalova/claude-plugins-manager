import { describe, expect, it } from 'vitest';
import { workspace } from 'vscode';
import { escapeShellArg, getWorkspacePath } from '../workspace';

describe('workspace utils', () => {
  it('getWorkspacePath 回傳第一個 workspace folder 的路徑', () => {
    workspace.workspaceFolders = [
      { uri: { fsPath: '/workspace/main' }, name: 'main', index: 0 },
      { uri: { fsPath: '/workspace/other' }, name: 'other', index: 1 },
    ] as never;

    expect(getWorkspacePath()).toBe('/workspace/main');
  });

  it('沒有開啟 workspace 時直接拋錯', () => {
    workspace.workspaceFolders = undefined;

    expect(() => getWorkspacePath()).toThrow('No workspace folder open.');
  });

  it('escapeShellArg 會正確 escape 單引號', () => {
    expect(escapeShellArg("a'b'c")).toBe("a'\\''b'\\''c");
  });
});
