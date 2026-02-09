import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDate } from '../formatDate';

describe('formatDate', () => {
  let mockNow: Date;

  beforeEach(() => {
    mockNow = new Date('2024-01-15T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('回傳 "just now" 當 < 1 分鐘', () => {
    const date = new Date(mockNow.getTime() - 30_000); // 30 秒前
    expect(formatDate(date.toISOString())).toBe('just now');
  });

  it('回傳 "Xm ago" 當 < 60 分鐘', () => {
    const date5m = new Date(mockNow.getTime() - 5 * 60_000);
    expect(formatDate(date5m.toISOString())).toBe('5m ago');

    const date45m = new Date(mockNow.getTime() - 45 * 60_000);
    expect(formatDate(date45m.toISOString())).toBe('45m ago');
  });

  it('回傳 "Xh ago" 當 < 24 小時', () => {
    const date2h = new Date(mockNow.getTime() - 2 * 3_600_000);
    expect(formatDate(date2h.toISOString())).toBe('2h ago');

    const date23h = new Date(mockNow.getTime() - 23 * 3_600_000);
    expect(formatDate(date23h.toISOString())).toBe('23h ago');
  });

  it('回傳 "Xd ago" 當 < 7 天', () => {
    const date1d = new Date(mockNow.getTime() - 1 * 86_400_000);
    expect(formatDate(date1d.toISOString())).toBe('1d ago');

    const date6d = new Date(mockNow.getTime() - 6 * 86_400_000);
    expect(formatDate(date6d.toISOString())).toBe('6d ago');
  });

  it('回傳完整日期當 >= 7 天', () => {
    const date7d = new Date(mockNow.getTime() - 7 * 86_400_000);
    const date30d = new Date(mockNow.getTime() - 30 * 86_400_000);

    // toLocaleDateString 會根據環境不同，只驗證不是相對時間格式
    const result7d = formatDate(date7d.toISOString());
    const result30d = formatDate(date30d.toISOString());

    expect(result7d).not.toMatch(/ago$/);
    expect(result30d).not.toMatch(/ago$/);
    expect(result7d).toMatch(/\d/); // 包含數字
    expect(result30d).toMatch(/\d/);
  });

  it('無效日期回傳原字串', () => {
    expect(formatDate('invalid-date')).toBe('invalid-date');
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatDate('')).toBe('');
  });

  it('邊界條件：恰好 1 分鐘', () => {
    const date = new Date(mockNow.getTime() - 60_000);
    expect(formatDate(date.toISOString())).toBe('1m ago');
  });

  it('邊界條件：恰好 1 小時', () => {
    const date = new Date(mockNow.getTime() - 3_600_000);
    expect(formatDate(date.toISOString())).toBe('1h ago');
  });

  it('邊界條件：恰好 1 天', () => {
    const date = new Date(mockNow.getTime() - 86_400_000);
    expect(formatDate(date.toISOString())).toBe('1d ago');
  });
});
