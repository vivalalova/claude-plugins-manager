/** Extension 識別碼，用於所有 view/command 前綴 */
export const EXTENSION_ID = 'claude-plugins-manager';

/** Sidebar Webview view ID */
export const SIDEBAR_VIEW_ID = `${EXTENSION_ID}.sidebarView`;

/** 已註冊的 commands */
export const COMMANDS = {
  openMarketplace: `${EXTENSION_ID}.openMarketplace`,
  openPlugin: `${EXTENSION_ID}.openPlugin`,
  openMcp: `${EXTENSION_ID}.openMcp`,
} as const;

/** Editor panel 分類 */
export type PanelCategory = 'marketplace' | 'plugin' | 'mcp';

/** 分類對應的顯示名稱 */
export const PANEL_TITLES: Record<PanelCategory, string> = {
  marketplace: 'Marketplaces Manager',
  plugin: 'Plugins Manager',
  mcp: 'MCP Servers Manager',
};

/** CLI 預設 timeout（毫秒） */
export const CLI_TIMEOUT_MS = 30_000;

/** 需要較長時間的操作 timeout（毫秒） */
export const CLI_LONG_TIMEOUT_MS = 60_000;

/** CLI 自動重試次數上限（不含初始嘗試，總執行次數 = MAX_RETRIES + 1） */
export const CLI_MAX_RETRIES = 3;

/** CLI 重試基礎退避時間（毫秒），指數退避：1s → 2s → 4s */
export const CLI_BASE_BACKOFF_MS = 1_000;

/** 可重試的系統錯誤碼（暫時性網路/連線問題） */
export const CLI_RETRYABLE_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN']);

/** MCP 狀態輪詢間隔（毫秒）— fallback，主要由 FileWatcher 驅動 */
export const MCP_POLL_INTERVAL_MS = 60_000;
