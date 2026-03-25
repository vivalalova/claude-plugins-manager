import { readFile, readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import type {
  AvailablePlugin,
  MarketplaceManifest,
  MarketplacePluginEntry,
  PluginContentItem,
  PluginContents,
} from '../../shared/types';
import { readJsonFile } from '../utils/jsonFile';

interface PluginCatalogScannerOptions {
  knownMarketplacesPath: string;
  marketplacesDir: string;
}

export class PluginCatalogScanner {
  constructor(
    private readonly options: PluginCatalogScannerOptions,
  ) {}

  async scanAvailablePlugins(): Promise<AvailablePlugin[]> {
    let knownMarketplaces: Record<string, { installLocation?: string }>;
    try {
      knownMarketplaces = await readJsonFile<Record<string, { installLocation?: string }>>(
        this.options.knownMarketplacesPath,
        {},
      );
    } catch {
      return [];
    }

    const perMarketplace = await Promise.all(
      Object.entries(knownMarketplaces).map(async ([mpName, mpEntry]) => {
        const mpDir = mpEntry.installLocation ?? join(this.options.marketplacesDir, mpName);
        const manifestPath = join(mpDir, '.claude-plugin', 'marketplace.json');
        try {
          const manifest = await readJsonFile<MarketplaceManifest>(
            manifestPath,
            {} as MarketplaceManifest,
          );
          return Promise.all(
            (manifest.plugins ?? []).map(async (plugin) => {
              const localSource = typeof plugin.source === 'string' ? plugin.source : null;
              const declaredSkillPaths = readDeclaredSkillPaths(plugin);
              const sourceUrl = typeof plugin.source === 'object' && plugin.source !== null
                ? extractSourceUrl(plugin.source as Record<string, unknown>)
                : undefined;
              const pluginDir = localSource ? resolve(mpDir, localSource) : null;
              let contents: AvailablePlugin['contents'];
              let pluginMeta: { description?: string; version?: string } = {};
              let lastUpdated: string | undefined;

              // localSource 有值但目錄不存在 → 視為外部（不可安裝）
              let dirExists = false;
              if (pluginDir) {
                try {
                  await stat(pluginDir);
                  dirExists = true;
                } catch {
                  // dir doesn't exist
                }
              }
              if (pluginDir && dirExists) {
                const [scannedContents, scannedMeta] = await Promise.all([
                  this.scanPluginContents(pluginDir),
                  readJsonFile<{ description?: string; version?: string }>(
                    join(pluginDir, '.claude-plugin', 'plugin.json'),
                    {},
                  ).catch(() => ({} as { description?: string; version?: string })),
                ]);
                contents = declaredSkillPaths.length > 0
                  ? { ...scannedContents, skills: await this.scanDeclaredSkills(pluginDir, declaredSkillPaths) }
                  : scannedContents;
                pluginMeta = scannedMeta;
                lastUpdated = await this.readLastUpdated(pluginDir);
              }

              return {
                pluginId: `${plugin.name}@${mpName}`,
                name: plugin.name,
                description: pluginMeta.description ?? plugin.description ?? '',
                marketplaceName: mpName,
                version: pluginMeta.version ?? plugin.version,
                contents,
                sourceDir: dirExists ? (localSource ?? undefined) : undefined,
                sourceUrl,
                lastUpdated,
              } satisfies AvailablePlugin;
            }),
          );
        } catch (scanErr) {
          if ((scanErr as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.warn(`[SettingsFileService] marketplace scan error (${mpName}):`, scanErr);
          }
          return [] as AvailablePlugin[];
        }
      }),
    );

    return perMarketplace.flat();
  }

  async readMarketplaceSources(): Promise<Record<string, string>> {
    const known = await readJsonFile<
      Record<string, { source: { url?: string; repo?: string; path?: string } }>
    >(this.options.knownMarketplacesPath, {});

    const result: Record<string, string> = {};
    for (const [name, entry] of Object.entries(known)) {
      const src = entry?.source;
      if (src) {
        result[name] = src.url ?? src.repo ?? src.path ?? '';
      }
    }
    return result;
  }

  async scanPluginContents(pluginDir: string): Promise<PluginContents> {
    const contents: PluginContents = {
      commands: [],
      skills: [],
      agents: [],
      mcpServers: [],
      hooks: false,
    };

    const [commands, skills, agents, mcpKeys, hasHooks] = await Promise.all([
      this.scanMdDir(join(pluginDir, 'commands')),
      this.scanSkillsDir(join(pluginDir, 'skills')),
      this.scanMdDir(join(pluginDir, 'agents')),
      readJsonFile<Record<string, unknown>>(join(pluginDir, '.mcp.json'), {})
        .then((mcp) => {
          const servers = unwrapMcpServers(mcp);
          return Object.keys(servers);
        })
        .catch(() => [] as string[]),
      stat(join(pluginDir, 'hooks', 'hooks.json'))
        .then(() => true)
        .catch(() => false),
    ]);

    contents.commands = commands;
    contents.skills = skills;
    contents.agents = agents;
    contents.mcpServers = mcpKeys;
    contents.hooks = hasHooks;

    return contents;
  }

  private async readLastUpdated(pluginDir: string): Promise<string | undefined> {
    try {
      const entries = await readdir(pluginDir);
      const contentEntries = entries.filter((entry) => entry !== '.git');
      const stats = await Promise.all(
        contentEntries.map((entry) =>
          stat(join(pluginDir, entry)).catch((err: unknown) => {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
              throw err;
            }
            return null;
          }),
        ),
      );
      const latestMtime = Math.max(0, ...stats.map((entry) => entry?.mtimeMs ?? 0));
      return latestMtime > 0 ? new Date(latestMtime).toISOString() : undefined;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
      return undefined;
    }
  }

  private async scanMdDir(dir: string): Promise<PluginContentItem[]> {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return [];
    }

    const mdFiles = files.filter((file) => file.endsWith('.md'));
    const fmResults = await Promise.all(
      mdFiles.map((file) => this.parseFrontmatter(join(dir, file))),
    );

    return mdFiles.map((file, index) => {
      const fallbackName = file.replace(/\.md$/, '');
      const fm = fmResults[index];
      return {
        name: fm.name || fm.description ? (fm.name || fallbackName) : fallbackName,
        description: fm.description ?? '',
        path: join(dir, file),
      };
    });
  }

  private async scanSkillsDir(dir: string): Promise<PluginContentItem[]> {
    const rootSkillPath = join(dir, 'SKILL.md');
    try {
      await stat(rootSkillPath);
      const fm = await this.parseFrontmatter(rootSkillPath);
      return [{
        name: fm.name || 'SKILL',
        description: fm.description ?? '',
        path: rootSkillPath,
      }];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    let entries: string[];
    try {
      const dirents = await readdir(dir, { withFileTypes: true });
      entries = dirents.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
    } catch {
      return [];
    }

    const results = await Promise.all(
      entries.map(async (entry) => {
        const skillMd = join(dir, entry, 'SKILL.md');
        try {
          await stat(skillMd);
          const fm = await this.parseFrontmatter(skillMd);
          return {
            name: fm.name || entry,
            description: fm.description ?? '',
            path: skillMd,
          };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
          return null;
        }
      }),
    );

    return results.filter((result): result is PluginContentItem => result !== null);
  }

  private async scanDeclaredSkills(
    pluginDir: string,
    declaredSkillPaths: string[],
  ): Promise<PluginContentItem[]> {
    const dedupedPaths = [...new Set(declaredSkillPaths.map(normalizeRelativePath))];
    const nestedResults = await Promise.all(
      dedupedPaths.map((skillPath) => this.scanSkillsDir(resolve(pluginDir, skillPath))),
    );
    const byPath = new Map<string, PluginContentItem>();
    for (const items of nestedResults) {
      for (const item of items) {
        byPath.set(item.path, item);
      }
    }
    return [...byPath.values()];
  }

  private async parseFrontmatter(
    filePath: string,
  ): Promise<{ name?: string; description?: string }> {
    try {
      const raw = await readFile(filePath, 'utf-8');
      if (!raw.startsWith('---')) {
        return {};
      }

      const endIdx = raw.indexOf('---', 3);
      if (endIdx === -1) {
        return {};
      }

      const yaml = raw.slice(3, endIdx);
      const result: Record<string, string> = {};
      for (const line of yaml.split('\n')) {
        const match = line.match(/^(\w[\w-]*):\s*"?(.*?)"?\s*$/);
        if (match) {
          result[match[1]] = match[2];
        }
      }
      return { name: result.name, description: result.description };
    } catch {
      return {};
    }
  }
}

function unwrapMcpServers(mcp: Record<string, unknown>): Record<string, unknown> {
  const candidate = 'mcpServers' in mcp ? mcp.mcpServers : mcp;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    throw new Error('mcpServers must be an object');
  }
  return candidate as Record<string, unknown>;
}

function extractSourceUrl(src: Record<string, unknown>): string | undefined {
  const baseUrl = extractSourceBaseUrl(src);
  if (!baseUrl) {
    return undefined;
  }

  const subPath = joinSourcePath(
    typeof src.path === 'string' ? src.path : undefined,
    undefined,
  );
  if (subPath) {
    const ref = typeof src.ref === 'string' ? src.ref : 'main';
    return `${baseUrl}/tree/${ref}/${subPath}`;
  }

  return baseUrl;
}

function extractSourceBaseUrl(src: Record<string, unknown>): string | undefined {
  const rawUrl = typeof src.url === 'string'
    ? src.url
    : typeof src.repo === 'string'
      ? src.repo
      : undefined;
  if (!rawUrl) {
    return undefined;
  }

  if (rawUrl.startsWith('https://')) {
    return rawUrl.replace(/\.git$/, '');
  }
  if (!rawUrl.startsWith('/') && rawUrl.includes('/')) {
    return `https://github.com/${rawUrl}`;
  }
  return undefined;
}

function readDeclaredSkillPaths(plugin: MarketplacePluginEntry): string[] {
  const skills = (plugin as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) {
    return [];
  }
  return skills.filter((path): path is string => typeof path === 'string');
}

function joinSourcePath(basePath: string | undefined, subPath: string | undefined): string | undefined {
  if (!basePath) {
    return subPath;
  }
  if (!subPath) {
    return normalizeRelativePath(basePath);
  }
  return normalizeRelativePath(join(normalizeRelativePath(basePath), subPath));
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '');
  return normalized === '' ? '.' : normalized;
}
