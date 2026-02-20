/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/* ── Mock vscode ── */
vi.mock('../../vscode', () => ({
  sendRequest: vi.fn(),
  onMessage: vi.fn(),
}));

import { KeyboardHelpOverlay } from '../KeyboardHelpOverlay';

describe('KeyboardHelpOverlay', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('渲染所有快捷鍵項目', () => {
    render(<KeyboardHelpOverlay onClose={vi.fn()} />);

    expect(screen.getByText('/')).toBeTruthy();
    expect(screen.getByText('Escape')).toBeTruthy();
    expect(screen.getByText('j')).toBeTruthy();
    expect(screen.getByText('k')).toBeTruthy();
    expect(screen.getByText('Enter')).toBeTruthy();
    expect(screen.getByText('?')).toBeTruthy();
    expect(screen.getByText('Focus search')).toBeTruthy();
    expect(screen.getByText('Toggle this help')).toBeTruthy();
  });

  it('Close 按鈕呼叫 onClose', () => {
    const onClose = vi.fn();
    render(<KeyboardHelpOverlay onClose={onClose} />);

    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('點擊 overlay 背景呼叫 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<KeyboardHelpOverlay onClose={onClose} />);

    const overlay = container.querySelector('.confirm-overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('點擊 dialog 內部不呼叫 onClose', () => {
    const onClose = vi.fn();
    render(<KeyboardHelpOverlay onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('role="dialog" 和 aria-modal="true"', () => {
    render(<KeyboardHelpOverlay onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('keyboard-help-title');
  });
});
