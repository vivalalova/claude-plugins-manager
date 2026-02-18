import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workspace } from 'vscode';
import { SettingsFileService } from '../SettingsFileService';
import type { PluginInstallEntry } from '../../../shared/types';

/* ── fs/promises mock ── */
const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockMkdir = vi.hoisted(() => vi.fn());
const mockReaddir = vi.hoisted(() => vi.fn());
const mockStat = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  readdir: mockReaddir,
  stat: mockStat,
}));

describe('SettingsFileService', () => {
  let svc: SettingsFileService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new SettingsFileService();
    workspace.workspaceFolders = [
      { uri: { fsPath: '/workspace' }, name: 'test', index: 0 },
    ] as any;
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  /* ═══════ getSettingsPath ═══════ */
  describe('getSettingsPath()', () => {
    it('user → ~/.claude/settings.json', () => {
      const path = svc.getSettingsPath('user');
      expect(path).toMatch(/\.claude\/settings\.json$/);
      expect(path).not.toContain('/workspace');
    });

    it('project → <workspace>/.claude/settings.json', () => {
      const path = svc.getSettingsPath('project');
      expect(path).toBe('/workspace/.claude/settings.json');
    });

    it('local → <workspace>/.claude/settings.local.json', () => {
      const path = svc.getSettingsPath('local');
      expect(path).toBe('/workspace/.claude/settings.local.json');
    });

    it('project/local scope 無 workspace → throw', () => {
      workspace.workspaceFolders = undefined;
      expect(() => svc.getSettingsPath('project')).toThrow('No workspace folder open');
      expect(() => svc.getSettingsPath('local')).toThrow('No workspace folder open');
    });

    it('workspace 路徑含空白 → 正確組合', () => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/Users/dev/My Projects/app' }, name: 'app', index: 0 },
      ] as any;
      expect(svc.getSettingsPath('project')).toBe(
        '/Users/dev/My Projects/app/.claude/settings.json',
      );
    });

    it('workspaceFolders 空陣列 → throw（同 undefined）', () => {
      workspace.workspaceFolders = [] as any;
      expect(() => svc.getSettingsPath('project')).toThrow('No workspace folder open');
    });
  });

  /* ═══════ readEnabledPlugins ═══════ */
  describe('readEnabledPlugins()', () => {
    it('回傳 settings 檔中的 enabledPlugins', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        enabledPlugins: { 'my-plugin@mp': true, 'other@mp': true },
      }));

      const result = await svc.readEnabledPlugins('user');
      expect(result).toEqual({ 'my-plugin@mp': true, 'other@mp': true });
    });

    it('檔案不存在 → 回傳空物件', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await svc.readEnabledPlugins('user');
      expect(result).toEqual({});
    });

    it('檔案存在但無 enabledPlugins 欄位 → 回傳空物件', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ permissions: {} }));

      const result = await svc.readEnabledPlugins('user');
      expect(result).toEqual({});
    });

    it('enabledPlugins 為 null → 回傳空物件', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ enabledPlugins: null }));

      const result = await svc.readEnabledPlugins('user');
      expect(result).toEqual({});
    });

    it('settings.json 內容損毀（非 JSON） → 回傳空物件', async () => {
      mockReadFile.mockResolvedValue('this is not json {{{');

      const result = await svc.readEnabledPlugins('user');
      expect(result).toEqual({});
    });

    it('project scope → 讀取 workspace 路徑下的 settings.json', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        enabledPlugins: { 'proj-only@mp': true },
      }));

      const result = await svc.readEnabledPlugins('project');

      expect(mockReadFile).toHaveBeenCalledWith(
        '/workspace/.claude/settings.json',
        'utf-8',
      );
      expect(result).toEqual({ 'proj-only@mp': true });
    });
  });

  /* ═══════ setPluginEnabled ═══════ */
  describe('setPluginEnabled()', () => {
    it('enable → 寫入 pluginId: true', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ enabledPlugins: {} }));

      await svc.setPluginEnabled('my-plugin@mp', 'user', true);

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.enabledPlugins['my-plugin@mp']).toBe(true);
    });

    it('disable → 移除 pluginId key', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        enabledPlugins: { 'my-plugin@mp': true, 'other@mp': true },
      }));

      await svc.setPluginEnabled('my-plugin@mp', 'user', false);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.enabledPlugins).toEqual({ 'other@mp': true });
      expect(written.enabledPlugins).not.toHaveProperty('my-plugin@mp');
    });

    it('保留既有的其他 settings 欄位（$schema, permissions 等）', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: { allow: ['Bash(ls:*)'] },
        enabledPlugins: { 'existing@mp': true },
        language: '繁體中文',
      }));

      await svc.setPluginEnabled('new@mp', 'user', true);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.$schema).toBe('https://json.schemastore.org/claude-code-settings.json');
      expect(written.permissions).toEqual({ allow: ['Bash(ls:*)'] });
      expect(written.language).toBe('繁體中文');
      expect(written.enabledPlugins).toEqual({
        'existing@mp': true,
        'new@mp': true,
      });
    });

    it('project scope → 寫入 <workspace>/.claude/settings.json', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await svc.setPluginEnabled('my-plugin@mp', 'project', true);

      const [path] = mockWriteFile.mock.calls[0];
      expect(path).toBe('/workspace/.claude/settings.json');
    });

    it('local scope → 寫入 <workspace>/.claude/settings.local.json', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await svc.setPluginEnabled('my-plugin@mp', 'local', true);

      const [path] = mockWriteFile.mock.calls[0];
      expect(path).toBe('/workspace/.claude/settings.local.json');
    });

    it('project scope 寫入前先建立 .claude/ 目錄', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await svc.setPluginEnabled('my-plugin@mp', 'project', true);

      expect(mockMkdir).toHaveBeenCalledWith(
        '/workspace/.claude',
        { recursive: true },
      );
      const mkdirOrder = mockMkdir.mock.invocationCallOrder[0];
      const writeOrder = mockWriteFile.mock.invocationCallOrder[0];
      expect(mkdirOrder).toBeLessThan(writeOrder);
    });

    it('local scope 寫入前先建立 .claude/ 目錄', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await svc.setPluginEnabled('my-plugin@mp', 'local', true);

      expect(mockMkdir).toHaveBeenCalledWith(
        '/workspace/.claude',
        { recursive: true },
      );
    });

    it('user scope 不需要建立目錄（~/.claude/ 一定存在）', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));

      await svc.setPluginEnabled('my-plugin@mp', 'user', true);

      expect(mockMkdir).not.toHaveBeenCalled();
    });

    it('檔案不存在 → 建立新檔寫入 enabledPlugins', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await svc.setPluginEnabled('my-plugin@mp', 'project', true);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written).toEqual({ enabledPlugins: { 'my-plugin@mp': true } });
    });

    it('已 enable 的 plugin 再次 enable → 冪等（仍寫入，值不變）', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        enabledPlugins: { 'my-plugin@mp': true },
      }));

      await svc.setPluginEnabled('my-plugin@mp', 'user', true);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.enabledPlugins['my-plugin@mp']).toBe(true);
    });

    it('不存在的 plugin disable → 冪等（不會殘留 undefined key）', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        enabledPlugins: { 'other@mp': true },
      }));

      await svc.setPluginEnabled('nonexistent@mp', 'user', false);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.enabledPlugins).toEqual({ 'other@mp': true });
      expect(Object.keys(written.enabledPlugins)).toHaveLength(1);
    });

    it('disable 唯一的 plugin → enabledPlugins 變空物件', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        enabledPlugins: { 'last@mp': true },
      }));

      await svc.setPluginEnabled('last@mp', 'user', false);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.enabledPlugins).toEqual({});
    });

    it('settings.json 損毀 → 覆寫為乾淨結構', async () => {
      mockReadFile.mockResolvedValue('NOT VALID JSON!!!');

      await svc.setPluginEnabled('new@mp', 'project', true);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written).toEqual({ enabledPlugins: { 'new@mp': true } });
    });

    it('pluginId 含特殊字元（Unicode） → 正確處理', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ enabledPlugins: {} }));

      await svc.setPluginEnabled('プラグイン@mp', 'user', true);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.enabledPlugins['プラグイン@mp']).toBe(true);
    });

    it('writeFile 失敗 → 拋出錯誤（不吞掉）', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));
      mockWriteFile.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(
        svc.setPluginEnabled('p@mp', 'user', true),
      ).rejects.toThrow('EACCES');
    });

    it('mkdir 失敗 → 拋出錯誤（不吞掉）', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
      mockMkdir.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(
        svc.setPluginEnabled('p@mp', 'project', true),
      ).rejects.toThrow('EACCES');
    });

    it('project/local scope 無 workspace → 拋出 No workspace 錯誤', async () => {
      workspace.workspaceFolders = undefined;

      await expect(
        svc.setPluginEnabled('p@mp', 'project', true),
      ).rejects.toThrow('No workspace folder open');
      await expect(
        svc.setPluginEnabled('p@mp', 'local', true),
      ).rejects.toThrow('No workspace folder open');
    });

    it('輸出為 pretty-printed JSON 並帶尾部換行', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));

      await svc.setPluginEnabled('p@mp', 'user', true);

      const [, content] = mockWriteFile.mock.calls[0];
      // 2-space indent
      expect(content).toContain('  "enabledPlugins"');
      // trailing newline
      expect(content).toMatch(/\n$/);
    });
  });

  /* ═══════ addInstallEntry ═══════ */
  describe('addInstallEntry()', () => {
    const baseEntry: PluginInstallEntry = {
      scope: 'project',
      projectPath: '/workspace',
      installPath: '/cache/plugin',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      lastUpdated: '2026-01-01T00:00:00Z',
    };

    it('新 plugin → 新增 entry 並寫入', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ version: 2, plugins: {} }));

      await svc.addInstallEntry('my-plugin@mp', baseEntry);

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.plugins['my-plugin@mp']).toHaveLength(1);
      expect(written.plugins['my-plugin@mp'][0].scope).toBe('project');
    });

    it('同 plugin 不同 scope → 新增 entry', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 2,
        plugins: {
          'my-plugin@mp': [{
            scope: 'user',
            installPath: '/cache/plugin',
            version: '1.0.0',
            installedAt: '2026-01-01T00:00:00Z',
            lastUpdated: '2026-01-01T00:00:00Z',
          }],
        },
      }));

      await svc.addInstallEntry('my-plugin@mp', baseEntry);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.plugins['my-plugin@mp']).toHaveLength(2);
    });

    it('重複 scope + projectPath → 不寫入', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 2,
        plugins: { 'my-plugin@mp': [baseEntry] },
      }));

      await svc.addInstallEntry('my-plugin@mp', baseEntry);

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('同 scope 不同 projectPath → 視為不同 entry（多 workspace 場景）', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 2,
        plugins: { 'my-plugin@mp': [baseEntry] },
      }));

      const otherProjectEntry: PluginInstallEntry = {
        ...baseEntry,
        projectPath: '/other-workspace',
      };

      await svc.addInstallEntry('my-plugin@mp', otherProjectEntry);

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.plugins['my-plugin@mp']).toHaveLength(2);
    });

    it('user scope entry（無 projectPath）的重複判定', async () => {
      const userEntry: PluginInstallEntry = {
        scope: 'user',
        installPath: '/cache/plugin',
        version: '1.0.0',
        installedAt: '2026-01-01T00:00:00Z',
        lastUpdated: '2026-01-01T00:00:00Z',
      };
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 2,
        plugins: { 'my-plugin@mp': [userEntry] },
      }));

      // 同 scope + 同 projectPath (都是 undefined) → 重複
      await svc.addInstallEntry('my-plugin@mp', { ...userEntry, version: '2.0.0' });

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('installed_plugins.json 不存在 → 使用預設結構', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await svc.addInstallEntry('my-plugin@mp', baseEntry);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.plugins['my-plugin@mp']).toHaveLength(1);
    });

    it('保留其他 plugin 的 entries', async () => {
      const otherEntries = [{
        scope: 'user' as const,
        installPath: '/cache/other',
        version: '1.0.0',
        installedAt: '2026-01-01T00:00:00Z',
        lastUpdated: '2026-01-01T00:00:00Z',
      }];
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 2,
        plugins: { 'other@mp': otherEntries },
      }));

      await svc.addInstallEntry('my-plugin@mp', baseEntry);

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.plugins['other@mp']).toHaveLength(1);
      expect(written.plugins['my-plugin@mp']).toHaveLength(1);
    });
  });

  /* ═══════ removeInstallEntry ═══════ */
  describe('removeInstallEntry()', () => {
    it('移除指定 scope + projectPath 的 entry', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 2,
        plugins: {
          'my-plugin@mp': [
            { scope: 'user', installPath: '/cache', version: '1.0', installedAt: '', lastUpdated: '' },
            { scope: 'project', projectPath: '/workspace', installPath: '/cache', version: '1.0', installedAt: '', lastUpdated: '' },
          ],
        },
      }));

      await svc.removeInstallEntry('my-plugin@mp', 'project', '/workspace');

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.plugins['my-plugin@mp']).toHaveLength(1);
      expect(written.plugins['my-plugin@mp'][0].scope).toBe('user');
    });

    it('移除最後一筆 entry → 刪除整個 plugin key', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 2,
        plugins: {
          'my-plugin@mp': [
            { scope: 'user', installPath: '/cache', version: '1.0', installedAt: '', lastUpdated: '' },
          ],
        },
      }));

      await svc.removeInstallEntry('my-plugin@mp', 'user');

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.plugins).not.toHaveProperty('my-plugin@mp');
    });

    it('plugin 不存在 → 不寫入', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ version: 2, plugins: {} }));

      await svc.removeInstallEntry('nonexistent@mp', 'user');

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('projectPath 不匹配 → 不移除任何 entry', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 2,
        plugins: {
          'my-plugin@mp': [
            { scope: 'project', projectPath: '/workspace-A', installPath: '/cache', version: '1.0', installedAt: '', lastUpdated: '' },
          ],
        },
      }));

      await svc.removeInstallEntry('my-plugin@mp', 'project', '/workspace-B');

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      // projectPath 不同 → entry 被 filter 保留... 但因為結果是空 → 刪除整個 key
      // 等等，filter 結果不為空因為 projectPath 不同，entry 會被保留
      expect(written.plugins['my-plugin@mp']).toHaveLength(1);
      expect(written.plugins['my-plugin@mp'][0].projectPath).toBe('/workspace-A');
    });

    it('多筆 entry 只移除匹配的一筆，保留其他', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 2,
        plugins: {
          'my-plugin@mp': [
            { scope: 'user', installPath: '/cache', version: '1.0', installedAt: '', lastUpdated: '' },
            { scope: 'project', projectPath: '/workspace', installPath: '/cache', version: '1.0', installedAt: '', lastUpdated: '' },
            { scope: 'local', projectPath: '/workspace', installPath: '/cache', version: '1.0', installedAt: '', lastUpdated: '' },
          ],
        },
      }));

      await svc.removeInstallEntry('my-plugin@mp', 'local', '/workspace');

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.plugins['my-plugin@mp']).toHaveLength(2);
      expect(written.plugins['my-plugin@mp'].map((e: any) => e.scope)).toEqual(['user', 'project']);
    });

    it('保留其他 plugin 的 entries', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        version: 2,
        plugins: {
          'plugin-a@mp': [
            { scope: 'user', installPath: '/cache/a', version: '1.0', installedAt: '', lastUpdated: '' },
          ],
          'plugin-b@mp': [
            { scope: 'user', installPath: '/cache/b', version: '1.0', installedAt: '', lastUpdated: '' },
          ],
        },
      }));

      await svc.removeInstallEntry('plugin-a@mp', 'user');

      const [, content] = mockWriteFile.mock.calls[0];
      const written = JSON.parse(content);
      expect(written.plugins).not.toHaveProperty('plugin-a@mp');
      expect(written.plugins['plugin-b@mp']).toHaveLength(1);
    });
  });
});
