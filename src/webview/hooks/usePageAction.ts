import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useToast } from '../components/Toast';
import { toErrorMessage } from '../../shared/errorUtils';

interface RunPageActionOptions<T> {
  clearError?: boolean;
  action: () => Promise<T>;
  onSuccess?: (result: T) => Promise<void> | void;
  onError?: (message: string, error: unknown) => Promise<void> | void;
  onFinally?: () => Promise<void> | void;
  successToast?: string | ((result: T) => string | null | undefined);
}

interface UsePageActionOptions {
  setError?: Dispatch<SetStateAction<string | null>>;
}

/**
 * Shared page action runner for webview pages.
 * Centralizes error clearing, toast success, and default error propagation.
 */
export function usePageAction({ setError }: UsePageActionOptions = {}): <T>(options: RunPageActionOptions<T>) => Promise<T | undefined> {
  const { addToast } = useToast();

  return useCallback(async <T,>({
    clearError = true,
    action,
    onSuccess,
    onError,
    onFinally,
    successToast,
  }: RunPageActionOptions<T>): Promise<T | undefined> => {
    if (clearError) {
      setError?.(null);
    }

    try {
      const result = await action();
      await onSuccess?.(result);

      const message = typeof successToast === 'function'
        ? successToast(result)
        : successToast;
      if (message) {
        addToast(message, 'success');
      }

      return result;
    } catch (error) {
      const message = toErrorMessage(error);
      if (onError) {
        await onError(message, error);
      } else {
        setError?.(message);
      }
      return undefined;
    } finally {
      await onFinally?.();
    }
  }, [addToast, setError]);
}
