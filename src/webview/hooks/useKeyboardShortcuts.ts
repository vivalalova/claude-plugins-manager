import { useEffect, useCallback, useState, useRef } from 'react';
import type React from 'react';

interface KeyboardShortcutsOptions {
  /** 搜尋 input 的 ref（`/` 聚焦用） */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Escape 清空搜尋的 callback */
  onSearchClear?: () => void;
  /** card 選擇器（j/k 導航用） */
  cardSelector?: string;
}

/**
 * 頁面級鍵盤快捷鍵 hook。
 * 支援：`/` 聚焦搜尋、`Escape` 清空搜尋或關閉 help、`j/k` 導航 card、
 * `Enter` 展開 card、`?` 切換快捷鍵說明。
 * 在 input/textarea/select focus 時停用單鍵快捷鍵。
 * dialog 開啟時（aria-modal）不處理快捷鍵。
 */
export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}): {
  showHelp: boolean;
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>;
} {
  const [showHelp, setShowHelp] = useState(false);

  // Ref 包裝 showHelp 和 callbacks，避免 useCallback deps 變動觸發重複 subscribe
  const showHelpRef = useRef(showHelp);
  showHelpRef.current = showHelp;
  const onSearchClearRef = useRef(options.onSearchClear);
  onSearchClearRef.current = options.onSearchClear;
  const searchInputRefRef = useRef(options.searchInputRef);
  searchInputRefRef.current = options.searchInputRef;
  const cardSelectorRef = useRef(options.cardSelector);
  cardSelectorRef.current = options.cardSelector;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const tagName = target.tagName;
    const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';

    // Escape in search input → clear + blur
    if (isInput && e.key === 'Escape') {
      if (tagName === 'INPUT' && searchInputRefRef.current?.current === target) {
        onSearchClearRef.current?.();
        (target as HTMLInputElement).blur();
        e.preventDefault();
      }
      return;
    }

    // 在 input 中時不處理單鍵快捷鍵
    if (isInput) return;
    // dialog 開啟時（aria-modal）不處理
    if (document.querySelector('[aria-modal="true"]')) return;

    switch (e.key) {
      case '/': {
        e.preventDefault();
        searchInputRefRef.current?.current?.focus();
        break;
      }
      case '?': {
        e.preventDefault();
        setShowHelp((v) => !v);
        break;
      }
      case 'j':
      case 'k': {
        const cardSelector = cardSelectorRef.current;
        if (!cardSelector) break;
        e.preventDefault();
        const cards = Array.from(document.querySelectorAll<HTMLElement>(cardSelector))
          .filter((c) => c.offsetParent !== null);
        if (cards.length === 0) break;
        const currentIdx = cards.findIndex((c) => c === document.activeElement);
        let nextIdx: number;
        if (e.key === 'j') {
          nextIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, cards.length - 1);
        } else {
          nextIdx = currentIdx < 0 ? cards.length - 1 : Math.max(currentIdx - 1, 0);
        }
        cards[nextIdx].focus();
        break;
      }
      case 'Enter': {
        // card 上按 Enter → toggle expand（dialog 開啟時不處理）
        if (!document.querySelector('[aria-modal="true"]') && document.activeElement?.classList.contains('card')) {
          e.preventDefault();
          (document.activeElement as HTMLElement).click();
        }
        break;
      }
    }
  }, []); // 穩定 reference，所有 mutable state 透過 ref 讀取

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}
