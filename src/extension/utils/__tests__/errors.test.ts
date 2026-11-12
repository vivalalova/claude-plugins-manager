import { describe, it, expect } from 'vitest';
import { CommandError } from '../errors';

describe('CommandError', () => {
  it('stdout 預設為空字串（舊呼叫端只傳四個參數）', () => {
    const err = new CommandError('m', 'cmd', 1, 'stderr');
    expect(err.stdout).toBe('');
    expect(err.stderr).toBe('stderr');
    expect(err.exitCode).toBe(1);
  });

  it('第 5 參數帶入 stdout 並可讀取', () => {
    const err = new CommandError('m', 'cmd', 1, 'stderr', 'out line');
    expect(err.stdout).toBe('out line');
    expect(err.message).toBe('m');
  });
});
