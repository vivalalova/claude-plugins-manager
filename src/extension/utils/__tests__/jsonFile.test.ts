import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── fs/promises mock ── */
const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockRename = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  rename: mockRename,
}));

import { writeJsonFileAtomic, readJsonFileStrict } from '../jsonFile';

describe('writeJsonFileAtomic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it('writeFile 目標是暫存檔 (.tmp)', async () => {
    await writeJsonFileAtomic('/some/path.json', { a: 1 });

    expect(mockWriteFile).toHaveBeenCalledWith(
      '/some/path.json.tmp',
      expect.any(String),
    );
  });

  it('writeFile 內容是 JSON.stringify + trailing newline', async () => {
    await writeJsonFileAtomic('/some/path.json', { a: 1 });

    const content = mockWriteFile.mock.calls[0][1] as string;
    expect(content).toBe(JSON.stringify({ a: 1 }, null, 2) + '\n');
  });

  it('rename 從暫存檔 → 最終路徑', async () => {
    await writeJsonFileAtomic('/some/path.json', { a: 1 });

    expect(mockRename).toHaveBeenCalledWith('/some/path.json.tmp', '/some/path.json');
  });

  it('writeFile 在 rename 之前呼叫（確保原子性順序）', async () => {
    const callOrder: string[] = [];
    mockWriteFile.mockImplementation(() => {
      callOrder.push('writeFile');
      return Promise.resolve();
    });
    mockRename.mockImplementation(() => {
      callOrder.push('rename');
      return Promise.resolve();
    });

    await writeJsonFileAtomic('/some/path.json', { a: 1 });

    expect(callOrder).toEqual(['writeFile', 'rename']);
  });
});

describe('readJsonFileStrict', () => {
  beforeEach(() => {
    mockReadFile.mockReset();
  });

  it('檔案存在且合法 JSON → 回傳解析後物件', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ foo: 'bar' }));

    const result = await readJsonFileStrict<{ foo: string }>('/some/path.json');

    expect(result).toEqual({ foo: 'bar' });
  });

  it('檔案不存在（ENOENT）→ 拋出錯誤（不像 readJsonFile 那樣回傳 default）', async () => {
    const enoentErr = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValue(enoentErr);

    await expect(readJsonFileStrict('/some/missing.json')).rejects.toThrow();
  });

  it('檔案存在但內容不是合法 JSON → 拋出錯誤，訊息含 "Invalid JSON in"', async () => {
    mockReadFile.mockResolvedValue('{ not valid json');

    await expect(readJsonFileStrict('/some/bad.json')).rejects.toThrow('Invalid JSON in');
  });
});
