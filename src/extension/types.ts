/**
 * Extension-only 型別（CliError）。
 * 共用型別統一從 shared/types.ts 匯出。
 */

export type {
  Marketplace,
  MarketplaceSourceType,
  PluginScope,
  PluginInstallEntry,
  InstalledPluginsFile,
  EnabledPluginsMap,
  MarketplacePluginEntry,
  MarketplaceManifest,
  PreviewPlugin,
  InstalledPlugin,
  AvailablePlugin,
  PluginListResponse,
  McpStatus,
  McpScope,
  McpServerConfig,
  McpServer,
  McpAddParams,
  MergedPlugin,
} from '../shared/types';

/** CLI 執行錯誤（僅 extension 使用） */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'CliError';
  }
}
