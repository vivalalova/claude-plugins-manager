/**
 * VSCode Webview API 封裝。
 * 提供 Promise-based 的 sendRequest 和 push message 訂閱。
 */

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

/** 全域唯一的 VSCode API 實例 */
const vscode = acquireVsCodeApi();

/** pending requests 等待 response 配對 */
let requestIdCounter = 0;
const pendingRequests = new Map<string, {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
}>();

/** push message 訂閱者 */
type PushHandler = (message: { type: string; [key: string]: unknown }) => void;
const pushHandlers = new Set<PushHandler>();

/** 監聽 extension host 回傳的訊息 */
window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data;
  if (!msg || typeof msg.type !== 'string') {
    return;
  }

  // 配對 response
  if (msg.type === 'response' && pendingRequests.has(msg.requestId)) {
    pendingRequests.get(msg.requestId)!.resolve(msg.data);
    pendingRequests.delete(msg.requestId);
    return;
  }

  // 配對 error
  if (msg.type === 'error' && pendingRequests.has(msg.requestId)) {
    pendingRequests.get(msg.requestId)!.reject(new Error(msg.error));
    pendingRequests.delete(msg.requestId);
    return;
  }

  // push message（如 mcp.statusUpdate）
  for (const handler of pushHandlers) {
    handler(msg);
  }
});

/** 發送 request 到 extension host，回傳 Promise（30 秒 timeout） */
export function sendRequest<T>(
  message: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<T> {
  const requestId = String(++requestIdCounter);
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Request timeout after ${timeoutMs}ms: ${message.type ?? 'unknown'}`));
    }, timeoutMs);

    pendingRequests.set(requestId, {
      resolve: (data: unknown) => {
        clearTimeout(timeoutId);
        resolve(data as T);
      },
      reject: (error: Error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    });
    vscode.postMessage({ ...message, requestId });
  });
}

/** 訂閱 push message（如 MCP 狀態更新），回傳 unsubscribe 函式 */
export function onPushMessage(handler: PushHandler): () => void {
  pushHandlers.add(handler);
  return () => pushHandlers.delete(handler);
}

/** 直接 postMessage（用於 sidebar 導航等不需 response 的場景） */
export function postMessage(message: Record<string, unknown>): void {
  vscode.postMessage(message);
}

/** 從 webview 持久化 state 讀取指定 key，不存在時回傳 fallback */
export function getViewState<T>(key: string, fallback: T): T {
  const state = vscode.getState() as Record<string, unknown> | null;
  if (!state || !(key in state)) return fallback;
  return state[key] as T;
}

/** 將值寫入 webview 持久化 state 的指定 key（合併既有 state） */
export function setViewState<T>(key: string, value: T): void {
  const state = (vscode.getState() as Record<string, unknown>) ?? {};
  vscode.setState({ ...state, [key]: value });
}
