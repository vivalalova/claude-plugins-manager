/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useFocusTrap } from '../useFocusTrap';

function FocusTrapDialog({
  onClose,
  active = true,
}: {
  onClose: () => void;
  active?: boolean;
}): React.ReactElement {
  const trapRef = useFocusTrap(onClose, active);

  return (
    <div ref={trapRef}>
      <button type="button">first</button>
      <button type="button">last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  afterEach(() => {
    cleanup();
  });

  it('啟用時自動 focus 第一個元素，卸載後還原先前 focus', () => {
    const opener = document.createElement('button');
    opener.textContent = 'open';
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<FocusTrapDialog onClose={vi.fn()} />);

    expect(document.activeElement).toBe(screen.getByText('first'));

    unmount();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('Tab 與 Shift+Tab 會在容器內循環 focus', () => {
    render(<FocusTrapDialog onClose={vi.fn()} />);
    const first = screen.getByText('first');
    const last = screen.getByText('last');
    const container = first.parentElement as HTMLElement;

    last.focus();
    fireEvent.keyDown(container, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(container, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('Escape 會呼叫 onClose', () => {
    const onClose = vi.fn();
    render(<FocusTrapDialog onClose={onClose} />);
    const container = screen.getByText('first').parentElement as HTMLElement;

    fireEvent.keyDown(container, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
