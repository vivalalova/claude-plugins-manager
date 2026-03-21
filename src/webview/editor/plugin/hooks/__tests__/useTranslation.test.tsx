/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { MergedPlugin } from '../../../../../shared/types';

const { mockSendRequest, mockGetViewState, mockSetViewState, mockSetGlobalState, mockInitGlobalState } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockGetViewState: vi.fn((_key: string, fallback: unknown) => fallback),
  mockSetViewState: vi.fn(),
  mockSetGlobalState: vi.fn().mockResolvedValue(undefined),
  mockInitGlobalState: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
  getViewState: (...args: unknown[]) => mockGetViewState(...args),
  setViewState: (...args: unknown[]) => mockSetViewState(...args),
  setGlobalState: (...args: unknown[]) => mockSetGlobalState(...args),
  initGlobalState: (...args: unknown[]) => mockInitGlobalState(...args),
}));

import { useTranslation } from '../useTranslation';

function makePlugin(id: string, description: string): MergedPlugin {
  const [name, marketplaceName] = id.split('@');
  return {
    id,
    name,
    marketplaceName,
    description,
    userInstall: null,
    projectInstalls: [],
    localInstall: null,
  };
}

describe('useTranslation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetViewState.mockImplementation((_key: string, fallback: unknown) => fallback);
  });

  afterEach(() => {
    cleanup();
  });

  it('偏好設定已有語言與 email 時，mount 後自動翻譯 plugin 文字', async () => {
    // initGlobalState 載入後 getViewState 回傳持久化值
    mockInitGlobalState.mockImplementation(async () => {
      mockGetViewState.mockImplementation((key: string, fallback: unknown) => {
        if (key === 'plugin.translateLang') return 'ja';
        if (key === 'plugin.translateEmail') return 'test@example.com';
        return fallback;
      });
      return { 'plugin.translateLang': 'ja', 'plugin.translateEmail': 'test@example.com' };
    });
    mockSendRequest.mockResolvedValue({
      translations: { 'Alpha description': 'Alpha translated' },
    });

    const { result } = renderHook(() => useTranslation([makePlugin('alpha@mp', 'Alpha description')]));

    await waitFor(() => {
      expect(result.current.translations).toEqual({ 'Alpha description': 'Alpha translated' });
    });
    expect(result.current.translateLang).toBe('ja');
    expect(result.current.translateEmail).toBe('test@example.com');
    expect(mockSendRequest).toHaveBeenCalledWith({
      type: 'plugin.translate',
      texts: ['Alpha description'],
      targetLang: 'ja',
      email: 'test@example.com',
    });
  });

  it('handleDialogConfirm 會持久化草稿設定並觸發翻譯', async () => {
    mockInitGlobalState.mockResolvedValue({});
    mockSendRequest.mockResolvedValue({
      translations: { 'Beta description': 'Beta zh-TW' },
    });
    const { result } = renderHook(() => useTranslation([makePlugin('beta@mp', 'Beta description')]));

    // 等待 ready
    await waitFor(() => {
      expect(mockInitGlobalState).toHaveBeenCalled();
    });

    await act(async () => {
      result.current.setDialogOpen(true);
      result.current.setDraftLang('zh-TW');
      result.current.setDraftEmail('me@example.com');
    });

    act(() => {
      result.current.handleDialogConfirm();
    });

    await waitFor(() => {
      expect(result.current.translateLang).toBe('zh-TW');
      expect(result.current.translateEmail).toBe('me@example.com');
      expect(result.current.dialogOpen).toBe(false);
      expect(result.current.translations).toEqual({ 'Beta description': 'Beta zh-TW' });
    });
    expect(mockSetViewState).toHaveBeenCalledWith('plugin.translateLang', 'zh-TW');
    expect(mockSetViewState).toHaveBeenCalledWith('plugin.translateEmail', 'me@example.com');
    expect(mockSetGlobalState).toHaveBeenCalledWith('plugin.translateLang', 'zh-TW');
    expect(mockSetGlobalState).toHaveBeenCalledWith('plugin.translateEmail', 'me@example.com');
  });

  it('quota warning 會清空 queued/active 狀態並保留 warning', async () => {
    mockInitGlobalState.mockImplementation(async () => {
      mockGetViewState.mockImplementation((key: string, fallback: unknown) => {
        if (key === 'plugin.translateLang') return 'ja';
        if (key === 'plugin.translateEmail') return 'warn@example.com';
        return fallback;
      });
      return { 'plugin.translateLang': 'ja', 'plugin.translateEmail': 'warn@example.com' };
    });
    mockSendRequest.mockResolvedValue({
      translations: {},
      warning: 'Translation quota exceeded (per-IP daily limit). Try again tomorrow, or use a different network.',
    });

    const { result } = renderHook(() => useTranslation([makePlugin('gamma@mp', 'Gamma description')]));

    await waitFor(() => {
      expect(result.current.translateWarning).toContain('per-IP');
    });
    expect(result.current.queuedTexts.size).toBe(0);
    expect(result.current.activeTexts.size).toBe(0);
  });

  it('retryTranslate 會用目前語言與 email 再送一次請求', async () => {
    mockInitGlobalState.mockImplementation(async () => {
      mockGetViewState.mockImplementation((key: string, fallback: unknown) => {
        if (key === 'plugin.translateLang') return 'ja';
        if (key === 'plugin.translateEmail') return 'retry@example.com';
        return fallback;
      });
      return { 'plugin.translateLang': 'ja', 'plugin.translateEmail': 'retry@example.com' };
    });
    mockSendRequest.mockResolvedValue({
      translations: { 'Retry description': 'Retry translated' },
    });

    const { result } = renderHook(() => useTranslation([makePlugin('retry@mp', 'Retry description')]));

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledTimes(1);
    });
    mockSendRequest.mockClear();

    await act(async () => {
      result.current.retryTranslate();
    });

    await waitFor(() => {
      expect(mockSendRequest).toHaveBeenCalledTimes(1);
    });
    expect(mockSendRequest).toHaveBeenCalledWith({
      type: 'plugin.translate',
      texts: ['Retry description'],
      targetLang: 'ja',
      email: 'retry@example.com',
    });
  });
});
