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

/** MCP 狀態輪詢間隔（毫秒） */
export const MCP_POLL_INTERVAL_MS = 15_000;
