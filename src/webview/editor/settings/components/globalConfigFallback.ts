import { createContext, useContext } from 'react';

/**
 * ~/.claude.json 備援值快照（schema 標記 globalConfigFallback 的 key）。
 * unknown＝載入中／失敗／回應不是物件；ready＝已讀到，values 只含檔案裡存在的標記 key。
 * 消費端只在 ready 時套用，未知時完全不影響顯示。
 */
export type GlobalConfigFallbackSnapshot =
  | { kind: 'unknown' }
  | { kind: 'ready'; values: Record<string, unknown> };

export const UNKNOWN_GLOBAL_CONFIG_FALLBACK: GlobalConfigFallbackSnapshot = { kind: 'unknown' };

/** 未包 provider（如單獨渲染 section 的測試）即為未知，等同快照尚未就緒。 */
export const GlobalConfigFallbackContext = createContext<GlobalConfigFallbackSnapshot>(UNKNOWN_GLOBAL_CONFIG_FALLBACK);

export function useGlobalConfigFallback(): GlobalConfigFallbackSnapshot {
  return useContext(GlobalConfigFallbackContext);
}

/** 把備援 request 的回應轉成快照：非物件（含 null、陣列）視為未知。 */
export function toGlobalConfigFallbackSnapshot(response: unknown): GlobalConfigFallbackSnapshot {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    return UNKNOWN_GLOBAL_CONFIG_FALLBACK;
  }
  return { kind: 'ready', values: response as Record<string, unknown> };
}
