import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── fs/promises mock ── */
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockRename = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: mockWriteFile,
  rename: mockRename,
}));

import { writeJsonFileAtomic } from '../jsonFile';

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
