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

  dispose = vi.fn(() => { this.listeners = []; });
}

export class RelativePattern {
  constructor(
    public readonly base: unknown,
    public readonly pattern: string,
  ) {}
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

/** Mock FileSystemWatcher：呼叫回傳的 handler 可觸發 onChange/onCreate/onDelete */
export function createMockFileSystemWatcher() {
  const changeHandlers: Array<() => void> = [];
  const createHandlers: Array<() => void> = [];
  const deleteHandlers: Array<() => void> = [];
  return {
    watcher: {
      onDidChange: (handler: () => void) => { changeHandlers.push(handler); },
      onDidCreate: (handler: () => void) => { createHandlers.push(handler); },
      onDidDelete: (handler: () => void) => { deleteHandlers.push(handler); },
      dispose: vi.fn(),
    },
    fireChange: () => changeHandlers.forEach((h) => h()),
    fireCreate: () => createHandlers.forEach((h) => h()),
    fireDelete: () => deleteHandlers.forEach((h) => h()),
  };
}

/** 追蹤所有 createFileSystemWatcher 呼叫的 mock watchers */
export const mockFileWatchers: Array<ReturnType<typeof createMockFileSystemWatcher>> = [];

/** workspace folder 變更事件（測試用） */
export const mockWorkspaceFoldersChangeEmitter = new EventEmitter<void>();

export const workspace = {
  workspaceFolders: undefined as Array<{ uri: { fsPath: string }; name?: string }> | undefined,
  createFileSystemWatcher: vi.fn().mockImplementation(() => {
    const mock = createMockFileSystemWatcher();
    mockFileWatchers.push(mock);
    return mock.watcher;
  }),
  onDidChangeWorkspaceFolders: mockWorkspaceFoldersChangeEmitter.event,
  fs: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('')),
  },
};

export const window = {
  createWebviewPanel: vi.fn(),
  registerWebviewViewProvider: vi.fn(),
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  showInformationMessage: vi.fn(),
};

export const commands = {
  registerCommand: vi.fn(),
};

export const ViewColumn = {
  One: 1,
};
