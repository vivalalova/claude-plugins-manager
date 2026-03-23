import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { toErrorMessage } from '../../shared/errorUtils';
import { useDebouncedValue } from './useDebounce';

interface UseRemoteListQueryOptions<T> {
  enabled: boolean;
  query: string;
  debounceMs?: number;
  minQueryLength?: number;
  load: (query: string) => Promise<T[]>;
  getCacheKey?: (query: string) => string | null;
}

interface UseRemoteListQueryResult<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  activeQuery: string;
  setError: Dispatch<SetStateAction<string | null>>;
  clearCache: () => void;
}

/**
 * Shared remote list query state: debounce, stale-response protection, and optional cache.
 */
export function useRemoteListQuery<T>({
  enabled,
  query,
  debounceMs = 0,
  minQueryLength = 0,
  load,
  getCacheKey,
}: UseRemoteListQueryOptions<T>): UseRemoteListQueryResult<T> {
  const [debouncedQuery] = useDebouncedValue(query, debounceMs);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);
  const cacheRef = useRef<Map<string, T[]>>(new Map());

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  useEffect(() => {
    const normalizedQuery = debouncedQuery.trim();

    if (!enabled) {
      latestRequestIdRef.current++;
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (normalizedQuery.length < minQueryLength) {
      latestRequestIdRef.current++;
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    const cacheKey = getCacheKey?.(normalizedQuery) ?? null;
    if (cacheKey) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setItems(cached);
        setLoading(false);
        setError(null);
        return;
      }
    }

    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    setError(null);

    void load(normalizedQuery)
      .then((nextItems) => {
        if (requestId !== latestRequestIdRef.current) {
          return;
        }
        if (cacheKey) {
          cacheRef.current.set(cacheKey, nextItems);
        }
        setItems(nextItems);
      })
      .catch((requestError) => {
        if (requestId !== latestRequestIdRef.current) {
          return;
        }
        setError(toErrorMessage(requestError));
      })
      .finally(() => {
        if (requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      });
  }, [debouncedQuery, enabled, getCacheKey, load, minQueryLength]);

  return {
    items,
    loading,
    error,
    activeQuery: debouncedQuery.trim(),
    setError,
    clearCache,
  };
}
