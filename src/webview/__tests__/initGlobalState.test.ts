/**
 * @vitest-environment jsdom
 *
 * 測試 initGlobalState：批次讀取 globalState 並回填 viewState 快取。
 *
 * 策略：vi.hoisted() 在 module load 前設定 globalThis.acquireVsCodeApi，
 * 讓 vscode.ts 可在 jsdom 環境正常載入。
 * 用 window.dispatchEvent 模擬 extension host 回傳 response。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── stub acquireVsCodeApi 必須在 import vscode.ts 之前 ── */
const { mockPostMessage, mockGetState, mockSetState, viewStateStore } = vi.hoisted(() => {
  const viewStateStore: Record<string, unknown> = {};
  const mockPostMessage = vi.fn();
  const mockGetState = vi.fn(() => ({ ...viewStateStore }));
  const mockSetState = vi.fn((newState: unknown) => {
    Object.assign(viewStateStore, newState as Record<string, unknown>);
  });

  (globalThis as unknown as Record<string, unknown>)['acquireVsCodeApi'] = () => ({
    postMessage: mockPostMessage,
    getState: mockGetState,
    setState: mockSetState,
  });

  return { mockPostMessage, mockGetState, mockSetState, viewStateStore };
});

import { initGlobalState, getViewState } from '../vscode';

/** 模擬 extension host 回傳成功 response */
function resolveRequest(requestId: string, data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'response', requestId, data },
  }));
}

/** 取得第 N 次（0-indexed）postMessage 的 payload */
function sentMessage(index = -1): Record<string, unknown> {
  const calls = mockPostMessage.mock.calls;
  const i = index < 0 ? calls.length + index : index;
  return calls[i][0] as Record<string, unknown>;
}

describe('initGlobalState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(viewStateStore)) delete viewStateStore[key];
  });

  it('發送單次 viewState.getAll 請求並回填 viewState 快取', async () => {
    const entries = [
      { key: 'plugin.sort', fallback: 'name' },
      { key: 'plugin.filter.enabled', fallback: false },
    ];
    const globalData = { 'plugin.sort': 'lastUpdated', 'plugin.filter.enabled': true };

    const promise = initGlobalState(entries);

    // 驗證只發送一次請求（sentinel fallback: null）
    expect(mockPostMessage).toHaveBeenCalledOnce();
    const msg = sentMessage();
    expect(msg.type).toBe('viewState.getAll');
    expect(msg.keys).toEqual(entries.map(({ key }) => ({ key, fallback: null })));

    // 模擬 extension 回傳
    resolveRequest(msg.requestId as string, globalData);
    const result = await promise;

    // 驗證回傳值
    expect(result).toEqual(globalData);

    // 驗證 viewState 快取回填（可同步讀取）
    expect(getViewState('plugin.sort', 'name')).toBe('lastUpdated');
    expect(getViewState('plugin.filter.enabled', false)).toBe(true);
  });

  it('空 entries → 發送 keys:[] 請求，不呼叫 setViewState', async () => {
    const promise = initGlobalState([]);

    const msg = sentMessage();
    expect(msg.type).toBe('viewState.getAll');
    expect(msg.keys).toEqual([]);

    resolveRequest(msg.requestId as string, {});
    const result = await promise;

    expect(result).toEqual({});
    // 沒有 entry 所以 setState 不被呼叫（store 為空）
    expect(mockSetState).not.toHaveBeenCalled();
  });

  it('extension 回傳非 null 值時仍回填 viewState', async () => {
    const entries = [{ key: 'plugin.sort', fallback: 'name' }];

    const promise = initGlobalState(entries);
    const msg = sentMessage();

    // extension 回傳非 null（globalState 有值，等於 fallback 也算有值）
    resolveRequest(msg.requestId as string, { 'plugin.sort': 'name' });
    await promise;

    // 值仍需回填到 cache
    expect(getViewState('plugin.sort', 'xxx')).toBe('name');
  });

  it('多個 key 各自正確回填，互不干擾', async () => {
    const entries = [
      { key: 'plugin.sort', fallback: 'name' },
      { key: 'plugin.search', fallback: '' },
      { key: 'plugin.filter.enabled', fallback: false },
    ];
    const globalData = {
      'plugin.sort': 'lastUpdated',
      'plugin.search': 'react',
      'plugin.filter.enabled': true,
    };

    const promise = initGlobalState(entries);
    const msg = sentMessage();
    resolveRequest(msg.requestId as string, globalData);
    await promise;

    expect(getViewState('plugin.sort', 'name')).toBe('lastUpdated');
    expect(getViewState('plugin.search', '')).toBe('react');
    expect(getViewState('plugin.filter.enabled', false)).toBe(true);
    // 未在 entries 的 key 不受影響
    expect(getViewState('plugin.expanded', 'unset')).toBe('unset');
  });

  describe('遷移邏輯', () => {
    it('globalState 有值 → 直接用，不遷移', async () => {
      // Given: viewState 有舊值，globalState 也有值
      viewStateStore['plugin.sort'] = 'old-view-state';
      const entries = [{ key: 'plugin.sort', fallback: 'name' }];

      const promise = initGlobalState(entries);
      const msg = sentMessage();

      // extension 回傳非 null（globalState 有值）
      resolveRequest(msg.requestId as string, { 'plugin.sort': 'lastUpdated' });
      const result = await promise;

      // globalState 值優先
      expect(result['plugin.sort']).toBe('lastUpdated');
      expect(getViewState('plugin.sort', 'name')).toBe('lastUpdated');
      // 無遷移：只有 viewState.getAll 一次
      expect(mockPostMessage).toHaveBeenCalledOnce();
    });

    it('globalState 為空 + viewState 有舊值 → 遷移並寫入 globalState', async () => {
      // Given: viewState 有舊資料
      viewStateStore['plugin.sort'] = 'date';
      const entries = [{ key: 'plugin.sort', fallback: 'name' }];

      const promise = initGlobalState(entries);
      const msg = sentMessage();

      // extension 回傳 null（globalState 未設定）
      resolveRequest(msg.requestId as string, { 'plugin.sort': null });
      const result = await promise;

      // 使用 viewState 舊值
      expect(result['plugin.sort']).toBe('date');
      expect(getViewState('plugin.sort', 'name')).toBe('date');
      // 觸發遷移：viewState.getAll + viewState.set
      expect(mockPostMessage).toHaveBeenCalledTimes(2);
      const migrateMsg = sentMessage(1);
      expect(migrateMsg.type).toBe('viewState.set');
      expect(migrateMsg.key).toBe('plugin.sort');
      expect(migrateMsg.value).toBe('date');
    });

    it('globalState 為空 + viewState 也空 → 使用 caller fallback', async () => {
      const entries = [{ key: 'plugin.sort', fallback: 'name' }];

      const promise = initGlobalState(entries);
      const msg = sentMessage();

      // extension 回傳 null（globalState 未設定），viewState 也是空的
      resolveRequest(msg.requestId as string, { 'plugin.sort': null });
      const result = await promise;

      // 使用 fallback
      expect(result['plugin.sort']).toBe('name');
      expect(getViewState('plugin.sort', 'xxx')).toBe('name');
      // 無遷移
      expect(mockPostMessage).toHaveBeenCalledOnce();
    });

    it('多 key 混合：globalState 有值 / viewState 遷移 / fallback 各路徑', async () => {
      // plugin.search: globalState 空但 viewState 有值 → 遷移
      viewStateStore['plugin.search'] = 'react';
      // plugin.sort: globalState 有值
      // plugin.filter.enabled: 兩者皆空 → fallback

      const entries = [
        { key: 'plugin.sort', fallback: 'name' },
        { key: 'plugin.search', fallback: '' },
        { key: 'plugin.filter.enabled', fallback: false },
      ];

      const promise = initGlobalState(entries);
      const msg = sentMessage();

      resolveRequest(msg.requestId as string, {
        'plugin.sort': 'lastUpdated', // globalState 有值
        'plugin.search': null,         // globalState 空
        'plugin.filter.enabled': null, // globalState 空
      });
      const result = await promise;

      expect(result['plugin.sort']).toBe('lastUpdated');  // globalState 優先
      expect(result['plugin.search']).toBe('react');       // viewState 遷移
      expect(result['plugin.filter.enabled']).toBe(false); // fallback

      // 只有 plugin.search 觸發遷移
      expect(mockPostMessage).toHaveBeenCalledTimes(2);
      const migrateMsg = sentMessage(1);
      expect(migrateMsg.type).toBe('viewState.set');
      expect(migrateMsg.key).toBe('plugin.search');
      expect(migrateMsg.value).toBe('react');
    });
  });
});
