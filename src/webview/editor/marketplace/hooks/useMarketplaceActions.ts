import { useState, type Dispatch, type KeyboardEvent, type MouseEvent, type SetStateAction } from 'react';
import { sendRequest } from '../../../vscode';
import { usePageAction } from '../../../hooks/usePageAction';
import type { PreviewPlugin } from '../../../../shared/types';

type RetryAction = () => Promise<void>;

interface UseMarketplaceActionsOptions {
  fetchList: () => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
}

interface RetriableActionOptions<T> {
  action: () => Promise<T>;
  retry?: RetryAction;
  onSuccess?: (result: T) => Promise<void> | void;
  onFinally?: () => Promise<void> | void;
  successToast?: string | ((result: T) => string | null | undefined);
}

export function useMarketplaceActions({
  fetchList,
  setError,
}: UseMarketplaceActionsOptions): {
  addSource: string;
  setAddSource: Dispatch<SetStateAction<string>>;
  adding: boolean;
  updating: string | null;
  confirmRemove: string | null;
  setConfirmRemove: Dispatch<SetStateAction<string | null>>;
  retryAction: RetryAction | null;
  setRetryAction: Dispatch<SetStateAction<RetryAction | null>>;
  previewing: boolean;
  previewPlugins: PreviewPlugin[] | null;
  handlePreview: () => Promise<void>;
  handleClosePreview: () => void;
  handlePreviewOverlayDismiss: (
    event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>,
  ) => void;
  handleConfirmAdd: () => Promise<void>;
  handleAdd: (sourceOverride?: string) => Promise<void>;
  handleRemove: (name: string) => Promise<void>;
  handleUpdate: (name?: string) => Promise<void>;
  handleToggleAutoUpdate: (name: string) => Promise<void>;
} {
  const [addSource, setAddSource] = useState('');
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewPlugins, setPreviewPlugins] = useState<PreviewPlugin[] | null>(null);
  const [previewSource, setPreviewSource] = useState('');
  const runPageAction = usePageAction({ setError });

  async function refreshList(): Promise<void> {
    await fetchList();
  }

  async function runRetriableAction<T>({
    action,
    retry,
    onSuccess,
    onFinally,
    successToast,
  }: RetriableActionOptions<T>): Promise<void> {
    setRetryAction(null);
    await runPageAction({
      action,
      onSuccess,
      onError: retry
        ? (message) => {
          setError(message);
          setRetryAction(() => retry);
        }
        : undefined,
      onFinally,
      successToast,
    });
  }

  function handleClosePreview(): void {
    setPreviewPlugins(null);
    setPreviewSource('');
  }

  async function runAddMarketplace(source: string): Promise<void> {
    const normalizedSource = source.trim();
    if (!normalizedSource) {
      return;
    }

    setAdding(true);
    await runRetriableAction({
      action: () => sendRequest({ type: 'marketplace.add', source: normalizedSource }),
      retry: () => runAddMarketplace(normalizedSource),
      onSuccess: async () => {
        setAddSource('');
        await refreshList();
      },
      onFinally: () => {
        setAdding(false);
      },
      successToast: 'Marketplace added',
    });
  }

  async function handlePreview(): Promise<void> {
    const source = addSource.trim();
    if (!source) {
      return;
    }

    setPreviewing(true);
    setRetryAction(null);
    await runPageAction({
      action: () => sendRequest<PreviewPlugin[]>({ type: 'marketplace.preview', source }),
      onSuccess: (plugins) => {
        setPreviewPlugins(plugins);
        setPreviewSource(source);
      },
      onFinally: () => {
        setPreviewing(false);
      },
    });
  }

  function handlePreviewOverlayDismiss(
    event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>,
  ): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if ('preventDefault' in event) {
      event.preventDefault();
    }
    handleClosePreview();
  }

  async function handleConfirmAdd(): Promise<void> {
    const source = previewSource;
    handleClosePreview();
    await runAddMarketplace(source);
  }

  async function handleAdd(sourceOverride?: string): Promise<void> {
    await runAddMarketplace(sourceOverride ?? addSource);
  }

  async function handleRemove(name: string): Promise<void> {
    setConfirmRemove(null);
    await runRetriableAction({
      action: () => sendRequest({ type: 'marketplace.remove', name }),
      retry: () => handleRemove(name),
      onSuccess: refreshList,
      successToast: 'Marketplace removed',
    });
  }

  async function handleUpdate(name?: string): Promise<void> {
    setUpdating(name ?? '__all__');
    await runRetriableAction({
      action: () => sendRequest({ type: 'marketplace.update', name }),
      retry: () => handleUpdate(name),
      onSuccess: refreshList,
      onFinally: () => {
        setUpdating(null);
      },
      successToast: name ? `Updated ${name}` : 'All marketplaces updated',
    });
  }

  async function handleToggleAutoUpdate(name: string): Promise<void> {
    await runRetriableAction({
      action: () => sendRequest({ type: 'marketplace.toggleAutoUpdate', name }),
      retry: () => handleToggleAutoUpdate(name),
      onSuccess: refreshList,
    });
  }

  return {
    addSource,
    setAddSource,
    adding,
    updating,
    confirmRemove,
    setConfirmRemove,
    retryAction,
    setRetryAction,
    previewing,
    previewPlugins,
    handlePreview,
    handleClosePreview,
    handlePreviewOverlayDismiss,
    handleConfirmAdd,
    handleAdd,
    handleRemove,
    handleUpdate,
    handleToggleAutoUpdate,
  };
}
