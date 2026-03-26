import { describe, expect, it } from 'vitest';
import { stripAnsi } from '../ansi';

describe('stripAnsi', () => {
  it('去除 SGR color codes', () => {
    expect(stripAnsi('\x1b[32mgreen\x1b[0m')).toBe('green');
  });

  it('去除 bold + color 組合', () => {
    expect(stripAnsi('\x1b[38;5;145m\x1b[1mbold colored\x1b[0m')).toBe('bold colored');
  });

  it('去除 cursor/erase sequences', () => {
    expect(stripAnsi('\x1b[2Jcleared\x1b[H')).toBe('cleared');
  });

  it('去除 ? 參數序列（如 cursor visibility）', () => {
    expect(stripAnsi('\x1b[?25lhidden cursor\x1b[?25h')).toBe('hidden cursor');
  });

  it('無 ANSI 的字串原樣回傳', () => {
    expect(stripAnsi('plain text')).toBe('plain text');
  });

  it('空字串', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('多行混合 ANSI codes', () => {
    const input = [
      '\x1b[38;5;145m  banner \x1b[0m',
      '\x1b[36mowner/repo@skill\x1b[0m \x1b[36m7.7K installs\x1b[0m',
    ].join('\n');

    expect(stripAnsi(input)).toBe('  banner \nowner/repo@skill 7.7K installs');
  });
});
