import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import type { CliService } from './CliService';
import type { ExtensionInfo, PathInfo } from '../../shared/types';
import { PLUGINS_DIR, INSTALLED_PLUGINS_PATH, KNOWN_MARKETPLACES_PATH } from '../paths';

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
    private readonly cacheDir: string,
  ) {}

  async getInfo(): Promise<ExtensionInfo> {
    const cliVersion = await this.getCliVersion();
    const toPathInfo = (p: string): PathInfo => ({ path: p, exists: existsSync(p) });

    return {
      extensionVersion: this.packageJson.version,
      extensionName: this.packageJson.displayName ?? 'Claude Plugins Manager',
      publisher: this.packageJson.publisher ?? '',
      repoUrl: this.packageJson.repository?.url ?? null,
      cliPath: this.cli.claudePath,
      cliVersion,
      cacheDirPath: toPathInfo(this.cacheDir),
      pluginsDirPath: toPathInfo(PLUGINS_DIR),
      dataDirPath: toPathInfo(join(PLUGINS_DIR, 'data')),
      installedPluginsPath: toPathInfo(INSTALLED_PLUGINS_PATH),
      knownMarketplacesPath: toPathInfo(KNOWN_MARKETPLACES_PATH),
      extensionPath: toPathInfo(this.extensionPath),
      preferencesPath: { path: 'VSCode globalState', exists: true },
      homeDirPrefix: homedir(),
    };
  }

  private async getCliVersion(): Promise<string | null> {
    try {
      return await this.cli.exec(['--version'], { timeout: 5_000 });
    } catch (e: unknown) {
      console.error('[ExtensionInfoService] Failed to get CLI version:', e);
      return null;
    }
  }
}
