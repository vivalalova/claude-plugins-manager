import { join } from 'path';
import { homedir } from 'os';
import type { CliService } from './CliService';
import { PLUGINS_CACHE_DIR, EXTENSION_ID } from '../constants';
import type { ExtensionInfo } from '../../shared/types';

interface PackageJson {
  version: string;
  displayName?: string;
  publisher?: string;
  repository?: { url?: string };
}

/**
 * Extension 自身資訊收集 service。
 * 提供版本、路徑、CLI 等靜態與動態資訊給 Extension Info 頁面。
 */
export class ExtensionInfoService {
  constructor(
    private readonly cli: CliService,
    private readonly packageJson: PackageJson,
    private readonly extensionPath: string,
  ) {}

  async getInfo(): Promise<ExtensionInfo> {
    const cliVersion = await this.getCliVersion();
    const claudeDir = join(homedir(), '.claude');
    const pluginsDir = join(claudeDir, 'plugins');

    return {
      extensionVersion: this.packageJson.version,
      extensionName: this.packageJson.displayName ?? 'Claude Plugins Manager',
      publisher: this.packageJson.publisher ?? '',
      repoUrl: this.packageJson.repository?.url ?? null,
      cliPath: this.cli.claudePath,
      cliVersion,
      cacheDirPath: PLUGINS_CACHE_DIR,
      pluginsDirPath: pluginsDir,
      installedPluginsPath: join(pluginsDir, 'installed_plugins.json'),
      knownMarketplacesPath: join(pluginsDir, 'known_marketplaces.json'),
      extensionPath: this.extensionPath,
      preferencesPath: join(claudeDir, EXTENSION_ID, 'preferences.json'),
    };
  }

  private async getCliVersion(): Promise<string | null> {
    try {
      return await this.cli.exec(['--version'], { timeout: 5_000 });
    } catch {
      return null;
    }
  }
}
