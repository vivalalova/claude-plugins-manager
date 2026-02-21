import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { CLI_LONG_TIMEOUT_MS } from '../constants';
import type { Marketplace, MarketplaceSourceType, PreviewPlugin, MarketplaceManifest } from '../types';
import type { CliService } from './CliService';
import { escapeShellArg } from '../utils/workspace';

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

const CONFIG_PATH = path.join(
  os.homedir(),
  '.claude',
  'plugins',
  'known_marketplaces.json',
);

/**
 * Marketplace CRUD + autoUpdate toggle + 匯出匯入。
 * 讀取 known_marketplaces.json 取得完整資訊（含 lastUpdated、autoUpdate）。
 * CRUD 操作仍透過 CLI 執行。
 */
export class MarketplaceService {
  constructor(private readonly cli: CliService) {}

  /**
   * 列出所有已註冊的 marketplace（含 lastUpdated、autoUpdate）。
   * 直接讀 config file 而非 CLI，因為 CLI 輸出缺少這些欄位。
   */
  async list(): Promise<Marketplace[]> {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config: RawMarketplaceConfig = JSON.parse(raw);

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
    await this.cli.exec(
      ['plugin', 'marketplace', 'add', source],
      { timeout: CLI_LONG_TIMEOUT_MS },
    );
  }

  /** 移除 marketplace */
  async remove(name: string): Promise<void> {
    await this.cli.exec(['plugin', 'marketplace', 'remove', name]);
  }

  /** 更新 marketplace（不指定 name 則更新全部） */
  async update(name?: string): Promise<void> {
    const args = ['plugin', 'marketplace', 'update'];
    if (name) {
      args.push(name);
    }
    await this.cli.exec(args, { timeout: CLI_LONG_TIMEOUT_MS });
  }

  /** 切換 autoUpdate flag，直接寫入 config file */
  async toggleAutoUpdate(name: string): Promise<void> {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config: RawMarketplaceConfig = JSON.parse(raw);

    const entry = config[name];
    if (!entry) {
      throw new Error(`Marketplace "${name}" not found in config.`);
    }

    entry.autoUpdate = !entry.autoUpdate;
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
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
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mp-preview-'));
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
            const pluginDir = path.resolve(dir, p.source ?? '.');
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

  /**
   * 匯出 marketplace 清單為 shell script。
   * 開啟 VSCode save dialog 讓用戶選擇儲存位置。
   */
  async exportScript(): Promise<void> {
    const marketplaces = await this.list();
    if (marketplaces.length === 0) {
      throw new Error('No marketplaces to export.');
    }

    const lines = [
      '#!/bin/bash',
      '# Claude Code Marketplace Setup',
      `# Exported ${marketplaces.length} marketplace(s)`,
      '',
    ];
    for (const mp of marketplaces) {
      const source = mp.url ?? mp.repo ?? mp.path;
      if (source) {
        const escaped = escapeShellArg(source);
        lines.push(`claude plugin marketplace add '${escaped}'`);
      }
    }

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('claude-marketplaces.sh'),
      filters: { 'Shell Script': ['sh'] },
    });
    if (!uri) {
      return;
    }

    await vscode.workspace.fs.writeFile(
      uri,
      Buffer.from(lines.join('\n') + '\n'),
    );
    vscode.window.showInformationMessage(
      `Exported ${marketplaces.length} marketplace(s) to ${uri.fsPath}`,
    );
  }

  /**
   * 匯入 shell script 中的 marketplace add 指令。
   * 開啟 VSCode open dialog 讓用戶選擇檔案，逐一執行 add。
   * 回傳每個 source 的結果摘要。
   */
  async importScript(): Promise<string[]> {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectMany: false,
      filters: {
        'Shell Script': ['sh'],
        'All Files': ['*'],
      },
    });
    if (!uris || uris.length === 0) {
      return [];
    }

    const rawFile = await vscode.workspace.fs.readFile(uris[0]);
    const content = Buffer.from(rawFile).toString('utf-8');

    const addRegex = /claude\s+plugin\s+marketplace\s+add\s+["']?([^\s"']+)["']?/g;
    const sources: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = addRegex.exec(content)) !== null) {
      sources.push(match[1]);
    }

    if (sources.length === 0) {
      throw new Error('No "claude plugin marketplace add" commands found in the file.');
    }

    const results: string[] = [];
    for (const source of sources) {
      try {
        await this.add(source);
        results.push(`Added: ${source}`);
      } catch (e) {
        results.push(`Failed: ${source} — ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return results;
  }
}
