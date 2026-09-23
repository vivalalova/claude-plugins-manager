/**
 * #33 測試用 fake 擴展端：依檔案分 FIFO（user／project／local／claudeJson），讀寫同隊。
 * 每條佇列可先卡住再逐筆放行，放行時才套用寫入並回應，回應順序＝佇列順序（F4a）。
 * settings.get('user') 佔住 user 佇列再進 claudeJson 佇列（巢狀持有）；
 * user scope 的 globalConfig key 寫入改走 claudeJson 佇列；getGlobalConfigFallback 不排隊。
 *
 * 用法：測試檔以 `vi.mock('<相對路徑>/vscode', async () => (await import('<相對路徑>/__test-utils__/fakeSettingsBackend')).fakeVscodeModule)`
 * 接上，beforeEach 呼叫 installFakeSettingsBackend(初始檔案內容)。
 */
import { applyDeleteNested, applySetNested } from '../../shared/nestedSettings';
import {
  getFlatFieldSchema,
  getGlobalConfigFallbackSettingKeys,
  getGlobalConfigSettingKeys,
} from '../../shared/claude-settings-schema';

export type FakeLane = 'user' | 'project' | 'local' | 'claudeJson';
type SettingsScope = Exclude<FakeLane, 'claudeJson'>;
type JsonObject = Record<string, unknown>;

export interface FakeRequest {
  type: string;
  scope?: SettingsScope;
  key?: string;
  value?: unknown;
  parentKey?: string;
  childKey?: string;
  [extra: string]: unknown;
}

interface QueuedOp {
  msg: FakeRequest;
  run: () => Promise<void>;
  done: Promise<void>;
  settle: () => void;
}

interface Lane {
  pending: QueuedOp[];
  blocked: boolean;
  credits: number;
  running: boolean;
}

const LANES: FakeLane[] = ['user', 'project', 'local', 'claudeJson'];

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)) as T);

export interface FakeSettingsBackend {
  /** 接到 sendRequest 的處理函式 */
  handle: (msg: FakeRequest) => Promise<unknown>;
  /** 之後進該佇列的請求先卡住（已在執行的不受影響） */
  block: (lane: FakeLane) => void;
  /** 解除卡住並放行全部排隊中的請求，等它們都回應完 */
  unblock: (lane: FakeLane) => Promise<void>;
  /** 放行佇列最前面 n 筆，等它們回應完；排隊數不足直接拋錯 */
  release: (lane: FakeLane, n?: number) => Promise<void>;
  /** 佇列中尚未執行的請求（唯讀副本） */
  pending: (lane: FakeLane) => FakeRequest[];
  /** 檔案目前內容（深拷貝） */
  file: (lane: FakeLane) => JsonObject;
  /** 模擬外部改檔（不觸發回推） */
  setFile: (lane: FakeLane, content: JsonObject) => void;
  /** 讓該佇列之後第 skip+1 筆指定 type 的請求在執行時失敗 */
  failNext: (lane: FakeLane, type: string, options?: { skip?: number; message?: string }) => void;
  /** 依到達順序記錄的全部請求 */
  requests: FakeRequest[];
}

let current: FakeSettingsBackend | null = null;
const pushHandlers = new Set<(msg: { type: string; [key: string]: unknown }) => void>();

export function installFakeSettingsBackend(
  initial: Partial<Record<FakeLane, JsonObject>> = {},
  options: { hasWorkspace?: boolean } = {},
): FakeSettingsBackend {
  const hasWorkspace = options.hasWorkspace ?? true;
  const files: Record<FakeLane, JsonObject> = {
    user: clone(initial.user ?? {}),
    project: clone(initial.project ?? {}),
    local: clone(initial.local ?? {}),
    claudeJson: clone(initial.claudeJson ?? {}),
  };
  const lanes = Object.fromEntries(
    LANES.map((l): [FakeLane, Lane] => [l, { pending: [], blocked: false, credits: 0, running: false }]),
  ) as Record<FakeLane, Lane>;
  const failures: Array<{ lane: FakeLane; type: string; skip: number; message: string }> = [];
  const requests: FakeRequest[] = [];

  const pump = async (lane: FakeLane): Promise<void> => {
    const l = lanes[lane];
    if (l.running) return;
    l.running = true;
    try {
      while (l.pending.length > 0 && (!l.blocked || l.credits > 0)) {
        if (l.blocked) l.credits--;
        const op = l.pending.shift()!;
        try {
          await op.run();
        } finally {
          op.settle();
        }
      }
    } finally {
      l.running = false;
    }
  };

  const enqueue = <T>(lane: FakeLane, msg: FakeRequest, task: () => T | Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      let settle!: () => void;
      const done = new Promise<void>((r) => { settle = r; });
      const run = async (): Promise<void> => {
        const failIdx = failures.findIndex((f) => f.lane === lane && f.type === msg.type);
        if (failIdx >= 0 && failures[failIdx].skip > 0) {
          failures[failIdx].skip--;
        } else if (failIdx >= 0) {
          const [f] = failures.splice(failIdx, 1);
          reject(new Error(f.message));
          return;
        }
        // 任務拋錯即以 error 回應（比照 MessageRouter），佇列照常往下（比照 WriteQueue）
        await Promise.resolve().then(task).then((result) => resolve(clone(result)), reject);
      };
      lanes[lane].pending.push({ msg, run, done, settle });
      void pump(lane);
    });

  const isGlobalConfigKey = (scope: SettingsScope, key: string): boolean =>
    scope === 'user' && getFlatFieldSchema(key)?.storageFile === 'globalConfig';

  const requireScope = (msg: FakeRequest): SettingsScope => {
    if (msg.scope !== 'user' && msg.scope !== 'project' && msg.scope !== 'local') {
      throw new Error(`fakeSettingsBackend: ${msg.type} 缺 scope`);
    }
    return msg.scope;
  };

  const handle = (msg: FakeRequest): Promise<unknown> => {
    requests.push(clone(msg));
    switch (msg.type) {
      case 'workspace.getFolders':
        return Promise.resolve(hasWorkspace ? [{ name: 'ws', path: '/ws' }] : []);
      case 'settings.getGlobalConfigFallback': {
        const values: JsonObject = {};
        for (const key of getGlobalConfigFallbackSettingKeys()) {
          if (key in files.claudeJson) values[key] = clone(files.claudeJson[key]);
        }
        return Promise.resolve(values);
      }
      case 'settings.get': {
        const scope = requireScope(msg);
        return enqueue(scope, msg, async () => {
          const settings = clone(files[scope]);
          if (scope !== 'user') return settings;
          const globalConfig = await enqueue('claudeJson', msg, () => clone(files.claudeJson));
          for (const key of getGlobalConfigSettingKeys()) {
            if (key in globalConfig) settings[key] = globalConfig[key];
            else delete settings[key];
          }
          return settings;
        });
      }
      case 'settings.set': {
        const scope = requireScope(msg);
        const key = msg.key!;
        const lane: FakeLane = isGlobalConfigKey(scope, key) ? 'claudeJson' : scope;
        return enqueue(lane, msg, () => {
          files[lane] = { ...files[lane], [key]: clone(msg.value) };
          return undefined;
        });
      }
      case 'settings.delete': {
        const scope = requireScope(msg);
        const key = msg.key!;
        const lane: FakeLane = isGlobalConfigKey(scope, key) ? 'claudeJson' : scope;
        return enqueue(lane, msg, () => {
          const next = { ...files[lane] };
          delete next[key];
          files[lane] = next;
          return undefined;
        });
      }
      case 'settings.setNested': {
        const scope = requireScope(msg);
        return enqueue(scope, msg, () => {
          const { next } = applySetNested(
            files[scope],
            msg.parentKey as Parameters<typeof applySetNested>[1],
            msg.childKey!,
            clone(msg.value),
          );
          files[scope] = next as JsonObject;
          return undefined;
        });
      }
      case 'settings.deleteNested': {
        const scope = requireScope(msg);
        return enqueue(scope, msg, () => {
          const { next } = applyDeleteNested(
            files[scope],
            msg.parentKey as Parameters<typeof applyDeleteNested>[1],
            msg.childKey!,
          );
          files[scope] = next as JsonObject;
          return undefined;
        });
      }
      default:
        return Promise.resolve(null);
    }
  };

  const release = async (lane: FakeLane, n = 1): Promise<void> => {
    const l = lanes[lane];
    if (l.pending.length < n) {
      throw new Error(`fakeSettingsBackend: ${lane} 只有 ${l.pending.length} 筆排隊，無法放行 ${n} 筆`);
    }
    const targets = l.pending.slice(0, n).map((op) => op.done);
    if (l.blocked) l.credits += n;
    void pump(lane);
    await Promise.all(targets);
  };

  const backend: FakeSettingsBackend = {
    handle,
    block: (lane) => { lanes[lane].blocked = true; },
    unblock: async (lane) => {
      const targets = lanes[lane].pending.map((op) => op.done);
      lanes[lane].blocked = false;
      lanes[lane].credits = 0;
      void pump(lane);
      await Promise.all(targets);
    },
    release,
    pending: (lane) => lanes[lane].pending.map((op) => clone(op.msg)),
    file: (lane) => clone(files[lane]),
    setFile: (lane, content) => { files[lane] = clone(content); },
    failNext: (lane, type, options = {}) => {
      failures.push({ lane, type, skip: options.skip ?? 0, message: options.message ?? 'fake failure' });
    },
    requests,
  };
  current = backend;
  pushHandlers.clear();
  return backend;
}

/** 模擬 FileWatcher 推送（如 settings.refresh） */
export function emitPush(msg: { type: string; [key: string]: unknown }): void {
  for (const handler of [...pushHandlers]) handler(msg);
}

function requireBackend(): FakeSettingsBackend {
  if (!current) throw new Error('fakeSettingsBackend: 先呼叫 installFakeSettingsBackend()');
  return current;
}

/** 取代 src/webview/vscode.ts 的 mock 模組 */
export const fakeVscodeModule = {
  sendRequest: <T>(message: Record<string, unknown>): Promise<T> =>
    requireBackend().handle(message as FakeRequest) as Promise<T>,
  onPushMessage: (handler: (msg: { type: string; [key: string]: unknown }) => void): (() => void) => {
    pushHandlers.add(handler);
    return () => { pushHandlers.delete(handler); };
  },
  postMessage: (): void => {},
  getViewState: <T>(_key: string, fallback: T): T => fallback,
  setViewState: (): void => {},
  setGlobalState: (): Promise<void> => Promise.resolve(),
  initGlobalState: (): Promise<Record<string, unknown>> => Promise.resolve({}),
};
