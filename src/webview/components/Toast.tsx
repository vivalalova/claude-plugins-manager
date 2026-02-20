import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

/** Toast 外觀類型 */
export type ToastVariant = 'success' | 'error' | 'info';

/** 單一 Toast 資料 */
interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

/** Toast Context 型別 */
interface ToastContextValue {
  /** 顯示一條 toast 通知 */
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** 最多同時顯示的 toast 數量 */
const MAX_TOASTS = 3;

/** Toast 自動消失時間（ms） */
const AUTO_DISMISS_MS = 5_000;

/** Toast fade-out 動畫時間（ms） */
const FADE_OUT_MS = 300;

/** Variant icon 對應表 */
const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ',
};

/** Variant → ARIA role 對應（error 用 alert 立即通知，其餘用 status） */
const VARIANT_ROLES: Record<ToastVariant, string> = {
  success: 'status',
  error: 'alert',
  info: 'status',
};

let nextId = 1;

/** 取得下一個遞增 id */
function getNextId(): number {
  return nextId++;
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: number) => void;
}

/**
 * 單一 Toast 卡片元件。
 * 5 秒自動消失，hover 暫停計時器，fade-out 動畫後移除 DOM。
 */
function ToastItem({ toast, onRemove }: ToastItemProps): React.ReactElement {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** fade-out 結束後移除 DOM 的 timer */
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(AUTO_DISMISS_MS);
  const startedAtRef = useRef<number>(Date.now());
  /** ref 追蹤 exiting 狀態，避免 stale closure 問題 */
  const exitingRef = useRef(false);

  const dismiss = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    fadeTimerRef.current = setTimeout(() => onRemove(toast.id), FADE_OUT_MS);
  }, [onRemove, toast.id]);

  const startTimer = useCallback(() => {
    if (exitingRef.current) return;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(dismiss, remainingRef.current);
  }, [dismiss]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    }
  }, []);

  // 元件 mount 時啟動計時器，unmount 時清除所有 timer
  React.useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [startTimer]);

  return (
    <div
      className={`toast-item toast-item--${toast.variant}${exiting ? ' toast-item--exiting' : ''}`}
      role={VARIANT_ROLES[toast.variant]}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
    >
      <span className="toast-item__icon" aria-hidden="true">
        {VARIANT_ICONS[toast.variant]}
      </span>
      <span className="toast-item__message">{toast.message}</span>
      <button
        type="button"
        className="toast-item__close"
        aria-label="Dismiss notification"
        onClick={dismiss}
      >
        &#x2715;
      </button>
    </div>
  );
}

/**
 * Toast 容器：fixed bottom-right，渲染所有 toast items。
 */
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }): React.ReactElement {
  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

/**
 * ToastProvider：包住 children，提供 addToast，並渲染 ToastContainer。
 * 最多同時顯示 3 個 toast，超過時移除最舊的。
 */
export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToasts((prev) => {
      const next: Toast[] = [...prev, { id: getNextId(), message, variant }];
      // 超過上限時移除最舊的
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * 取得 toast addToast 函數。
 * 必須在 ToastProvider 內使用，否則拋出錯誤。
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
