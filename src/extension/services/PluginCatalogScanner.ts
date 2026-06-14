import { lstat, readFile, readdir, realpath, stat } from 'fs/promises';
import { isAbsolute, join, relative, resolve } from 'path';
import type {
  AvailablePlugin,
  MarketplaceManifest,
  MarketplacePluginEntry,
  PluginContentItem,
  PluginContents,
  SourceFormatType,
} from '../../shared/types';
import { readJsonFile } from '../utils/jsonFile';

interface PluginCatalogScannerOptions {
  knownMarketplacesPath: string;
  marketplacesDir: string;
}

export interface PluginCatalogSnapshot {
  availablePlugins: AvailablePlugin[];
  scannableMarketplaceNames: Set<string>;
}

export class PluginCatalogScanner {
  constructor(
    private readonly options: PluginCatalogScannerOptions,
  ) {}

  async scanCatalog(): Promise<PluginCatalogSnapshot> {
    let knownMarketplaces: Record<string, { installLocation?: string }>;
    try {
      knownMarketplaces = await readJsonFile<Record<string, { installLocation?: string }>>(
        this.options.knownMarketplacesPath,
        {},
      );
    } catch {
      return {
        availablePlugins: [],
        scannableMarketplaceNames: new Set<string>(),
      };
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
          const availablePlugins = await Promise.all(
            (manifest.plugins ?? []).map(async (plugin) => {
              const localSource = typeof plugin.source === 'string' ? plugin.source : null;
              const declaredSkillPaths = readDeclaredSkillPaths(plugin);
              const sourceUrl = typeof plugin.source === 'object' && plugin.source !== null
                ? extractSourceUrl(plugin.source as Record<string, unknown>)
                : undefined;
              const marketplaceDir = resolve(mpDir);
              const resolvedPluginDir = localSource ? resolve(marketplaceDir, localSource) : null;
              const candidatePluginDir = resolvedPluginDir && isWithinDirectory(marketplaceDir, resolvedPluginDir)
                ? resolvedPluginDir
                : null;
              let contents: AvailablePlugin['contents'];
              let pluginMeta: { description?: string; version?: string } = {};
              let lastUpdated: string | undefined;

              // localSource 有值但目錄不存在 → 視為外部（不可安裝）
              let dirExists = false;
              let pluginDir: string | null = null;
              if (candidatePluginDir) {
                try {
                  await stat(candidatePluginDir);
                  if (await isRealPathWithinDirectory(marketplaceDir, candidatePluginDir)) {
                    pluginDir = candidatePluginDir;
                    dirExists = true;
                  }
                } catch {
                  // dir doesn't exist
                }
              }
              if (pluginDir && dirExists) {
                const [scannedContents, scannedMeta] = await Promise.all([
                  this.scanPluginContents(pluginDir, marketplaceDir),
                  this.readPluginMeta(pluginDir),
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
                sourceFormat: getSourceFormat(plugin.source),
                lastUpdated,
              } satisfies AvailablePlugin;
            }),
          );
          return {
            marketplaceName: mpName,
            manifestReadable: true,
            availablePlugins,
          };
        } catch (scanErr) {
          if ((scanErr as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.warn(`[SettingsFileService] marketplace scan error (${mpName}):`, scanErr);
          }
          return {
            marketplaceName: mpName,
            manifestReadable: false,
            availablePlugins: [] as AvailablePlugin[],
          };
        }
      }),
    );

    return {
      availablePlugins: perMarketplace.flatMap((entry) => entry.availablePlugins),
      scannableMarketplaceNames: new Set(
        perMarketplace
          .filter((entry) => entry.manifestReadable)
          .map((entry) => entry.marketplaceName),
      ),
    };
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

  async scanPluginContents(pluginDir: string, trustedParentDir?: string): Promise<PluginContents> {
    const pluginRoot = resolve(pluginDir);
    const contents: PluginContents = {
      commands: [],
      skills: [],
      agents: [],
      mcpServers: [],
      hooks: false,
    };

    if (trustedParentDir) {
      if (!(await isRealPathWithinDirectory(resolve(trustedParentDir), pluginRoot))) {
        return contents;
      }
    } else if (await isSymbolicLink(pluginRoot)) {
      return contents;
    }

    const [commands, skills, agents, mcpKeys, hasHooks] = await Promise.all([
      this.scanMdDir(join(pluginRoot, 'commands'), pluginRoot),
      this.scanSkillsDir(join(pluginRoot, 'skills'), pluginRoot),
      this.scanMdDir(join(pluginRoot, 'agents'), pluginRoot),
      this.readMcpServerKeys(pluginRoot),
      this.hasHooks(pluginRoot),
    ]);

    contents.commands = commands;
    contents.skills = skills;
    contents.agents = agents;
    contents.mcpServers = mcpKeys;
    contents.hooks = hasHooks;

    return contents;
  }

  private async readPluginMeta(pluginDir: string): Promise<{ description?: string; version?: string }> {
    const pluginRoot = resolve(pluginDir);
    const pluginJsonPath = join(pluginRoot, '.claude-plugin', 'plugin.json');
    if (!(await isRealPathWithinDirectory(pluginRoot, pluginJsonPath))) {
      return {};
    }
    return readJsonFile<{ description?: string; version?: string }>(
      pluginJsonPath,
      {},
    ).catch(() => ({} as { description?: string; version?: string }));
  }

  private async readMcpServerKeys(pluginRoot: string): Promise<string[]> {
    const mcpPath = join(pluginRoot, '.mcp.json');
    if (!(await isRealPathWithinDirectory(pluginRoot, mcpPath))) {
      return [];
    }
    let mcp: Record<string, unknown>;
    try {
      mcp = await readJsonFile<Record<string, unknown>>(mcpPath, {});
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
    const servers = unwrapMcpServers(mcp);
    return Object.keys(servers);
  }

  private async hasHooks(pluginRoot: string): Promise<boolean> {
    const hooksPath = join(pluginRoot, 'hooks', 'hooks.json');
    if (!(await isRealPathWithinDirectory(pluginRoot, hooksPath))) {
      return false;
    }
    return stat(hooksPath)
      .then(() => true)
      .catch(() => false);
  }

  private async readLastUpdated(pluginDir: string): Promise<string | undefined> {
    const pluginRoot = resolve(pluginDir);
    try {
      const entries = await readdir(pluginRoot);
      const contentEntries = entries.filter((entry) => entry !== '.git');
      const stats = await Promise.all(
        contentEntries.map(async (entry) => {
          const entryPath = join(pluginRoot, entry);
          if (!(await isRealPathWithinDirectory(pluginRoot, entryPath))) {
            return null;
          }
          return stat(entryPath).catch((err: unknown) => {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
              throw err;
            }
            return null;
          });
        }),
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

  private async scanMdDir(dir: string, pluginRoot: string): Promise<PluginContentItem[]> {
    if (!(await isRealPathWithinDirectory(pluginRoot, dir))) {
      return [];
    }

    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return [];
    }

    const mdFiles = (await Promise.all(
      files
        .filter((file) => file.endsWith('.md'))
        .map(async (file) => await isRealPathWithinDirectory(pluginRoot, join(dir, file)) ? file : null),
    )).filter((file): file is string => file !== null);
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

  private async scanSkillsDir(dir: string, pluginRoot: string): Promise<PluginContentItem[]> {
    if (!(await isRealPathWithinDirectory(pluginRoot, dir))) {
      return [];
    }

    const rootSkillPath = join(dir, 'SKILL.md');
    try {
      if (!(await isRealPathWithinDirectory(pluginRoot, rootSkillPath))) {
        throw Object.assign(new Error('Skill file escapes plugin root'), { code: 'ENOENT' });
      }
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
          if (!(await isRealPathWithinDirectory(pluginRoot, skillMd))) {
            return null;
          }
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
    const pluginRoot = resolve(pluginDir);
    const skillDirs = await Promise.all(
      dedupedPaths.map(async (skillPath) => {
        const skillDir = resolve(pluginRoot, skillPath);
        if (!isWithinDirectory(pluginRoot, skillDir)) {
          return null;
        }
        return await isRealPathWithinDirectory(pluginRoot, skillDir)
          ? skillDir
          : null;
      }),
    );
    const nestedResults = await Promise.all(
      skillDirs
        .filter((skillDir): skillDir is string => skillDir !== null)
        .map((skillDir) => this.scanSkillsDir(skillDir, pluginRoot)),
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
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Failed to parse frontmatter: ${filePath}`, error);
      }
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

function getSourceFormat(source: string | Record<string, unknown>): SourceFormatType | undefined {
  if (typeof source === 'string') {
    return source.includes('external_plugins') ? 'local-external' : 'local-internal';
  }
  if (typeof source === 'object' && source !== null) {
    const src = source.source;
    if (src === 'github') return 'github';
    if (src === 'git-subdir') return 'git-subdir';
    if (src === 'url') return typeof source.path === 'string' ? 'url-subdir' : 'url';
  }
  return undefined;
}

function extractSourceUrl(src: Record<string, unknown>): string | undefined {
  // npm → npmjs.com browsable URL
  if (src.source === 'npm' && typeof src.package === 'string') {
    return `https://www.npmjs.com/package/${src.package}`;
  }
  // pip → pypi.org browsable URL
  if (src.source === 'pip' && typeof src.package === 'string') {
    return `https://pypi.org/project/${src.package}`;
  }

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

function isWithinDirectory(parentDir: string, candidatePath: string): boolean {
  const rel = relative(resolve(parentDir), resolve(candidatePath));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

async function isSymbolicLink(candidatePath: string): Promise<boolean> {
  try {
    return (await lstat(candidatePath)).isSymbolicLink();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function isRealPathWithinDirectory(parentDir: string, candidatePath: string): Promise<boolean> {
  try {
    const [realParent, realCandidate] = await Promise.all([
      realpath(parentDir),
      realpath(candidatePath),
    ]);
    return isWithinDirectory(realParent, realCandidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return true;
    }
    throw error;
  }
}
