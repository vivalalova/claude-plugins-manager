/**
 * @vitest-environment jsdom
 */
import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

function fireKeyDown(key: string, target: Element = document.body): void {
  fireEvent.keyDown(target, { key, bubbles: true });
}

/** jsdom 不實作 offsetParent，手動模擬為 visible */
function makeVisible(el: HTMLElement): void {
  Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
}

describe('useKeyboardShortcuts', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('/ 鍵 → search input 獲得 focus', () => {
    const inputEl = document.createElement('input');
    document.body.appendChild(inputEl);
    const ref = { current: inputEl };
    const focusSpy = vi.spyOn(inputEl, 'focus');

    renderHook(() => useKeyboardShortcuts({ searchInputRef: ref }));

    act(() => {
      fireKeyDown('/');
    });

    expect(focusSpy).toHaveBeenCalledTimes(1);
    document.body.removeChild(inputEl);
  });

  it('Escape 在 search input 中 → 呼叫 onSearchClear + blur', () => {
    const inputEl = document.createElement('input');
    document.body.appendChild(inputEl);
    const ref = { current: inputEl };
    const onSearchClear = vi.fn();
    const blurSpy = vi.spyOn(inputEl, 'blur');

    renderHook(() => useKeyboardShortcuts({ searchInputRef: ref, onSearchClear }));

    act(() => {
      inputEl.focus();
      fireKeyDown('Escape', inputEl);
    });

    expect(onSearchClear).toHaveBeenCalledTimes(1);
    expect(blurSpy).toHaveBeenCalledTimes(1);
    document.body.removeChild(inputEl);
  });

  it('j → focus 下一張 card', () => {
    const card1 = document.createElement('div');
    const card2 = document.createElement('div');
    card1.className = 'card';
    card2.className = 'card';
    card1.setAttribute('tabindex', '0');
    card2.setAttribute('tabindex', '0');
    makeVisible(card1);
    makeVisible(card2);
    document.body.appendChild(card1);
    document.body.appendChild(card2);

    const focusSpy2 = vi.spyOn(card2, 'focus');

    renderHook(() => useKeyboardShortcuts({ cardSelector: '.card[tabindex]' }));

    act(() => {
      card1.focus();
      fireKeyDown('j');
    });

    expect(focusSpy2).toHaveBeenCalledTimes(1);
    document.body.removeChild(card1);
    document.body.removeChild(card2);
  });

  it('k → focus 上一張 card', () => {
    const card1 = document.createElement('div');
    const card2 = document.createElement('div');
    card1.className = 'card';
    card2.className = 'card';
    card1.setAttribute('tabindex', '0');
    card2.setAttribute('tabindex', '0');
    makeVisible(card1);
    makeVisible(card2);
    document.body.appendChild(card1);
    document.body.appendChild(card2);

    const focusSpy1 = vi.spyOn(card1, 'focus');

    renderHook(() => useKeyboardShortcuts({ cardSelector: '.card[tabindex]' }));

    act(() => {
      card2.focus();
      fireKeyDown('k');
    });

    expect(focusSpy1).toHaveBeenCalledTimes(1);
    document.body.removeChild(card1);
    document.body.removeChild(card2);
  });

  it('? → showHelp 切換為 true', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());

    expect(result.current.showHelp).toBe(false);

    act(() => {
      fireKeyDown('?');
    });

    expect(result.current.showHelp).toBe(true);
  });

  it('? 再按一次 → showHelp 切換為 false', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());

    act(() => {
      fireKeyDown('?');
    });
    expect(result.current.showHelp).toBe(true);

    act(() => {
      fireKeyDown('?');
    });
    expect(result.current.showHelp).toBe(false);
  });

  it('在 input 中按 j → 不觸發快捷鍵', () => {
    const card1 = document.createElement('div');
    const card2 = document.createElement('div');
    card1.className = 'card';
    card2.className = 'card';
    card1.setAttribute('tabindex', '0');
    card2.setAttribute('tabindex', '0');
    makeVisible(card1);
    makeVisible(card2);
    document.body.appendChild(card1);
    document.body.appendChild(card2);

    const focusSpy2 = vi.spyOn(card2, 'focus');
    const inputEl = document.createElement('input');
    document.body.appendChild(inputEl);

    renderHook(() => useKeyboardShortcuts({ cardSelector: '.card[tabindex]' }));

    act(() => {
      card1.focus();
      inputEl.focus();
      fireKeyDown('j', inputEl);
    });

    expect(focusSpy2).not.toHaveBeenCalled();
    document.body.removeChild(card1);
    document.body.removeChild(card2);
    document.body.removeChild(inputEl);
  });

  it('在 input 中按 ? → 不切換 showHelp', () => {
    const inputEl = document.createElement('input');
    document.body.appendChild(inputEl);

    const { result } = renderHook(() => useKeyboardShortcuts());

    act(() => {
      inputEl.focus();
      fireKeyDown('?', inputEl);
    });

    expect(result.current.showHelp).toBe(false);
    document.body.removeChild(inputEl);
  });

  it('在 input 中按 / → 不觸發快捷鍵', () => {
    const inputEl = document.createElement('input');
    const searchEl = document.createElement('input');
    document.body.appendChild(inputEl);
    document.body.appendChild(searchEl);
    const ref = { current: searchEl };
    const focusSpy = vi.spyOn(searchEl, 'focus');

    renderHook(() => useKeyboardShortcuts({ searchInputRef: ref }));

    act(() => {
      inputEl.focus();
      fireKeyDown('/', inputEl);
    });

    expect(focusSpy).not.toHaveBeenCalled();
    document.body.removeChild(inputEl);
    document.body.removeChild(searchEl);
  });

  it('Enter 在 card 上 → 觸發 click', () => {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('tabindex', '0');
    makeVisible(card);
    document.body.appendChild(card);
    const clickSpy = vi.fn();
    card.addEventListener('click', clickSpy);

    renderHook(() => useKeyboardShortcuts({ cardSelector: '.card[tabindex]' }));

    act(() => {
      card.focus();
      fireKeyDown('Enter', card);
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    document.body.removeChild(card);
  });

  it('dialog 開啟時（aria-modal）不觸發 j/k 快捷鍵', () => {
    const card1 = document.createElement('div');
    const card2 = document.createElement('div');
    card1.className = 'card';
    card2.className = 'card';
    card1.setAttribute('tabindex', '0');
    card2.setAttribute('tabindex', '0');
    makeVisible(card1);
    makeVisible(card2);
    document.body.appendChild(card1);
    document.body.appendChild(card2);

    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);

    const focusSpy2 = vi.spyOn(card2, 'focus');

    renderHook(() => useKeyboardShortcuts({ cardSelector: '.card[tabindex]' }));

    act(() => {
      card1.focus();
      fireKeyDown('j');
    });

    expect(focusSpy2).not.toHaveBeenCalled();
    document.body.removeChild(card1);
    document.body.removeChild(card2);
    document.body.removeChild(dialog);
  });

  it('dialog 開啟時（aria-modal）不觸發 Enter 快捷鍵', () => {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('tabindex', '0');
    makeVisible(card);
    document.body.appendChild(card);

    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);

    const clickSpy = vi.fn();
    card.addEventListener('click', clickSpy);

    renderHook(() => useKeyboardShortcuts({ cardSelector: '.card[tabindex]' }));

    act(() => {
      card.focus();
      fireKeyDown('Enter', card);
    });

    expect(clickSpy).not.toHaveBeenCalled();
    document.body.removeChild(card);
    document.body.removeChild(dialog);
  });
});
