/**
 * @vitest-environment jsdom
 */
// #28 — 搜尋結果、「已自訂」入口與環境變數分頁同一套繼承感知判斷；上層快照經
// settings.refresh 推播刷新後依新快照判斷（K1）、初次載入上層快照後到時顯示翻轉（K3）。
// 以布林 DISABLE_TELEMETRY（default '0'）操作：取消勾選＝選到預設值。
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '../../../__test-utils__/renderWithProviders';

const { mockSendRequest, mockOnPushMessage } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockOnPushMessage: vi.fn(() => () => {}),
}));

vi.mock('../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  onPushMessage: mockOnPushMessage,
  getViewState: vi.fn(),
  setViewState: vi.fn(),
  setGlobalState: vi.fn().mockResolvedValue(undefined),
  initGlobalState: vi.fn().mockResolvedValue({}),
}));

import { SettingsPage } from '../SettingsPage';
import { ToastProvider } from '../../../components/Toast';

const X = 'DISABLE_TELEMETRY';
const MARKER = 'DISABLE_AUTOUPDATER';

const renderPage = () => renderWithI18n(<ToastProvider><SettingsPage /></ToastProvider>);

const getCalls = (type: string): any[][] =>
  mockSendRequest.mock.calls.filter((c: any[]) => c[0]?.type === type);

/** 本層 env 子欄位寫入（settings.setNested parentKey=env），依呼叫順序轉成 { 變數名: 值 }。 */
const envSetValues = (): Record<string, string>[] =>
  getCalls('settings.setNested')
    .filter((c) => c[0]?.parentKey === 'env')
    .map((c) => ({ [c[0].childKey as string]: c[0].value as string }));

const envDeletedKeys = (): string[] =>
  getCalls('settings.deleteNested').filter((c) => c[0]?.parentKey === 'env').map((c) => c[0].childKey as string);

const envWriteCount = (): number => envSetValues().length + envDeletedKeys().length;

const getEnvCheckbox = (name: string): HTMLInputElement => {
  const label = screen.getAllByText(name).map((el) => el.closest('label')).find((l) => l?.querySelector('input[type="checkbox"]'));
  if (!label) throw new Error(`checkbox for ${name} not found`);
  return label.querySelector('input[type="checkbox"]') as HTMLInputElement;
};

interface MockState {
  user: Record<string, unknown>;
  project: Record<string, unknown>;
  /** 回傳非 undefined 時取代 user settings.get 的回應（用來延後 resolve） */
  userOverride?: () => Promise<Record<string, unknown>> | undefined;
}

/** 以可變狀態 mock 各 scope 的 settings.get；project 的 settings.set 寫回狀態，供 refresh 重讀。 */
const installMock = (state: MockState): void => {
  mockSendRequest.mockImplementation((msg: { type: string; scope?: string; key?: string; value?: unknown }) => {
    if (msg.type === 'workspace.getFolders') return Promise.resolve([{ name: 'ws', path: '/ws' }]);
    if (msg.type === 'settings.get' && msg.scope === 'user') {
      const deferred = state.userOverride?.();
      return deferred ?? Promise.resolve(JSON.parse(JSON.stringify(state.user)));
    }
    if (msg.type === 'settings.get' && msg.scope === 'project') return Promise.resolve(JSON.parse(JSON.stringify(state.project)));
    if (msg.type === 'settings.get') return Promise.resolve({});
    if (msg.type === 'settings.set') {
      if (msg.scope === 'project' && msg.key) state.project = { ...state.project, [msg.key]: msg.value };
      return Promise.resolve(undefined);
    }
    if (msg.type === 'settings.delete') {
      if (msg.scope === 'project' && msg.key) {
        const { [msg.key]: _, ...rest } = state.project;
        state.project = rest;
      }
      return Promise.resolve(undefined);
    }
    if (msg.type === 'settings.setNested' || msg.type === 'settings.deleteNested') {
      if (msg.scope === 'project') {
        const { parentKey, childKey } = msg as unknown as { parentKey: string; childKey: string };
        const parent = { ...((state.project[parentKey] as Record<string, unknown>) ?? {}) };
        if (msg.type === 'settings.setNested') parent[childKey] = msg.value;
        else delete parent[childKey];
        const { [parentKey]: _, ...rest } = state.project;
        state.project = Object.keys(parent).length > 0 ? { ...rest, [parentKey]: parent } : rest;
      }
      return Promise.resolve(undefined);
    }
    return Promise.resolve(null);
  });
};

const capturePushHandlers = (): Array<(msg: { type: string }) => void> => {
  const handlers: Array<(msg: { type: string }) => void> = [];
  mockOnPushMessage.mockImplementation(((h: (msg: { type: string }) => void) => {
    handlers.push(h);
    return () => {};
  }) as any);
  return handlers;
};

const switchToProject = async (): Promise<void> => {
  await waitFor(() => expect(screen.getAllByText('Project')).toHaveLength(1));
  fireEvent.click(screen.getByText('Project').closest('button')!);
};

const search = async (query: string): Promise<void> => {
  await waitFor(() => screen.getByPlaceholderText('Search settings...'));
  fireEvent.change(screen.getByPlaceholderText('Search settings...'), { target: { value: query } });
};

describe('SettingsPage — env 已知變數繼承感知（#28 三入口）', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockOnPushMessage.mockImplementation(() => () => {});
  });

  it('B5 搜尋入口：project、本層未設、user env.X=1 → 顯示勾選 → 取消（預設值）→ settings.setNested env.X=0', async () => {
    installMock({ user: { env: { [X]: '1' } }, project: {} });
    renderPage();
    await switchToProject();
    await search(X);

    await waitFor(() => expect(getEnvCheckbox(X).checked).toBe(true), { timeout: 5000 });
    fireEvent.click(getEnvCheckbox(X));

    await waitFor(() => {
      expect(envSetValues().some((v) => v?.[X] === '0')).toBe(true);
    });
  });

  it('B6 已自訂入口：project env.X=1、user env.X=1 → 取消（預設值）→ settings.setNested env.X=0', async () => {
    installMock({ user: { env: { [X]: '1' } }, project: { env: { [X]: '1' } } });
    const { container } = renderPage();
    await switchToProject();
    await waitFor(() => screen.getByText('Customized'));
    fireEvent.click(screen.getByText('Customized').closest('button')!);

    // 就緒訊號：env row 的「覆寫 User」badge 只在上層快照已套用到 project 時出現
    await waitFor(() => {
      const envRow = container.querySelector('[data-customized-field="env"]');
      expect(envRow?.querySelector('.settings-override-badge')?.textContent).toContain('User');
    }, { timeout: 5000 });

    fireEvent.click(getEnvCheckbox(X));

    await waitFor(() => {
      expect(envSetValues().some((v) => v?.[X] === '0')).toBe(true);
    });
  });

  it('B10 push 刷新：上層先有 X → 選預設值寫入；refresh 後上層改成沒有 X → 再選預設值 → 刪', async () => {
    const handlers = capturePushHandlers();
    const state: MockState = { user: { env: { [X]: '1', [MARKER]: '1' } }, project: {} };
    installMock(state);
    renderPage();
    await switchToProject();
    await search('DISABLE_');

    await waitFor(() => expect(getEnvCheckbox(X).checked).toBe(true), { timeout: 5000 });
    fireEvent.click(getEnvCheckbox(X));
    await waitFor(() => expect(envSetValues().some((v) => v?.[X] === '0')).toBe(true));

    // 外部改檔：user 移除 X 與 MARKER、project 自己設 X=1
    state.user = {};
    state.project = { env: { [X]: '1' } };
    handlers.forEach((h) => h({ type: 'settings.refresh' }));

    // 就緒訊號：MARKER 只由上層提供，取消勾選代表新上層快照已套用；X 勾選代表本層已重讀
    await waitFor(() => {
      expect(getEnvCheckbox(MARKER).checked).toBe(false);
      expect(getEnvCheckbox(X).checked).toBe(true);
    }, { timeout: 5000 });

    const before = envWriteCount();
    const setBefore = envSetValues().length;
    fireEvent.click(getEnvCheckbox(X));

    await waitFor(() => expect(envWriteCount()).toBeGreaterThan(before));
    const after = envSetValues().slice(setBefore);
    expect(after.every((v) => v === undefined || !(X in v))).toBe(true);
    expect(envDeletedKeys()).toContain(X);
  });

  it('B11 初次翻轉：上層 settings.get 延後 resolve → 先顯示預設（未勾），resolve 後顯示繼承值（勾）', async () => {
    let userCalls = 0;
    let resolveUser: ((v: Record<string, unknown>) => void) | undefined;
    const state: MockState = {
      user: { env: { [X]: '1' } },
      project: {},
      // 第一次 user settings.get 是初始 user scope 的本層載入，照常回應；之後（父層快照）延後
      userOverride: () => {
        userCalls += 1;
        if (userCalls === 1) return undefined;
        return new Promise<Record<string, unknown>>((res) => { resolveUser = res; });
      },
    };
    installMock(state);
    renderPage();
    await switchToProject();
    await search(X);

    await waitFor(() => {
      expect(resolveUser).toBeDefined();
      getEnvCheckbox(X);
    }, { timeout: 5000 });
    expect(getEnvCheckbox(X).checked).toBe(false);

    resolveUser!({ env: { [X]: '1' } });

    await waitFor(() => expect(getEnvCheckbox(X).checked).toBe(true), { timeout: 5000 });
  });

  it('B12 自己寫入後回推、上層不變 → 再選預設值仍寫入（不刪）', async () => {
    const handlers = capturePushHandlers();
    const state: MockState = { user: { env: { [X]: '1' } }, project: {} };
    installMock(state);
    renderPage();
    await switchToProject();
    await search(X);

    await waitFor(() => expect(getEnvCheckbox(X).checked).toBe(true), { timeout: 5000 });
    fireEvent.click(getEnvCheckbox(X));
    await waitFor(() => expect(envSetValues().some((v) => v?.[X] === '0')).toBe(true));

    // 自己寫入觸發的回推：上層（user）不變
    const userGetsBefore = getCalls('settings.get').filter((c) => c[0]?.scope === 'user').length;
    handlers.forEach((h) => h({ type: 'settings.refresh' }));
    await waitFor(() => {
      expect(getCalls('settings.get').filter((c) => c[0]?.scope === 'user').length).toBeGreaterThan(userGetsBefore);
      expect(getEnvCheckbox(X).checked).toBe(false);
    }, { timeout: 5000 });

    // 勾回（非預設值）再取消（預設值）
    fireEvent.click(getEnvCheckbox(X));
    await waitFor(() => expect(getEnvCheckbox(X).checked).toBe(true));
    const setBefore = envSetValues().length;
    fireEvent.click(getEnvCheckbox(X));

    await waitFor(() => {
      const after = envSetValues().slice(setBefore);
      expect(after.some((v) => v?.[X] === '0')).toBe(true);
    });
    expect(envDeletedKeys()).not.toContain(X);
    expect(getCalls('settings.set').some((c) => c[0]?.key === 'env')).toBe(false);
  });
});
