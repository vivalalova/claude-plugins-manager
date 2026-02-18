/**
 * vscode 模組的測試 mock。
 * vitest.config.ts 透過 alias 將 `import * as vscode from 'vscode'` 導向這裡。
 */
import { vi } from 'vitest';

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void): { dispose: () => void } => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter((l) => l !== listener); } };
  };

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  dispose = vi.fn();
}

export class Uri {
  static file(path: string): { fsPath: string } {
    return { fsPath: path };
  }

  static joinPath(base: { fsPath: string }, ...segments: string[]): { fsPath: string } {
    return { fsPath: [base.fsPath, ...segments].join('/') };
  }

  static parse(value: string): { toString: () => string } {
    return { toString: () => value };
  }
}

export const env = {
  openExternal: vi.fn().mockResolvedValue(true),
};

export const workspace = {
  workspaceFolders: undefined as Array<{ uri: { fsPath: string } }> | undefined,
};

export const window = {
  createWebviewPanel: vi.fn(),
  registerWebviewViewProvider: vi.fn(),
};

export const commands = {
  registerCommand: vi.fn(),
};

export const ViewColumn = {
  One: 1,
};
