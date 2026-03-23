import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { onPushMessage } from '../vscode';
import { toErrorMessage } from '../../shared/errorUtils';

interface PushMessage {
  type?: string;
  [key: string]: unknown;
}

export interface UsePushSyncedResourceOptions<T> {
  initialData: T;
  load: () => Promise<T>;
  pushFilter?: (message: PushMessage) => boolean;
}

export interface UsePushSyncedResourceResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  setData: Dispatch<SetStateAction<T>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refresh: (showSpinner?: boolean) => Promise<void>;
}

/**
 * 管理需要初始載入 + push message 靜默刷新的資料源。
 * 以 request id 避免較舊回應覆寫較新的結果。
 */
export function usePushSyncedResource<T>({
  initialData,
  load,
  pushFilter,
}: UsePushSyncedResourceOptions<T>): UsePushSyncedResourceResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);

  const refresh = useCallback(async (showSpinner = true) => {
    const requestId = ++latestRequestIdRef.current;
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);

    try {
      const nextData = await load();
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setData(nextData);
    } catch (e) {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setError(toErrorMessage(e));
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pushFilter) {
      return;
    }
    return onPushMessage((message) => {
      if (pushFilter(message as PushMessage)) {
        void refresh(false);
      }
    });
  }, [pushFilter, refresh]);

  return {
    data,
    loading,
    error,
    setData,
    setError,
    refresh,
  };
}
