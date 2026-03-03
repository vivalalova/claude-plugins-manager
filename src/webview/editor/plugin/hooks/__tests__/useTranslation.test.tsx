/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { MergedPlugin } from '../../../../../shared/types';

const { mockSendRequest } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
}));

vi.mock('../../../../vscode', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
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
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('localStorage 內已有語言與 email 時，mount 後自動翻譯 plugin 文字', async () => {
    localStorage.setItem('plugin.translateLang', 'ja');
    localStorage.setItem('plugin.translateEmail', 'test@example.com');
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
    mockSendRequest.mockResolvedValue({
      translations: { 'Beta description': 'Beta zh-TW' },
    });
    const { result } = renderHook(() => useTranslation([makePlugin('beta@mp', 'Beta description')]));

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
    expect(localStorage.getItem('plugin.translateLang')).toBe('zh-TW');
    expect(localStorage.getItem('plugin.translateEmail')).toBe('me@example.com');
  });

  it('quota warning 會清空 queued/active 狀態並保留 warning', async () => {
    localStorage.setItem('plugin.translateLang', 'ja');
    localStorage.setItem('plugin.translateEmail', 'warn@example.com');
    mockSendRequest.mockResolvedValue({
      translations: {},
      warning: 'Daily translation quota exceeded',
    });

    const { result } = renderHook(() => useTranslation([makePlugin('gamma@mp', 'Gamma description')]));

    await waitFor(() => {
      expect(result.current.translateWarning).toBe('Daily translation quota exceeded');
    });
    expect(result.current.queuedTexts.size).toBe(0);
    expect(result.current.activeTexts.size).toBe(0);
  });

  it('retryTranslate 會用目前語言與 email 再送一次請求', async () => {
    localStorage.setItem('plugin.translateLang', 'ja');
    localStorage.setItem('plugin.translateEmail', 'retry@example.com');
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
