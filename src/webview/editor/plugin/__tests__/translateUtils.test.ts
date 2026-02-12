import { describe, it, expect, vi } from 'vitest';
import { collectPluginTexts, getCardTranslateStatus, runConcurrent } from '../translateUtils';
import type { MergedPlugin, PluginContents } from '../../../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 建立最小 MergedPlugin fixture */
function makePlugin(overrides: Partial<MergedPlugin> = {}): MergedPlugin {
  return {
    id: 'test-plugin@marketplace',
    name: 'test-plugin',
    userInstall: null,
    projectInstalls: [],
    localInstall: null,
    ...overrides,
  };
}

/** 建立 PluginContents fixture */
function makeContents(overrides: Partial<PluginContents> = {}): PluginContents {
  return {
    commands: [],
    skills: [],
    agents: [],
    mcpServers: [],
    hooks: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// collectPluginTexts
// ---------------------------------------------------------------------------

describe('collectPluginTexts', () => {
  it('只有 description 的 plugin：回傳 description', () => {
    const items = [makePlugin({ description: 'A cool plugin' })];
    expect(collectPluginTexts(items)).toEqual(['A cool plugin']);
  });

  it('有 description + contents（commands / skills / agents）：收集所有 description', () => {
    const items = [
      makePlugin({
        description: 'Plugin desc',
        contents: makeContents({
          commands: [{ name: 'cmd1', description: 'Command desc' }],
          skills: [{ name: 'skill1', description: 'Skill desc' }],
          agents: [{ name: 'agent1', description: 'Agent desc' }],
        }),
      }),
    ];
    expect(collectPluginTexts(items)).toEqual([
      'Plugin desc',
      'Command desc',
      'Skill desc',
      'Agent desc',
    ]);
  });

  it('沒有 description 的 plugin：不收集', () => {
    const items = [makePlugin({ description: undefined })];
    expect(collectPluginTexts(items)).toEqual([]);
  });

  it('沒有 contents 的 plugin：只收集 description', () => {
    const items = [makePlugin({ description: 'Only desc', contents: undefined })];
    expect(collectPluginTexts(items)).toEqual(['Only desc']);
  });

  it('多個 plugin：依序收集所有 description', () => {
    const items = [
      makePlugin({ description: 'First' }),
      makePlugin({ description: 'Second' }),
    ];
    expect(collectPluginTexts(items)).toEqual(['First', 'Second']);
  });

  it('不包含 MCP server 名稱和 hooks 標記', () => {
    const items = [
      makePlugin({
        description: 'Plugin desc',
        contents: makeContents({
          mcpServers: ['my-server', 'other-server'],
          hooks: true,
        }),
      }),
    ];
    // 只有 plugin description，不含 mcpServers 或 hooks
    expect(collectPluginTexts(items)).toEqual(['Plugin desc']);
  });

  it('content item 沒有 description 時不收集', () => {
    const items = [
      makePlugin({
        contents: makeContents({
          commands: [
            { name: 'cmd1', description: 'Has desc' },
            { name: 'cmd2', description: '' },
          ],
        }),
      }),
    ];
    expect(collectPluginTexts(items)).toEqual(['Has desc']);
  });
});

// ---------------------------------------------------------------------------
// getCardTranslateStatus
// ---------------------------------------------------------------------------

describe('getCardTranslateStatus', () => {
  it('lang 為空字串時回傳 undefined', () => {
    const plugin = makePlugin({ description: 'test' });
    const result = getCardTranslateStatus(plugin, '', new Set(['test']), new Set());
    expect(result).toBeUndefined();
  });

  it('plugin description 在 active set 中：回傳 translating', () => {
    const plugin = makePlugin({ description: 'translating this' });
    const result = getCardTranslateStatus(
      plugin,
      'zh-TW',
      new Set(['translating this']),
      new Set(),
    );
    expect(result).toBe('translating');
  });

  it('content description 在 active set 中：回傳 translating（active 優先於 queued）', () => {
    const plugin = makePlugin({
      description: 'done desc',
      contents: makeContents({
        commands: [{ name: 'cmd', description: 'active cmd desc' }],
      }),
    });
    const result = getCardTranslateStatus(
      plugin,
      'zh-TW',
      new Set(['active cmd desc']),
      new Set(['done desc']),
    );
    expect(result).toBe('translating');
  });

  it('plugin description 在 queued set 中：回傳 queued', () => {
    const plugin = makePlugin({ description: 'waiting' });
    const result = getCardTranslateStatus(
      plugin,
      'zh-TW',
      new Set(),
      new Set(['waiting']),
    );
    expect(result).toBe('queued');
  });

  it('所有文字都不在 active/queued 中：回傳 undefined', () => {
    const plugin = makePlugin({ description: 'already done' });
    const result = getCardTranslateStatus(
      plugin,
      'zh-TW',
      new Set(),
      new Set(),
    );
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// runConcurrent
// ---------------------------------------------------------------------------

describe('runConcurrent', () => {
  it('執行所有 tasks', async () => {
    const results: number[] = [];
    const tasks = [1, 2, 3].map((n) => async () => { results.push(n); });

    await runConcurrent(tasks, 2);

    expect(results).toEqual([1, 2, 3]);
  });

  it('遵守併發上限：同時最多 N 個 task 執行', async () => {
    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 6 }, () => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      // 模擬非同步工作
      await new Promise((r) => setTimeout(r, 10));
      running--;
    });

    await runConcurrent(tasks, 2);

    expect(maxRunning).toBeLessThanOrEqual(2);
    expect(running).toBe(0);
  });

  it('單一 task 失敗不阻塞其他 tasks', async () => {
    const results: string[] = [];
    const tasks = [
      async () => { results.push('a'); },
      async () => { throw new Error('fail'); },
      async () => { results.push('c'); },
    ];

    // 失敗的 task 不會讓 runConcurrent reject
    await runConcurrent(tasks, 3);

    expect(results).toContain('a');
    expect(results).toContain('c');
  });

  it('空 task 列表立即完成', async () => {
    await expect(runConcurrent([], 3)).resolves.toBeUndefined();
  });
});
