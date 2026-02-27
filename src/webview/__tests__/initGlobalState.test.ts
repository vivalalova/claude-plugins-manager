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

/** 取得最後一次 postMessage 的完整 payload */
function lastSentMessage(): Record<string, unknown> {
  const calls = mockPostMessage.mock.calls;
  return calls[calls.length - 1][0] as Record<string, unknown>;
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

    // 驗證只發送一次請求
    expect(mockPostMessage).toHaveBeenCalledOnce();
    const msg = lastSentMessage();
    expect(msg.type).toBe('viewState.getAll');
    expect(msg.keys).toEqual(entries);

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

    const msg = lastSentMessage();
    expect(msg.type).toBe('viewState.getAll');
    expect(msg.keys).toEqual([]);

    resolveRequest(msg.requestId as string, {});
    const result = await promise;

    expect(result).toEqual({});
    // 沒有 entry 所以 setState 不被呼叫（store 為空）
    expect(mockSetState).not.toHaveBeenCalled();
  });

  it('extension 回傳 fallback 值時仍回填 viewState', async () => {
    const entries = [{ key: 'plugin.sort', fallback: 'name' }];

    const promise = initGlobalState(entries);
    const msg = lastSentMessage();

    // extension 回傳與 fallback 相同的值
    resolveRequest(msg.requestId as string, { 'plugin.sort': 'name' });
    await promise;

    // fallback 值仍需回填到 cache
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
    const msg = lastSentMessage();
    resolveRequest(msg.requestId as string, globalData);
    await promise;

    expect(getViewState('plugin.sort', 'name')).toBe('lastUpdated');
    expect(getViewState('plugin.search', '')).toBe('react');
    expect(getViewState('plugin.filter.enabled', false)).toBe(true);
    // 未在 entries 的 key 不受影響
    expect(getViewState('plugin.expanded', 'unset')).toBe('unset');
  });
});
