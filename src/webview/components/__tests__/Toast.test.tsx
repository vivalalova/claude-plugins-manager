/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '../../__test-utils__/renderWithProviders';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';

/** 測試用元件：透過按鈕觸發 addToast */
function TestComponent({ message = 'Test message', variant = 'success' as const }: {
  message?: string;
  variant?: 'success' | 'error' | 'info';
}) {
  const { addToast } = useToast();
  return (
    <button onClick={() => addToast(message, variant)}>
      Add Toast
    </button>
  );
}

describe('Toast 系統', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('addToast 顯示 toast 訊息', () => {
    renderWithI18n(
      <ToastProvider>
        <TestComponent message="Hello toast" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));
    expect(screen.getByText('Hello toast')).toBeTruthy();
  });

  it('success variant 顯示 ✅ icon', () => {
    renderWithI18n(
      <ToastProvider>
        <TestComponent message="Done" variant="success" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));
    const toastItem = screen.getByRole('status');
    expect(toastItem.className).toContain('toast-item--success');
    expect(toastItem.textContent).toContain('✅');
  });

  it('error variant 顯示 ❌ icon', () => {
    renderWithI18n(
      <ToastProvider>
        <TestComponent message="Error!" variant="error" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));
    const toastItem = screen.getByRole('alert');
    expect(toastItem.className).toContain('toast-item--error');
    expect(toastItem.textContent).toContain('❌');
  });

  it('info variant 顯示 ℹ icon', () => {
    renderWithI18n(
      <ToastProvider>
        <TestComponent message="Info" variant="info" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));
    const toastItem = screen.getByRole('status');
    expect(toastItem.className).toContain('toast-item--info');
    expect(toastItem.textContent).toContain('ℹ');
  });

  it('5 秒後 toast 開始 fade-out 動畫（加上 --exiting class）', async () => {
    renderWithI18n(
      <ToastProvider>
        <TestComponent message="Fading out" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));
    expect(screen.getByText('Fading out')).toBeTruthy();

    // 5 秒後觸發 dismiss
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    const toastItem = screen.getByRole('status');
    expect(toastItem.className).toContain('toast-item--exiting');
  });

  it('5 秒 + 300ms fade-out 後 toast 從 DOM 移除', async () => {
    renderWithI18n(
      <ToastProvider>
        <TestComponent message="Gone" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));

    await act(async () => {
      vi.advanceTimersByTime(5300); // 5000ms + 300ms fade-out
    });

    expect(screen.queryByText('Gone')).toBeNull();
  });

  it('close 按鈕點擊後開始 fade-out', async () => {
    renderWithI18n(
      <ToastProvider>
        <TestComponent message="Close me" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));

    const closeBtn = screen.getByRole('button', { name: 'Dismiss notification' });
    fireEvent.click(closeBtn);

    const toastItem = screen.getByRole('status');
    expect(toastItem.className).toContain('toast-item--exiting');
  });

  it('close 按鈕點擊後 300ms 內從 DOM 移除', async () => {
    renderWithI18n(
      <ToastProvider>
        <TestComponent message="Closing" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Closing')).toBeNull();
  });

  it('最多 3 個同時顯示，新增第 4 個時移除最舊的', () => {
    /** 可觸發多個不同訊息的元件 */
    function MultiToastComponent() {
      const { addToast } = useToast();
      return (
        <>
          <button onClick={() => addToast('Toast 1')}>T1</button>
          <button onClick={() => addToast('Toast 2')}>T2</button>
          <button onClick={() => addToast('Toast 3')}>T3</button>
          <button onClick={() => addToast('Toast 4')}>T4</button>
        </>
      );
    }

    renderWithI18n(
      <ToastProvider>
        <MultiToastComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'T1' }));
    fireEvent.click(screen.getByRole('button', { name: 'T2' }));
    fireEvent.click(screen.getByRole('button', { name: 'T3' }));
    fireEvent.click(screen.getByRole('button', { name: 'T4' }));

    // 最舊的 Toast 1 應被移除
    expect(screen.queryByText('Toast 1')).toBeNull();
    // Toast 2, 3, 4 應存在
    expect(screen.getByText('Toast 2')).toBeTruthy();
    expect(screen.getByText('Toast 3')).toBeTruthy();
    expect(screen.getByText('Toast 4')).toBeTruthy();
  });

  it('hover 暫停計時器，離開後繼續計時', async () => {
    renderWithI18n(
      <ToastProvider>
        <TestComponent message="Hover test" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Toast' }));
    const toastItem = screen.getByRole('status');

    // 前進 2 秒，然後 hover
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    fireEvent.mouseEnter(toastItem);

    // hover 中，再等 5 秒仍不應消失
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Hover test')).toBeTruthy();
    const afterHover = screen.getByRole('status');
    expect(afterHover.className).not.toContain('toast-item--exiting');

    // mouse leave，剩餘時間 ~3 秒
    fireEvent.mouseLeave(toastItem);

    // 等剩餘時間
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    const afterLeave = screen.getByRole('status');
    expect(afterLeave.className).toContain('toast-item--exiting');
  });

  it('useToast 在 ToastProvider 外呼叫時拋出錯誤', () => {
    function OutsideComponent() {
      useToast();
      return null;
    }

    // 抑制 React error boundary 的 console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderWithI18n(<OutsideComponent />)).toThrow('useToast must be used within a ToastProvider');

    consoleSpy.mockRestore();
  });
});
