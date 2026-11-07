import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workspace, mockFileWatchers, mockWorkspaceFoldersChangeEmitter } from 'vscode';
import { FileWatcherService, FILE_WATCHER_DEBOUNCE_MS } from '../FileWatcherService';

vi.mock('os', () => ({
  homedir: () => '/mock-home',
}));

describe('FileWatcherService 工作區資料夾變動 → Settings 事件', () => {
  let svc: FileWatcherService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockFileWatchers.length = 0;
    workspace.workspaceFolders = undefined;
  });

  afterEach(() => {
    svc?.dispose();
    vi.useRealTimers();
    workspace.workspaceFolders = undefined;
  });

  it('加入工作區資料夾後 debounce 觸發一次 Settings 事件', async () => {
    svc = new FileWatcherService();
    const handler = vi.fn();
    svc.onSettingsFilesChanged(handler);

    workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }] as any;
    mockWorkspaceFoldersChangeEmitter.fire();

    expect(handler).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('移除全部資料夾也觸發 Settings 事件', async () => {
    workspace.workspaceFolders = [{ uri: { fsPath: '/my/project' } }] as any;
    svc = new FileWatcherService();
    const handler = vi.fn();
    svc.onSettingsFilesChanged(handler);

    workspace.workspaceFolders = undefined;
    mockWorkspaceFoldersChangeEmitter.fire();
    await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('連續多次資料夾變動 debounce 合併為一次 Settings 事件', async () => {
    svc = new FileWatcherService();
    const handler = vi.fn();
    svc.onSettingsFilesChanged(handler);

    mockWorkspaceFoldersChangeEmitter.fire();
    await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS / 2);
    mockWorkspaceFoldersChangeEmitter.fire();
    await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispose 後資料夾變動不再觸發 Settings 事件', async () => {
    svc = new FileWatcherService();
    const handler = vi.fn();
    svc.onSettingsFilesChanged(handler);
    svc.dispose();

    mockWorkspaceFoldersChangeEmitter.fire();
    await vi.advanceTimersByTimeAsync(FILE_WATCHER_DEBOUNCE_MS);

    expect(handler).not.toHaveBeenCalled();
  });
});
