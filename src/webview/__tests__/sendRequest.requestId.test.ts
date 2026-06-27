/**
 * @vitest-environment jsdom
 *
 * Reproduction test for GitHub issue #18:
 * sendRequest requestId 應帶 session-unique prefix (e.g. "<uuid>-1")，
 * 防止 webview reload 後 counter 重置導致舊 response 命中新 request。
 *
 * fix 契約：vscode.ts module load 時呼叫 crypto.randomUUID() 產生 SESSION_PREFIX，
 * requestId 改為 `${SESSION_PREFIX}${++requestIdCounter}`。
 *
 * 目前 (fix 前) requestId 是純數字字串 ("1", "2", ...)，
 * 下列 test 應紅。fix 後全部綠。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── stub acquireVsCodeApi 必須在 import vscode.ts 之前 ── */
const { mockPostMessage } = vi.hoisted(() => {
  const mockPostMessage = vi.fn();

  (globalThis as unknown as Record<string, unknown>)['acquireVsCodeApi'] = () => ({
    postMessage: mockPostMessage,
    getState: vi.fn(() => ({})),
    setState: vi.fn(),
  });

  return { mockPostMessage };
});

import { sendRequest } from '../vscode';

/** 取得第 N 次（0-indexed，負數從尾計）postMessage 的 payload */
function sentMessage(index = -1): Record<string, unknown> {
  const calls = mockPostMessage.mock.calls;
  const i = index < 0 ? calls.length + index : index;
  return calls[i][0] as Record<string, unknown>;
}

/** 模擬 extension host 回傳成功 response */
function resolveRequest(requestId: string, data: unknown): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'response', requestId, data },
    }),
  );
}

describe('sendRequest requestId — session prefix (issue #18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 確認 test 環境 crypto.randomUUID 可用（Node 19+ / vitest jsdom）。
   * fix 契約要求 production 直接呼叫 crypto.randomUUID()，此 test 驗其存在性。
   */
  it('crypto.randomUUID 在 test 環境可用', () => {
    expect(typeof globalThis.crypto?.randomUUID).toBe('function');
    const uuid = globalThis.crypto.randomUUID();
    // UUID v4 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  /**
   * 核心斷言：requestId 不得是純數字字串。
   * fix 前：requestId === "1" → 此 test 紅。
   * fix 後：requestId === "<uuid>-1" → 通過。
   */
  it('requestId 不是純數字字串，而是帶非數字字元的前綴格式', async () => {
    // 送出 request（不等待 resolve，只觀察送出的 message）
    const promise = sendRequest({ type: 'test-request' });

    const msg = sentMessage();
    const requestId = msg.requestId as string;

    // 斷言：不能是純數字（fix 前是 "1"，fix 後是 "<uuid>-1"）
    expect(requestId).not.toMatch(/^\d+$/);

    // 斷言：必須包含非數字字元（即前綴）
    expect(/\D/.test(requestId)).toBe(true);

    // cleanup：resolve 掉 pending request 避免 timeout 洩漏
    resolveRequest(requestId, null);
    await promise;
  });

  /**
   * 格式驗證：requestId 應符合 `<uuid>-<n>` 格式。
   * fix 前：純數字 → 格式不符 → 紅。
   * fix 後：帶 uuid prefix → 綠。
   */
  it('requestId 符合 <uuid>-<counter> 格式', async () => {
    const promise = sendRequest({ type: 'test-format' });

    const msg = sentMessage();
    const requestId = msg.requestId as string;

    // UUID v4 前綴格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx-<n>
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-\d+$/i,
    );

    resolveRequest(requestId, null);
    await promise;
  });

  /**
   * 連續兩次 sendRequest：
   * - prefix 相同（同 session）
   * - 尾端 counter 遞增（...-N, ...-N+1）
   */
  it('連續兩次 sendRequest：prefix 相同、counter 遞增', async () => {
    const p1 = sendRequest({ type: 'first' });
    const p2 = sendRequest({ type: 'second' });

    const id1 = sentMessage(0).requestId as string;
    const id2 = sentMessage(1).requestId as string;

    // 兩者都不是純數字
    expect(id1).not.toMatch(/^\d+$/);
    expect(id2).not.toMatch(/^\d+$/);

    // prefix 相同（去掉最後一段 -<n>）
    const prefix1 = id1.replace(/-\d+$/, '');
    const prefix2 = id2.replace(/-\d+$/, '');
    expect(prefix1).toBe(prefix2);
    expect(prefix1.length).toBeGreaterThan(0);

    // counter 部分：id2 的數字比 id1 多 1
    const counter1 = Number(id1.match(/-(\d+)$/)![1]);
    const counter2 = Number(id2.match(/-(\d+)$/)![1]);
    expect(counter2).toBe(counter1 + 1);

    // cleanup
    resolveRequest(id1, 'data1');
    resolveRequest(id2, 'data2');
    await Promise.all([p1, p2]);
  });

  /**
   * 配對正確性：用送出的 requestId 回 response，promise 應 resolve 正確 data。
   * 此 test 確認配對邏輯（字串比對）在帶 prefix 的格式下仍正常運作。
   */
  it('用帶 prefix 的 requestId 回 response，promise 正確 resolve', async () => {
    const promise = sendRequest<{ value: number }>({ type: 'echo' });

    const msg = sentMessage();
    const requestId = msg.requestId as string;

    const responseData = { value: 42 };
    resolveRequest(requestId, responseData);

    const result = await promise;
    expect(result).toEqual(responseData);
  });

  /**
   * 配對隔離性：不同 requestId 的 response 不能命中彼此的 pending request。
   * 這正是 session prefix 要解決的問題（防 reload 前後 "1" 碰撞）。
   */
  it('錯誤 requestId 的 response 不命中 pending request', async () => {
    let resolved = false;
    const promise = sendRequest({ type: 'isolation-test' }, 500).then(
      (v) => { resolved = true; return v; },
    );

    const msg = sentMessage();
    const realId = msg.requestId as string;

    // 送一個不同 requestId 的 response（模擬舊 session 的遲到 response）
    resolveRequest('stale-old-session-1', { stale: true });

    // 稍等確認沒有誤命中
    await new Promise((r) => setTimeout(r, 50));
    expect(resolved).toBe(false);

    // 用正確 id 收掉，避免 timeout
    resolveRequest(realId, { fresh: true });
    await promise;
    expect(resolved).toBe(true);
  });
});
