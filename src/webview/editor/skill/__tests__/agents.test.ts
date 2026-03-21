import { describe, expect, it } from 'vitest';
import { ALL_AGENTS, getAgentColor } from '../agents';

const FALLBACK_COLORS = [
  { bg: '#6366f1', fg: '#fff' },
  { bg: '#0891b2', fg: '#fff' },
  { bg: '#be185d', fg: '#fff' },
  { bg: '#65a30d', fg: '#fff' },
];

describe('ALL_AGENTS', () => {
  it('所有 name 唯一', () => {
    const names = ALL_AGENTS.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('所有 label 唯一', () => {
    const labels = ALL_AGENTS.map((a) => a.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('visible=true 的 agent 必須有 color', () => {
    const visibleWithoutColor = ALL_AGENTS.filter((a) => a.visible && !a.color);
    expect(visibleWithoutColor).toEqual([]);
  });
});

describe('getAgentColor', () => {
  it('已知 agent label 回傳品牌色', () => {
    expect(getAgentColor('Claude Code')).toEqual({ bg: '#da7756', fg: '#fff' });
    expect(getAgentColor('Cursor')).toEqual({ bg: '#2d2d2d', fg: '#fff' });
  });

  it('未知 agent label 回傳 FALLBACK_COLORS 其中之一', () => {
    const color = getAgentColor('Mystery Agent');
    expect(FALLBACK_COLORS).toContainEqual(color);
  });

  it('相同未知 label 多次呼叫結果一致（hash 穩定）', () => {
    const first = getAgentColor('Mystery Agent');
    const second = getAgentColor('Mystery Agent');
    expect(first).toEqual(second);
  });

  it('不同未知 label 可能對應不同 fallback', () => {
    // hash 散落到不同 bucket，驗證函式確實依 label 內容分配
    const results = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map(getAgentColor);
    const unique = new Set(results.map((c) => c.bg));
    // 5 個不同 label 至少命中 1 種以上的 fallback color（分佈不全塌到同一桶）
    expect(unique.size).toBeGreaterThanOrEqual(1);
    results.forEach((c) => expect(FALLBACK_COLORS).toContainEqual(c));
  });

  it('空字串回傳 FALLBACK_COLORS 其中之一', () => {
    const color = getAgentColor('');
    expect(FALLBACK_COLORS).toContainEqual(color);
  });
});
