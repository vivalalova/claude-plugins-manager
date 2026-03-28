import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { homedir } from 'os';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExistsSync = vi.hoisted(() => vi.fn<(p: string) => boolean>());

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: mockExistsSync };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockCliExec = ReturnType<typeof vi.fn>;

interface MockCli {
  claudePath: string;
  exec: MockCliExec;
}

function createCli(
  claudePath = '/usr/local/bin/claude',
  version: string | Error = '1.2.3 (claude-ai)',
): MockCli {
  return {
    claudePath,
    exec:
      version instanceof Error
        ? vi.fn().mockRejectedValue(version)
        : vi.fn().mockResolvedValue(version),
  };
}

const BASE_PACKAGE_JSON = {
  version: '0.5.0',
  displayName: 'Claude Plugins Manager',
  publisher: 'vibeai',
  repository: { url: 'https://github.com/vibeai/claude-plugins' },
};

const EXTENSION_PATH = '/Users/test/.vscode/extensions/vibeai.claude-plugins-manager-0.5.0';
const CACHE_DIR = '/Users/test/.vscode-server/globalStorage/vibeai.claude-plugins-manager/cache';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExtensionInfoService', () => {
  // Avoid polluting other test files: always restore existsSync
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no paths exist
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // getInfo() — field population
  // -------------------------------------------------------------------------

  describe('getInfo() — field population', () => {
    it('returns all required ExtensionInfo fields with correct types', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.extensionVersion).toBe('0.5.0');
      expect(info.extensionName).toBe('Claude Plugins Manager');
      expect(info.publisher).toBe('vibeai');
      expect(info.repoUrl).toBe('https://github.com/vibeai/claude-plugins');
      expect(info.cliPath).toBe('/usr/local/bin/claude');
      expect(info.cliVersion).toBe('1.2.3 (claude-ai)');
      expect(info.homeDirPrefix).toBe(homedir());
    });

    it('calls cli.exec with --version and 5s timeout', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      await svc.getInfo();

      expect(cli.exec).toHaveBeenCalledWith(['--version'], { timeout: 5_000 });
    });

    it('preferencesPath is always VSCode globalState with exists=true', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.preferencesPath).toEqual({ path: 'VSCode globalState', exists: true });
    });

    it('extensionPath PathInfo uses the extensionPath constructor argument', async () => {
      const cli = createCli();
      mockExistsSync.mockImplementation((p: string) => p === EXTENSION_PATH);
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.extensionPath).toEqual({ path: EXTENSION_PATH, exists: true });
    });

    it('cacheDirPath PathInfo uses the cacheDir constructor argument', async () => {
      const cli = createCli();
      mockExistsSync.mockImplementation((p: string) => p === CACHE_DIR);
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.cacheDirPath).toEqual({ path: CACHE_DIR, exists: true });
    });
  });

  // -------------------------------------------------------------------------
  // PathInfo.exists checks
  // -------------------------------------------------------------------------

  describe('PathInfo.exists', () => {
    it('exists=true when path is present on disk', async () => {
      const claudeDir = join(homedir(), '.claude');
      mockExistsSync.mockImplementation(() => true);
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.pluginsDirPath.exists).toBe(true);
      expect(info.installedPluginsPath.exists).toBe(true);
      expect(info.knownMarketplacesPath.exists).toBe(true);
      expect(info.extensionPath.exists).toBe(true);
      expect(info.cacheDirPath.exists).toBe(true);
      void claudeDir; // used implicitly via paths module
    });

    it('exists=false when path is absent', async () => {
      mockExistsSync.mockReturnValue(false);
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.pluginsDirPath.exists).toBe(false);
      expect(info.installedPluginsPath.exists).toBe(false);
      expect(info.extensionPath.exists).toBe(false);
    });

    it('per-path discrimination — only specific paths exist', async () => {
      mockExistsSync.mockImplementation((p: string) => p === EXTENSION_PATH);
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.extensionPath.exists).toBe(true);
      expect(info.cacheDirPath.exists).toBe(false);
      expect(info.pluginsDirPath.exists).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Path composition
  // -------------------------------------------------------------------------

  describe('path composition', () => {
    it('pluginsDirPath is ~/.claude/plugins', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.pluginsDirPath.path).toBe(join(homedir(), '.claude', 'plugins'));
    });

    it('installedPluginsPath contains installed_plugins.json', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.installedPluginsPath.path).toContain('installed_plugins.json');
      expect(info.installedPluginsPath.path).toContain(homedir());
    });

    it('knownMarketplacesPath contains known_marketplaces.json', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.knownMarketplacesPath.path).toContain('known_marketplaces.json');
    });

    it('dataDirPath is plugins/data subdirectory', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.dataDirPath.path).toBe(join(homedir(), '.claude', 'plugins', 'data'));
    });
  });

  // -------------------------------------------------------------------------
  // getCliVersion() — error resilience
  // -------------------------------------------------------------------------

  describe('getCliVersion() — error resilience', () => {
    it('CLI not found (ENOENT) → cliVersion is null, does not throw', async () => {
      const cli = createCli('/usr/local/bin/claude', new Error('command not found: claude'));
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.cliVersion).toBeNull();
      // Other fields still populated correctly
      expect(info.extensionVersion).toBe('0.5.0');
    });

    it('CLI timeout → cliVersion is null, does not throw', async () => {
      const timeoutErr = Object.assign(new Error('Command timed out after 5000ms'), { code: 'ETIMEDOUT' });
      const cli = createCli('/usr/local/bin/claude', timeoutErr);
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.cliVersion).toBeNull();
    });

    it('CLI returns version string → cliVersion matches returned value', async () => {
      const cli = createCli('/custom/bin/claude', '2.0.0 (claude-ai)');
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(cli as never, BASE_PACKAGE_JSON, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.cliVersion).toBe('2.0.0 (claude-ai)');
    });
  });

  // -------------------------------------------------------------------------
  // packageJson fallback values
  // -------------------------------------------------------------------------

  describe('packageJson fallback values', () => {
    it('missing displayName → falls back to "Claude Plugins Manager"', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(
        cli as never,
        { version: '1.0.0' },
        EXTENSION_PATH,
        CACHE_DIR,
      );

      const info = await svc.getInfo();

      expect(info.extensionName).toBe('Claude Plugins Manager');
    });

    it('missing publisher → empty string', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(
        cli as never,
        { version: '1.0.0' },
        EXTENSION_PATH,
        CACHE_DIR,
      );

      const info = await svc.getInfo();

      expect(info.publisher).toBe('');
    });

    it('missing repository → repoUrl is null', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(
        cli as never,
        { version: '1.0.0' },
        EXTENSION_PATH,
        CACHE_DIR,
      );

      const info = await svc.getInfo();

      expect(info.repoUrl).toBeNull();
    });

    it('repository without url → repoUrl is null', async () => {
      const cli = createCli();
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const svc = new ExtensionInfoService(
        cli as never,
        { version: '1.0.0', repository: {} },
        EXTENSION_PATH,
        CACHE_DIR,
      );

      const info = await svc.getInfo();

      expect(info.repoUrl).toBeNull();
    });

    it('all packageJson fields present → all mapped correctly', async () => {
      const cli = createCli('/opt/homebrew/bin/claude');
      const { ExtensionInfoService } = await import('../ExtensionInfoService');
      const pkgJson = {
        version: '3.1.4',
        displayName: 'Custom Name',
        publisher: 'myorg',
        repository: { url: 'https://github.com/myorg/plugin' },
      };
      const svc = new ExtensionInfoService(cli as never, pkgJson, EXTENSION_PATH, CACHE_DIR);

      const info = await svc.getInfo();

      expect(info.extensionVersion).toBe('3.1.4');
      expect(info.extensionName).toBe('Custom Name');
      expect(info.publisher).toBe('myorg');
      expect(info.repoUrl).toBe('https://github.com/myorg/plugin');
      expect(info.cliPath).toBe('/opt/homebrew/bin/claude');
    });
  });
});
