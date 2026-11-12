/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as Record<string, unknown>)['acquireVsCodeApi'] = () => ({
    postMessage: vi.fn(),
    getState: vi.fn(() => ({})),
    setState: vi.fn(),
  });
});

import { USER_CONFIRM_REQUEST_TIMEOUT_MS } from '../vscode';

describe('USER_CONFIRM_REQUEST_TIMEOUT_MS', () => {
  it('等使用者在原生確認框決定的 request 逾時為 30 分鐘', () => {
    expect(USER_CONFIRM_REQUEST_TIMEOUT_MS).toBe(30 * 60_000);
  });
});
