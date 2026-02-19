/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog accessibility', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('role="dialog" + aria-modal + aria-labelledby', () => {
    render(
      <ConfirmDialog
        title="Delete Item"
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(document.getElementById(titleId!)).toBeTruthy();
    expect(document.getElementById(titleId!)!.textContent).toBe('Delete Item');
  });

  it('mount 時 auto-focus 第一個按鈕', () => {
    render(
      <ConfirmDialog
        title="Test"
        message="msg"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    // 第一個 focusable = Cancel button
    expect(document.activeElement).toBe(screen.getByText('Cancel'));
  });

  it('Escape 關閉 dialog', () => {
    render(
      <ConfirmDialog
        title="Test"
        message="msg"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Tab focus trap：最後元素 Tab → 回到第一個', () => {
    render(
      <ConfirmDialog
        title="Test"
        message="msg"
        confirmLabel="OK"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const cancelBtn = screen.getByText('Cancel');
    const confirmBtn = screen.getByText('OK');

    // Focus 在最後一個元素（Confirm）
    confirmBtn.focus();
    expect(document.activeElement).toBe(confirmBtn);

    // 按 Tab → 應回到第一個（Cancel）
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('Shift+Tab focus trap：第一個元素 Shift+Tab → 到最後一個', () => {
    render(
      <ConfirmDialog
        title="Test"
        message="msg"
        confirmLabel="OK"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole('dialog');
    const cancelBtn = screen.getByText('Cancel');
    const confirmBtn = screen.getByText('OK');

    // Focus 在第一個元素
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);

    // 按 Shift+Tab → 應到最後一個
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmBtn);
  });

  it('unmount 時 focus 返回先前元素', () => {
    // 建立 trigger button
    const container = document.createElement('div');
    document.body.appendChild(container);
    const triggerBtn = document.createElement('button');
    triggerBtn.textContent = 'Open';
    container.appendChild(triggerBtn);
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    const { unmount } = render(
      <ConfirmDialog
        title="Test"
        message="msg"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    // dialog open → focus 移到 dialog
    expect(document.activeElement).not.toBe(triggerBtn);

    // unmount → focus 返回 trigger
    unmount();
    expect(document.activeElement).toBe(triggerBtn);

    document.body.removeChild(container);
  });
});
