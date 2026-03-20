import { describe, expect, it } from 'vitest';
import { getAgentColor } from '../agents';

describe('getAgentColor', () => {
  it('已知 agent label 回傳品牌色', () => {
    expect(getAgentColor('Claude Code')).toEqual({ bg: '#da7756', fg: '#fff' });
    expect(getAgentColor('Cursor')).toEqual({ bg: '#2d2d2d', fg: '#fff' });
  });

  it('未知 agent label 回傳穩定 fallback 色', () => {
    const first = getAgentColor('Mystery Agent');
    const second = getAgentColor('Mystery Agent');

    expect(first).toEqual(second);
    expect([
      { bg: '#6366f1', fg: '#fff' },
      { bg: '#0891b2', fg: '#fff' },
      { bg: '#be185d', fg: '#fff' },
      { bg: '#65a30d', fg: '#fff' },
    ]).toContainEqual(first);
  });
});
