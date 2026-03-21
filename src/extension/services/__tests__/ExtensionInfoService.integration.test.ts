import { describe, it, expect, vi } from 'vitest';
import { join } from 'path';
import { homedir } from 'os';
import { ExtensionInfoService } from '../ExtensionInfoService';
import type { CliService } from '../CliService';

function makeCli(version: string | null = '1.0.5 (claude-ai)'): Partial<CliService> {
  return {
    claudePath: '/usr/local/bin/claude',
    exec: version !== null
      ? vi.fn().mockResolvedValue(version)
      : vi.fn().mockRejectedValue(new Error('command not found')),
  };
}

const packageJson = {
  version: '0.5.0',
  displayName: 'Claude Plugins Manager',
  publisher: 'vibeai',
  repository: { url: 'https://github.com/vibeai/claude-plugins' },
};

const extensionPath = '/Users/test/.vscode/extensions/claude-plugins';
const cacheDir = '/Users/test/.vscode-server/globalStorage/lova.claude-plugins-manager';

describe('ExtensionInfoService — integration', () => {
  it('getInfo() 回傳所有必填欄位，型別正確', async () => {
    const cli = makeCli();
    const service = new ExtensionInfoService(cli as CliService, packageJson, extensionPath, cacheDir);

    const info = await service.getInfo();

    expect(typeof info.extensionVersion).toBe('string');
    expect(info.extensionVersion).toBe('0.5.0');
    expect(info.extensionName).toBe('Claude Plugins Manager');
    expect(info.publisher).toBe('vibeai');
    expect(info.repoUrl).toBe('https://github.com/vibeai/claude-plugins');
    expect(info.cliPath).toBe('/usr/local/bin/claude');
    expect(typeof info.cliVersion).toBe('string');
    expect(info.cliVersion).toBeTruthy();
    expect(info.cacheDirPath.path).toBeTruthy();
    expect(typeof info.cacheDirPath.exists).toBe('boolean');
    expect(info.pluginsDirPath.path).toBeTruthy();
    expect(info.installedPluginsPath.path).toContain('installed_plugins.json');
    expect(info.knownMarketplacesPath.path).toContain('known_marketplaces.json');
    expect(info.extensionPath.path).toBe(extensionPath);
    expect(info.preferencesPath.path).toBe('VSCode globalState');
  });

  it('路徑欄位正確組合 homedir', async () => {
    const cli = makeCli();
    const service = new ExtensionInfoService(cli as CliService, packageJson, extensionPath, cacheDir);

    const info = await service.getInfo();
    const claudeDir = join(homedir(), '.claude');

    expect(info.pluginsDirPath.path).toBe(join(claudeDir, 'plugins'));
    expect(info.installedPluginsPath.path).toBe(join(claudeDir, 'plugins', 'installed_plugins.json'));
    expect(info.knownMarketplacesPath.path).toBe(join(claudeDir, 'plugins', 'known_marketplaces.json'));
  });

  it('CLI 不存在時 cliVersion 為 null，不拋例外', async () => {
    const cli = makeCli(null);
    const service = new ExtensionInfoService(cli as CliService, packageJson, extensionPath, cacheDir);

    const info = await service.getInfo();

    expect(info.cliVersion).toBeNull();
    // 其他欄位仍正常
    expect(info.extensionVersion).toBe('0.5.0');
    expect(info.cliPath).toBe('/usr/local/bin/claude');
  });

  it('packageJson 缺少 displayName 時使用 fallback 名稱', async () => {
    const cli = makeCli();
    const service = new ExtensionInfoService(
      cli as CliService,
      { version: '1.0.0' },
      extensionPath,
      cacheDir,
    );

    const info = await service.getInfo();

    expect(info.extensionName).toBe('Claude Plugins Manager');
    expect(info.publisher).toBe('');
    expect(info.repoUrl).toBeNull();
  });

  it('getInfo() 呼叫 cli.exec 帶 --version 參數', async () => {
    const cli = makeCli();
    const service = new ExtensionInfoService(cli as CliService, packageJson, extensionPath, cacheDir);

    await service.getInfo();

    expect(cli.exec).toHaveBeenCalledWith(['--version'], { timeout: 5_000 });
  });
});
