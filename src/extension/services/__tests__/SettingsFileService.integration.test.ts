/**
 * SettingsFileService 整合測試。
 * 用真實 filesystem（tmpdir），不 mock fs/promises。
 * 驗證 mkdir、readFile、writeFile 全流程。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { readFile, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { workspace } from 'vscode';

/* ── 建立 suite 共用的 tmpdir，mock os.homedir 指向它 ── */
const { SUITE_TMP, SUITE_HOME } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfs-int-'));
  const homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(path.join(homeDir, '.claude', 'plugins'), { recursive: true });
  return { SUITE_TMP: tmpDir, SUITE_HOME: homeDir };
});

vi.mock('os', () => ({ homedir: () => SUITE_HOME }));

// 真正的 SettingsFileService（不 mock fs/promises）
import { SettingsFileService } from '../SettingsFileService';

afterAll(() => {
  rmSync(SUITE_TMP, { recursive: true, force: true });
});

describe('SettingsFileService（integration / 真實 filesystem）', () => {
  let svc: SettingsFileService;
  let workspaceDir: string;
  let testIdx = 0;

  /** settings 檔完整路徑 */
  const projectSettingsPath = () => join(workspaceDir, '.claude', 'settings.json');
  const localSettingsPath = () => join(workspaceDir, '.claude', 'settings.local.json');
  const userSettingsPath = () => join(SUITE_HOME, '.claude', 'settings.json');
  const installedPluginsPath = () => join(SUITE_HOME, '.claude', 'plugins', 'installed_plugins.json');

  beforeEach(async () => {
    testIdx++;
    workspaceDir = join(SUITE_TMP, `ws-${testIdx}`);
    mkdirSync(workspaceDir, { recursive: true });
    // 不建立 .claude/ — 讓測試驗證 mkdir 行為

    workspace.workspaceFolders = [
      { uri: { fsPath: workspaceDir }, name: 'test', index: 0 },
    ] as any;

    // 重置共用檔案
    await writeFile(userSettingsPath(), JSON.stringify({}) + '\n');
    await writeFile(installedPluginsPath(), JSON.stringify({ version: 2, plugins: {} }) + '\n');

    svc = new SettingsFileService();
  });

  /* ═══════ setPluginEnabled — project/local scope ═══════ */

  it('project scope：.claude/ 不存在 → 自動建立目錄並寫入 settings.json', async () => {
    await svc.setPluginEnabled('test@mp', 'project', true);

    const content = await readFile(projectSettingsPath(), 'utf-8');
    const settings = JSON.parse(content);
    expect(settings.enabledPlugins['test@mp']).toBe(true);
  });

  it('local scope：.claude/ 不存在 → 自動建立目錄並寫入 settings.local.json', async () => {
    await svc.setPluginEnabled('test@mp', 'local', true);

    const content = await readFile(localSettingsPath(), 'utf-8');
    const settings = JSON.parse(content);
    expect(settings.enabledPlugins['test@mp']).toBe(true);
  });

  it('enable → readEnabledPlugins → 正確讀回', async () => {
    await svc.setPluginEnabled('a@mp', 'project', true);
    await svc.setPluginEnabled('b@mp', 'project', true);

    const plugins = await svc.readEnabledPlugins('project');
    expect(plugins).toEqual({ 'a@mp': true, 'b@mp': true });
  });

  it('enable → disable → readEnabledPlugins → key 已移除', async () => {
    await svc.setPluginEnabled('a@mp', 'project', true);
    await svc.setPluginEnabled('b@mp', 'project', true);
    await svc.setPluginEnabled('a@mp', 'project', false);

    const plugins = await svc.readEnabledPlugins('project');
    expect(plugins).toEqual({ 'b@mp': true });
  });

  it('保留 settings 中的其他欄位', async () => {
    // 先手動寫入含其他欄位的 settings
    mkdirSync(join(workspaceDir, '.claude'), { recursive: true });
    await writeFile(projectSettingsPath(), JSON.stringify({
      permissions: { allow: ['Bash(ls:*)'] },
      enabledPlugins: { 'existing@mp': true },
    }) + '\n');

    await svc.setPluginEnabled('new@mp', 'project', true);

    const content = await readFile(projectSettingsPath(), 'utf-8');
    const settings = JSON.parse(content);
    expect(settings.permissions).toEqual({ allow: ['Bash(ls:*)'] });
    expect(settings.enabledPlugins).toEqual({
      'existing@mp': true,
      'new@mp': true,
    });
  });

  /* ═══════ setPluginEnabled — user scope ═══════ */

  it('user scope：讀寫 ~/.claude/settings.json', async () => {
    await writeFile(userSettingsPath(), JSON.stringify({
      enabledPlugins: { 'old@mp': true },
    }) + '\n');

    await svc.setPluginEnabled('new@mp', 'user', true);

    const content = await readFile(userSettingsPath(), 'utf-8');
    const settings = JSON.parse(content);
    expect(settings.enabledPlugins).toEqual({ 'old@mp': true, 'new@mp': true });
  });

  /* ═══════ addInstallEntry + readInstalledPlugins ═══════ */

  it('addInstallEntry → readInstalledPlugins → 正確讀回', async () => {
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'user',
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });

    const data = await svc.readInstalledPlugins();
    expect(data.plugins['my-plugin@mp']).toHaveLength(1);
    expect(data.plugins['my-plugin@mp'][0]).toMatchObject({
      scope: 'user',
      installPath: '/cache/my-plugin',
    });
  });

  it('addInstallEntry 兩個 scope → 兩筆 entries', async () => {
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'user',
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'project',
      projectPath: workspaceDir,
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });

    const data = await svc.readInstalledPlugins();
    expect(data.plugins['my-plugin@mp']).toHaveLength(2);
    expect(data.plugins['my-plugin@mp'].map((e) => e.scope)).toEqual(['user', 'project']);
  });

  it('addInstallEntry 重複 → 不新增', async () => {
    const entry = {
      scope: 'user' as const,
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    };
    await svc.addInstallEntry('my-plugin@mp', entry);
    await svc.addInstallEntry('my-plugin@mp', entry);

    const data = await svc.readInstalledPlugins();
    expect(data.plugins['my-plugin@mp']).toHaveLength(1);
  });

  /* ═══════ removeInstallEntry ═══════ */

  it('removeInstallEntry → 移除後 readInstalledPlugins 不含該 entry', async () => {
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'user',
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'project',
      projectPath: workspaceDir,
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });

    await svc.removeInstallEntry('my-plugin@mp', 'user');

    const data = await svc.readInstalledPlugins();
    expect(data.plugins['my-plugin@mp']).toHaveLength(1);
    expect(data.plugins['my-plugin@mp'][0].scope).toBe('project');
  });

  it('removeInstallEntry 最後一筆 → plugin key 消失', async () => {
    await svc.addInstallEntry('my-plugin@mp', {
      scope: 'user',
      installPath: '/cache/my-plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    });

    await svc.removeInstallEntry('my-plugin@mp', 'user');

    const data = await svc.readInstalledPlugins();
    expect(data.plugins['my-plugin@mp']).toBeUndefined();
  });

  /* ═══════ readJson fail-fast：JSON 損壞 → throw ═══════ */

  it('settings.json 損壞（非 JSON）→ readEnabledPlugins throw 含檔案路徑', async () => {
    await writeFile(userSettingsPath(), 'not valid json!!!');

    await expect(svc.readEnabledPlugins('user'))
      .rejects.toThrow(/Invalid JSON/);
    await expect(svc.readEnabledPlugins('user'))
      .rejects.toThrow(userSettingsPath());
  });

  it('installed_plugins.json 損壞 → readInstalledPlugins throw 含檔案路徑', async () => {
    await writeFile(installedPluginsPath(), '{broken');

    await expect(svc.readInstalledPlugins())
      .rejects.toThrow(/Invalid JSON/);
    await expect(svc.readInstalledPlugins())
      .rejects.toThrow(installedPluginsPath());
  });

  it('settings.json 不存在（ENOENT）→ readEnabledPlugins 回傳空物件（不 throw）', async () => {
    await rm(userSettingsPath());

    const result = await svc.readEnabledPlugins('user');
    expect(result).toEqual({});
  });

  it('installed_plugins.json 不存在 → readInstalledPlugins 回傳 defaultValue', async () => {
    await rm(installedPluginsPath());

    const result = await svc.readInstalledPlugins();
    expect(result).toEqual({ version: 2, plugins: {} });
  });

  /* ═══════ 全流程 round-trip ═══════ */

  it('完整流程：addInstallEntry + setPluginEnabled → readInstalledPlugins + readEnabledPlugins 一致', async () => {
    // 安裝 + enable
    await svc.addInstallEntry('flow@mp', {
      scope: 'project',
      projectPath: workspaceDir,
      installPath: '/cache/flow',
      version: '2.0.0',
      installedAt: '2026-01-15T00:00:00Z',
      lastUpdated: '2026-01-15T00:00:00Z',
    });
    await svc.setPluginEnabled('flow@mp', 'project', true);

    // 驗證
    const data = await svc.readInstalledPlugins();
    expect(data.plugins['flow@mp']).toHaveLength(1);

    const enabled = await svc.readEnabledPlugins('project');
    expect(enabled['flow@mp']).toBe(true);

    // disable
    await svc.setPluginEnabled('flow@mp', 'project', false);
    const after = await svc.readEnabledPlugins('project');
    expect(after['flow@mp']).toBeUndefined();

    // 移除
    await svc.removeInstallEntry('flow@mp', 'project', workspaceDir);
    const final = await svc.readInstalledPlugins();
    expect(final.plugins['flow@mp']).toBeUndefined();
  });

  describe('scanAvailablePlugins — plugin.json 讀取', () => {
    it('plugin.json 存在時，description/version/author 優先於 marketplace.json', async () => {
      const mpName = `scan-mp-${testIdx}`;
      const mpDir = join(SUITE_HOME, '.claude', 'plugins', 'marketplaces', mpName);
      const pluginDir = join(mpDir, 'plugins', 'my-plugin');
      const claudePluginDir = join(pluginDir, '.claude-plugin');

      // 建立目錄結構
      mkdirSync(join(mpDir, '.claude-plugin'), { recursive: true });
      mkdirSync(claudePluginDir, { recursive: true });

      // marketplace.json：description 和 version 來自 marketplace
      await writeFile(
        join(mpDir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: mpName,
          plugins: [{
            name: 'my-plugin',
            description: 'marketplace desc',
            version: '1.0.0',
            source: './plugins/my-plugin',
          }],
        }),
      );

      // plugin.json：更準確的 metadata
      await writeFile(
        join(claudePluginDir, 'plugin.json'),
        JSON.stringify({
          name: 'my-plugin',
          description: 'plugin.json desc',
          version: '2.0.0',
          author: 'Test Author',
        }),
      );

      // known_marketplaces.json 加入此 marketplace
      const knownPath = join(SUITE_HOME, '.claude', 'plugins', 'known_marketplaces.json');
      let known: Record<string, unknown> = {};
      try { known = JSON.parse(await readFile(knownPath, 'utf-8')); } catch { /* empty */ }
      known[mpName] = { installLocation: mpDir };
      await writeFile(knownPath, JSON.stringify(known));

      const result = await svc.scanAvailablePlugins();
      const plugin = result.find((p) => p.pluginId === `my-plugin@${mpName}`);

      expect(plugin).toBeDefined();
      expect(plugin!.description).toBe('plugin.json desc');
      expect(plugin!.version).toBe('2.0.0');
    });

    it('plugin.json 不存在時，fallback 為 marketplace.json', async () => {
      const mpName = `scan-mp-fallback-${testIdx}`;
      const mpDir = join(SUITE_HOME, '.claude', 'plugins', 'marketplaces', mpName);

      mkdirSync(join(mpDir, '.claude-plugin'), { recursive: true });
      // plugin source 目錄（無 .claude-plugin/plugin.json）
      mkdirSync(join(mpDir, 'plugins', 'no-meta'), { recursive: true });

      await writeFile(
        join(mpDir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: mpName,
          plugins: [{
            name: 'no-meta',
            description: 'from marketplace',
            version: '0.5.0',
            source: './plugins/no-meta',
          }],
        }),
      );

      const knownPath = join(SUITE_HOME, '.claude', 'plugins', 'known_marketplaces.json');
      let known: Record<string, unknown> = {};
      try { known = JSON.parse(await readFile(knownPath, 'utf-8')); } catch { /* empty */ }
      known[mpName] = { installLocation: mpDir };
      await writeFile(knownPath, JSON.stringify(known));

      const result = await svc.scanAvailablePlugins();
      const plugin = result.find((p) => p.pluginId === `no-meta@${mpName}`);

      expect(plugin).toBeDefined();
      expect(plugin!.description).toBe('from marketplace');
      expect(plugin!.version).toBe('0.5.0');
    });

    it('plugin .mcp.json 使用 mcpServers wrapper 時，contents.mcpServers 只包含實際 server 名稱', async () => {
      const mpName = `scan-mp-mcp-wrapper-${testIdx}`;
      const mpDir = join(SUITE_HOME, '.claude', 'plugins', 'marketplaces', mpName);
      const pluginDir = join(mpDir, 'plugins', 'wrapped-mcp');

      mkdirSync(join(mpDir, '.claude-plugin'), { recursive: true });
      mkdirSync(join(pluginDir, '.claude-plugin'), { recursive: true });

      await writeFile(
        join(mpDir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: mpName,
          plugins: [{
            name: 'wrapped-mcp',
            description: 'has wrapped mcp',
            version: '1.0.0',
            source: './plugins/wrapped-mcp',
          }],
        }),
      );

      await writeFile(
        join(pluginDir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            'wrapped-server': {
              command: 'npx',
              args: ['-y', 'wrapped-server'],
            },
          },
        }),
      );

      const knownPath = join(SUITE_HOME, '.claude', 'plugins', 'known_marketplaces.json');
      let known: Record<string, unknown> = {};
      try { known = JSON.parse(await readFile(knownPath, 'utf-8')); } catch { /* empty */ }
      known[mpName] = { installLocation: mpDir };
      await writeFile(knownPath, JSON.stringify(known));

      const result = await svc.scanAvailablePlugins();
      const plugin = result.find((p) => p.pluginId === `wrapped-mcp@${mpName}`);

      expect(plugin).toBeDefined();
      expect(plugin!.contents?.mcpServers).toEqual(['wrapped-server']);
    });

    it('source 為 object（url type）→ sourceUrl 為可瀏覽的 GitHub URL', async () => {
      const mpName = `scan-mp-source-url-${testIdx}`;
      const mpDir = join(SUITE_HOME, '.claude', 'plugins', 'marketplaces', mpName);

      mkdirSync(join(mpDir, '.claude-plugin'), { recursive: true });

      await writeFile(
        join(mpDir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: mpName,
          plugins: [{
            name: 'external-plugin',
            description: 'an external plugin',
            source: {
              source: 'url',
              url: 'https://github.com/amekala/adspirer-mcp-plugin.git',
              sha: 'abc123',
            },
          }],
        }),
      );

      const knownPath = join(SUITE_HOME, '.claude', 'plugins', 'known_marketplaces.json');
      let known: Record<string, unknown> = {};
      try { known = JSON.parse(await readFile(knownPath, 'utf-8')); } catch { /* empty */ }
      known[mpName] = { installLocation: mpDir };
      await writeFile(knownPath, JSON.stringify(known));

      const result = await svc.scanAvailablePlugins();
      const plugin = result.find((p) => p.pluginId === `external-plugin@${mpName}`);

      expect(plugin).toBeDefined();
      expect(plugin!.sourceUrl).toBe('https://github.com/amekala/adspirer-mcp-plugin');
      expect(plugin!.sourceDir).toBeUndefined();
    });

    it('source 為 object（git-subdir type）→ sourceUrl 含 path', async () => {
      const mpName = `scan-mp-git-subdir-${testIdx}`;
      const mpDir = join(SUITE_HOME, '.claude', 'plugins', 'marketplaces', mpName);

      mkdirSync(join(mpDir, '.claude-plugin'), { recursive: true });

      await writeFile(
        join(mpDir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: mpName,
          plugins: [{
            name: 'subdir-plugin',
            description: 'a git-subdir plugin',
            source: {
              source: 'git-subdir',
              url: 'awslabs/agent-plugins',
              path: 'plugins/aws-serverless',
              ref: 'main',
            },
          }],
        }),
      );

      const knownPath = join(SUITE_HOME, '.claude', 'plugins', 'known_marketplaces.json');
      let known: Record<string, unknown> = {};
      try { known = JSON.parse(await readFile(knownPath, 'utf-8')); } catch { /* empty */ }
      known[mpName] = { installLocation: mpDir };
      await writeFile(knownPath, JSON.stringify(known));

      const result = await svc.scanAvailablePlugins();
      const plugin = result.find((p) => p.pluginId === `subdir-plugin@${mpName}`);

      expect(plugin).toBeDefined();
      expect(plugin!.sourceUrl).toBe('https://github.com/awslabs/agent-plugins/tree/main/plugins/aws-serverless');
    });

    it('source 為 string（本地路徑）→ sourceUrl undefined', async () => {
      const mpName = `scan-mp-local-src-${testIdx}`;
      const mpDir = join(SUITE_HOME, '.claude', 'plugins', 'marketplaces', mpName);

      mkdirSync(join(mpDir, '.claude-plugin'), { recursive: true });
      mkdirSync(join(mpDir, 'plugins', 'local-plugin'), { recursive: true });

      await writeFile(
        join(mpDir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: mpName,
          plugins: [{
            name: 'local-plugin',
            description: 'a local plugin',
            source: './plugins/local-plugin',
          }],
        }),
      );

      const knownPath = join(SUITE_HOME, '.claude', 'plugins', 'known_marketplaces.json');
      let known: Record<string, unknown> = {};
      try { known = JSON.parse(await readFile(knownPath, 'utf-8')); } catch { /* empty */ }
      known[mpName] = { installLocation: mpDir };
      await writeFile(knownPath, JSON.stringify(known));

      const result = await svc.scanAvailablePlugins();
      const plugin = result.find((p) => p.pluginId === `local-plugin@${mpName}`);

      expect(plugin).toBeDefined();
      expect(plugin!.sourceUrl).toBeUndefined();
      expect(plugin!.sourceDir).toBe('./plugins/local-plugin');
    });

    it('skills 目錄含非目錄檔案（如 dashboard.html）時，不拋錯且正常列出 skill', async () => {
      const mpName = `scan-mp-skills-with-file-${testIdx}`;
      const mpDir = join(SUITE_HOME, '.claude', 'plugins', 'marketplaces', mpName);
      const pluginDir = join(mpDir, 'plugins', 'has-file-in-skills');
      const skillsDir = join(pluginDir, 'skills');
      const subSkillDir = join(skillsDir, 'my-skill');

      mkdirSync(join(mpDir, '.claude-plugin'), { recursive: true });
      mkdirSync(subSkillDir, { recursive: true });

      await writeFile(
        join(mpDir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: mpName,
          plugins: [{
            name: 'has-file-in-skills',
            description: 'plugin with file in skills dir',
            version: '1.0.0',
            source: './plugins/has-file-in-skills',
          }],
        }),
      );

      // 在 skills/ 放一個非目錄檔案，模擬 knowledge-work-plugins 的 dashboard.html
      await writeFile(join(skillsDir, 'dashboard.html'), '<html></html>');

      // 同時放正常的 skill 子目錄
      await writeFile(
        join(subSkillDir, 'SKILL.md'),
        ['---', 'name: my-skill', 'description: A real skill', '---'].join('\n'),
      );

      const knownPath = join(SUITE_HOME, '.claude', 'plugins', 'known_marketplaces.json');
      let known: Record<string, unknown> = {};
      try { known = JSON.parse(await readFile(knownPath, 'utf-8')); } catch { /* empty */ }
      known[mpName] = { installLocation: mpDir };
      await writeFile(knownPath, JSON.stringify(known));

      const result = await svc.scanAvailablePlugins();
      const plugin = result.find((p) => p.pluginId === `has-file-in-skills@${mpName}`);

      expect(plugin).toBeDefined();
      // 只應列出目錄型 skill，dashboard.html 應被跳過
      expect(plugin!.contents?.skills).toEqual([
        { name: 'my-skill', description: 'A real skill' },
      ]);
    });

    it('skills 目錄直接包含 root-level SKILL.md 時，contents.skills 仍應列出該 skill', async () => {
      const mpName = `scan-mp-root-skill-${testIdx}`;
      const mpDir = join(SUITE_HOME, '.claude', 'plugins', 'marketplaces', mpName);
      const pluginDir = join(mpDir, 'plugins', 'root-skill');
      const skillsDir = join(pluginDir, 'skills');

      mkdirSync(join(mpDir, '.claude-plugin'), { recursive: true });
      mkdirSync(skillsDir, { recursive: true });

      await writeFile(
        join(mpDir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: mpName,
          plugins: [{
            name: 'root-skill',
            description: 'has root skill',
            version: '1.0.0',
            source: './plugins/root-skill',
          }],
        }),
      );

      await writeFile(
        join(skillsDir, 'SKILL.md'),
        [
          '---',
          'name: root-skill',
          'description: Root level skill',
          '---',
          '',
          '# Root Skill',
        ].join('\n'),
      );

      const knownPath = join(SUITE_HOME, '.claude', 'plugins', 'known_marketplaces.json');
      let known: Record<string, unknown> = {};
      try { known = JSON.parse(await readFile(knownPath, 'utf-8')); } catch { /* empty */ }
      known[mpName] = { installLocation: mpDir };
      await writeFile(knownPath, JSON.stringify(known));

      const result = await svc.scanAvailablePlugins();
      const plugin = result.find((p) => p.pluginId === `root-skill@${mpName}`);

      expect(plugin).toBeDefined();
      expect(plugin!.contents?.skills).toEqual([
        { name: 'root-skill', description: 'Root level skill' },
      ]);
    });
  });
});
