/**
 * @vitest-environment jsdom
 *
 * 測試 initGlobalState：批次從偏好設定檔讀取並回填 viewState 快取。
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

  it('發送單次 preferences.read 請求並回填 viewState 快取', async () => {
    const entries = [
      { key: 'plugin.sort', fallback: 'name' },
      { key: 'plugin.filter.enabled', fallback: false },
    ];
    const prefsData = { 'plugin.sort': 'lastUpdated', 'plugin.filter.enabled': true };

    const promise = initGlobalState(entries);

    // 驗證只發送一次 preferences.read 請求
    expect(mockPostMessage).toHaveBeenCalledOnce();
    const msg = sentMessage();
    expect(msg.type).toBe('preferences.read');

    // 模擬 extension 回傳
    resolveRequest(msg.requestId as string, prefsData);
    const result = await promise;

    // 驗證回傳值
    expect(result).toEqual(prefsData);

    // 驗證 viewState 快取回填（可同步讀取）
    expect(getViewState('plugin.sort', 'name')).toBe('lastUpdated');
    expect(getViewState('plugin.filter.enabled', false)).toBe(true);
  });

  it('空 entries → 發送 preferences.read 請求，不呼叫 setViewState', async () => {
    const promise = initGlobalState([]);

    const msg = sentMessage();
    expect(msg.type).toBe('preferences.read');

    resolveRequest(msg.requestId as string, {});
    const result = await promise;

    expect(result).toEqual({});
    // 沒有 entry 所以 setState 不被呼叫（store 為空）
    expect(mockSetState).not.toHaveBeenCalled();
  });

  it('偏好設定有值時仍回填 viewState', async () => {
    const entries = [{ key: 'plugin.sort', fallback: 'name' }];

    const promise = initGlobalState(entries);
    const msg = sentMessage();

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
    const prefsData = {
      'plugin.sort': 'lastUpdated',
      'plugin.search': 'react',
      'plugin.filter.enabled': true,
    };

    const promise = initGlobalState(entries);
    const msg = sentMessage();
    resolveRequest(msg.requestId as string, prefsData);
    await promise;

    expect(getViewState('plugin.sort', 'name')).toBe('lastUpdated');
    expect(getViewState('plugin.search', '')).toBe('react');
    expect(getViewState('plugin.filter.enabled', false)).toBe(true);
    // 未在 entries 的 key 不受影響
    expect(getViewState('plugin.expanded', 'unset')).toBe('unset');
  });

  it('key 不存在於偏好設定 → 使用 fallback', async () => {
    const entries = [{ key: 'plugin.sort', fallback: 'name' }];

    const promise = initGlobalState(entries);
    const msg = sentMessage();

    // 偏好設定檔為空
    resolveRequest(msg.requestId as string, {});
    const result = await promise;

    expect(result['plugin.sort']).toBe('name');
    expect(getViewState('plugin.sort', 'xxx')).toBe('name');
    // 只有一次 preferences.read
    expect(mockPostMessage).toHaveBeenCalledOnce();
  });

  it('偏好設定有值 → 直接使用，不需遷移', async () => {
    const entries = [{ key: 'plugin.sort', fallback: 'name' }];

    const promise = initGlobalState(entries);
    const msg = sentMessage();

    resolveRequest(msg.requestId as string, { 'plugin.sort': 'lastUpdated' });
    const result = await promise;

    expect(result['plugin.sort']).toBe('lastUpdated');
    expect(getViewState('plugin.sort', 'name')).toBe('lastUpdated');
    // 只有一次 preferences.read，無遷移
    expect(mockPostMessage).toHaveBeenCalledOnce();
  });

  it('多 key 混合：有值用值，無值用 fallback', async () => {
    const entries = [
      { key: 'plugin.sort', fallback: 'name' },
      { key: 'plugin.search', fallback: '' },
      { key: 'plugin.filter.enabled', fallback: false },
    ];

    const promise = initGlobalState(entries);
    const msg = sentMessage();

    resolveRequest(msg.requestId as string, {
      'plugin.sort': 'lastUpdated', // 有值
      // plugin.search 不存在 → fallback ''
      // plugin.filter.enabled 不存在 → fallback false
    });
    const result = await promise;

    expect(result['plugin.sort']).toBe('lastUpdated');
    expect(result['plugin.search']).toBe('');
    expect(result['plugin.filter.enabled']).toBe(false);
  });
});
