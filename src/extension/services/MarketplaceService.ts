import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import * as vscode from 'vscode';
import { CLI_LONG_TIMEOUT_MS } from '../constants';
import type {
  Marketplace,
  MarketplaceSourceType,
  PreviewPlugin,
  MarketplaceManifest,
  InstalledPluginsFile,
  PluginScope,
  EnabledPluginsMap,
  MarketplaceReinstallProgress,
  MarketplaceReinstallPhase,
} from '../../shared/types';
import type { CliService } from './CliService';
import type { SettingsFileService } from './SettingsFileService';
import { WriteQueue } from '../utils/WriteQueue';
import { readJsonFile } from '../utils/jsonFile';
import { KNOWN_MARKETPLACES_PATH, PLUGINS_CACHE_DIR } from '../paths';
import { fixScriptPermissions } from '../utils/fixScriptPermissions';

/** Git clone timeout (30s — shallow clone should be fast) */
const GIT_CLONE_TIMEOUT_MS = 30_000;

/** owner/repo 格式（無 protocol、無 .git suffix） */
const GITHUB_SHORTHAND_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/** known_marketplaces.json 內每個 marketplace 的原始結構 */
interface RawMarketplaceEntry {
  source: {
    source: MarketplaceSourceType;
    url?: string;
    repo?: string;
    path?: string;
  };
  installLocation: string;
  lastUpdated?: string;
  autoUpdate: boolean;
}

/** known_marketplaces.json 的完整結構 */
type RawMarketplaceConfig = Record<string, RawMarketplaceEntry>;

/**
 * Marketplace CRUD + autoUpdate toggle。
 * 讀取 known_marketplaces.json 取得完整資訊（含 lastUpdated、autoUpdate）。
 * CRUD 操作仍透過 CLI 執行。
 */
export class MarketplaceService {
  private readonly mutationQueue = new WriteQueue();
  private readonly _onReinstallProgress = new vscode.EventEmitter<MarketplaceReinstallProgress>();
  readonly onReinstallProgress = this._onReinstallProgress.event;

  constructor(
    private readonly cli: CliService,
    private readonly settings: SettingsFileService,
  ) {}

  /**
   * 列出所有已註冊的 marketplace（含 lastUpdated、autoUpdate）。
   * 直接讀 config file 而非 CLI，因為 CLI 輸出缺少這些欄位。
   */
  async list(): Promise<Marketplace[]> {
    const config = await readJsonFile<RawMarketplaceConfig>(KNOWN_MARKETPLACES_PATH, {} as RawMarketplaceConfig);
    if (Object.keys(config).length === 0) return [];

    return Object.entries(config).map(([name, entry]) => ({
      name,
      source: entry.source.source,
      url: entry.source.url,
      repo: entry.source.repo,
      path: entry.source.path,
      installLocation: entry.installLocation,
      lastUpdated: entry.lastUpdated,
      autoUpdate: entry.autoUpdate,
    }));
  }

  /** 新增 marketplace（Git URL / GitHub repo / 本地路徑） */
  async add(source: string): Promise<void> {
    return this.mutationQueue.enqueue(async () => {
      const beforeConfig = await readJsonFile(KNOWN_MARKETPLACES_PATH, {} as RawMarketplaceConfig);
      const beforeNames = new Set(Object.keys(beforeConfig));

      await this.cli.exec(
        ['plugin', 'marketplace', 'add', source],
        { timeout: CLI_LONG_TIMEOUT_MS },
      );

      const afterRaw = await fs.readFile(KNOWN_MARKETPLACES_PATH, 'utf-8');
      const afterConfig: RawMarketplaceConfig = JSON.parse(afterRaw);

      let changed = false;
      for (const [name, entry] of Object.entries(afterConfig)) {
        if (!beforeNames.has(name) && entry.autoUpdate !== true) {
          entry.autoUpdate = true;
          changed = true;
        }
      }

      if (changed) {
        await fs.writeFile(KNOWN_MARKETPLACES_PATH, JSON.stringify(afterConfig, null, 2) + '\n');
      }

      // 修正新 marketplace 中 .sh 檔案的執行權限
      const newNames = Object.keys(afterConfig).filter((n) => !beforeNames.has(n));
      await Promise.all(
        newNames
          .map((n) => afterConfig[n].installLocation)
          .filter(Boolean)
          .map((dir) => fixScriptPermissions(dir)),
      );
    });
  }

  /** 移除 marketplace */
  async remove(name: string): Promise<void> {
    return this.mutationQueue.enqueue(async () => {
      await this.cli.exec(['plugin', 'marketplace', 'remove', name]);
    });
  }

  /** 更新 marketplace（不指定 name 則更新全部） */
  async update(name?: string): Promise<void> {
    return this.mutationQueue.enqueue(async () => {
      const args = ['plugin', 'marketplace', 'update'];
      if (name) {
        args.push(name);
      }
      await this.cli.exec(args, { timeout: CLI_LONG_TIMEOUT_MS });
      await this.fixMarketplacePermissions(name);
    });
  }

  /** 切換 autoUpdate flag，直接寫入 config file */
  async toggleAutoUpdate(name: string): Promise<void> {
    return this.mutationQueue.enqueue(async () => {
      const raw = await fs.readFile(KNOWN_MARKETPLACES_PATH, 'utf-8');
      const config: RawMarketplaceConfig = JSON.parse(raw);

      const entry = config[name];
      if (!entry) {
        throw new Error(`Marketplace "${name}" not found in config.`);
      }

      entry.autoUpdate = !entry.autoUpdate;
      await fs.writeFile(KNOWN_MARKETPLACES_PATH, JSON.stringify(config, null, 2) + '\n');
    });
  }

  /** 重新安裝所有 marketplace（remove all → re-add each from original source） */
  async reinstallAll(): Promise<{ total: number; succeeded: number; failed: string[] }> {
    return this.mutationQueue.enqueue(async () => {
      const config = await readJsonFile<RawMarketplaceConfig>(KNOWN_MARKETPLACES_PATH, {} as RawMarketplaceConfig);
      const entries = Object.entries(config)
        .map(([name, entry]) => ({
          name,
          source: entry.source.url ?? entry.source.repo ?? entry.source.path ?? '',
        }))
        .filter((e) => e.source !== '');

      const total = entries.length;
      if (total === 0) return { total: 0, succeeded: 0, failed: [] };
      const marketplaceNames = new Set(entries.map((entry) => entry.name));
      const [installedSnapshot, enabledSnapshot] = await Promise.all([
        this.settings.readInstalledPlugins(),
        this.settings.readAllEnabledPlugins(),
      ]);

      // Phase 1: Clear plugin cache
      this.emitReinstallProgress('clearingCache', 0, 1);
      await fs.rm(PLUGINS_CACHE_DIR, { recursive: true, force: true }).catch(() => {});

      // Phase 2: Remove all
      this.emitReinstallProgress('removingMarketplaces', 0, entries.length);
      for (const [index, { name }] of entries.entries()) {
        this.emitReinstallProgress('removingMarketplaces', index + 1, entries.length, name);
        await this.cli.exec(['plugin', 'marketplace', 'remove', name]);
      }

      // Phase 3: Re-add each（直接呼叫 CLI，不經 this.add() 避免 enqueue deadlock）
      const failed: string[] = [];
      this.emitReinstallProgress('addingMarketplaces', 0, entries.length);
      for (const [index, { name, source }] of entries.entries()) {
        this.emitReinstallProgress('addingMarketplaces', index + 1, entries.length, name);
        try {
          await this.cli.exec(['plugin', 'marketplace', 'add', source], { timeout: CLI_LONG_TIMEOUT_MS });
        } catch {
          failed.push(name);
        }
      }

      // Phase 4: autoUpdate + permissions
      const afterConfig = await readJsonFile<RawMarketplaceConfig>(KNOWN_MARKETPLACES_PATH, {} as RawMarketplaceConfig);
      let changed = false;
      for (const entry of Object.values(afterConfig)) {
        if (entry.autoUpdate !== true) { entry.autoUpdate = true; changed = true; }
      }
      if (changed) {
        await fs.writeFile(KNOWN_MARKETPLACES_PATH, JSON.stringify(afterConfig, null, 2) + '\n');
      }
      await Promise.all(
        Object.values(afterConfig).map((e) => e.installLocation).filter(Boolean).map((dir) => fixScriptPermissions(dir)),
      );

      // Phase 5: Restore enabled settings and reinstall previously installed plugins
      await this.restoreEnabledPlugins(enabledSnapshot);
      await this.reinstallPlugins(installedSnapshot, marketplaceNames, new Set(failed));
      this.emitReinstallProgress('completed', 1, 1);

      return { total, succeeded: total - failed.length, failed };
    });
  }

  private async restoreEnabledPlugins(
    enabledByScope: Record<PluginScope, EnabledPluginsMap>,
  ): Promise<void> {
    const scopes: PluginScope[] = ['user', 'project', 'local'];
    this.emitReinstallProgress('restoringSettings', 0, scopes.length);
    for (const [index, scope] of scopes.entries()) {
      this.emitReinstallProgress('restoringSettings', index + 1, scopes.length, scope);
      await this.settings.replaceEnabledPlugins(scope, enabledByScope[scope] ?? {});
    }
  }

  private async reinstallPlugins(
    installedSnapshot: InstalledPluginsFile,
    marketplaceNames: Set<string>,
    failedMarketplaces: Set<string>,
  ): Promise<void> {
    const restoreFailures: string[] = [];
    const reinstallTargets = Object.entries(installedSnapshot.plugins)
      .filter(([pluginId]) => {
        const marketplaceName = getMarketplaceName(pluginId);
        return !!marketplaceName && marketplaceNames.has(marketplaceName) && !failedMarketplaces.has(marketplaceName);
      })
      .flatMap(([pluginId, pluginEntries]) => pluginEntries.map((entry) => ({ pluginId, entry })));

    this.emitReinstallProgress('restoringPlugins', 0, reinstallTargets.length);

    for (const [index, { pluginId, entry }] of reinstallTargets.entries()) {
      const cwd = entry.scope === 'user' ? undefined : entry.projectPath;
      this.emitReinstallProgress('restoringPlugins', index + 1, reinstallTargets.length, `${pluginId} (${entry.scope})`);
      try {
        await this.cli.exec(
          ['plugin', 'install', pluginId, '--scope', entry.scope],
          { timeout: CLI_LONG_TIMEOUT_MS, ...(cwd ? { cwd } : {}) },
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        restoreFailures.push(`${pluginId} (${entry.scope}): ${reason}`);
      }
    }

    if (restoreFailures.length > 0) {
      throw new Error(`Failed to reinstall plugins: ${restoreFailures.join('; ')}`);
    }
  }

  private emitReinstallProgress(
    phase: MarketplaceReinstallPhase,
    current: number,
    total: number,
    detail?: string,
  ): void {
    this._onReinstallProgress.fire({ phase, current, total, ...(detail ? { detail } : {}) });
  }

  /** 修正 marketplace installLocation 中 .sh 檔案的執行權限 */
  private async fixMarketplacePermissions(name?: string): Promise<void> {
    const config = await readJsonFile<RawMarketplaceConfig>(KNOWN_MARKETPLACES_PATH, {} as RawMarketplaceConfig);
    const dirs = name
      ? config[name]?.installLocation ? [config[name].installLocation] : []
      : Object.values(config).map((e) => e.installLocation).filter(Boolean);
    await Promise.all(dirs.map((dir) => fixScriptPermissions(dir)));
  }

  /**
   * 預覽 marketplace 的 plugin 清單（不實際加入）。
   * 本地路徑直接讀取，Git/GitHub source 透過 shallow clone 到 temp dir。
   */
  async preview(source: string): Promise<PreviewPlugin[]> {
    const isLocal = source.startsWith('/') || source.startsWith('.');
    const isGitHub = !isLocal && GITHUB_SHORTHAND_RE.test(source);
    const gitUrl = isGitHub ? `https://github.com/${source}.git` : source;

    let dir: string;
    let tempDir: string | null = null;

    if (isLocal) {
      // 確認路徑存在
      await fs.access(source);
      dir = source;
    } else {
      // Shallow clone to temp dir
      tempDir = await fs.mkdtemp(path.join(tmpdir(), 'mp-preview-'));
      dir = tempDir;
      try {
        await new Promise<void>((resolve, reject) => {
          execFile(
            'git',
            ['clone', '--depth', '1', '--', gitUrl, tempDir!],
            { timeout: GIT_CLONE_TIMEOUT_MS },
            (err) => (err ? reject(err) : resolve()),
          );
        });
      } catch (err) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        throw err;
      }
    }

    try {
      const manifestPath = path.join(dir, '.claude-plugin', 'marketplace.json');
      const manifest: MarketplaceManifest = JSON.parse(
        await fs.readFile(manifestPath, 'utf-8'),
      );

      const baseDir = path.resolve(dir);
      const plugins = await Promise.all(
        (manifest.plugins ?? []).map(async (p): Promise<PreviewPlugin> => {
          let description = p.description ?? '';
          let version = p.version;
          try {
            if (typeof p.source !== 'string') throw new Error('Remote source, skip local scan');
            const pluginDir = path.resolve(dir, p.source);
            // 防止 path traversal（惡意 marketplace.json 的 source 欄位）
            if (!pluginDir.startsWith(baseDir + path.sep) && pluginDir !== baseDir) {
              throw new Error('Path traversal detected');
            }
            const pluginMeta = JSON.parse(
              await fs.readFile(path.join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf-8'),
            ) as { description?: string; version?: string };
            if (pluginMeta.description) description = pluginMeta.description;
            if (pluginMeta.version) version = pluginMeta.version;
          } catch {
            // plugin.json 可能不存在或路徑不合法，使用 manifest 資訊
          }
          return { name: p.name, description, version };
        }),
      );

      return plugins;
    } finally {
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

}

function getMarketplaceName(pluginId: string): string | null {
  const lastAt = pluginId.lastIndexOf('@');
  return lastAt > 0 ? pluginId.slice(lastAt + 1) : null;
}
