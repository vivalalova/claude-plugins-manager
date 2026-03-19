import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { rm as rmAsync, mkdir as mkdirAsync } from 'fs/promises';
import * as os from 'os';
import type { MarketplaceService } from '../services/MarketplaceService';
import type { PluginService } from '../services/PluginService';
import type { McpService } from '../services/McpService';
import type { TranslationService } from '../services/TranslationService';
import type { SettingsFileService } from '../services/SettingsFileService';
import type { HookExplanationService } from '../services/HookExplanationService';
import type { ExtensionInfoService } from '../services/ExtensionInfoService';
import type { SkillService } from '../services/SkillService';
import type { RequestMessage, ResponseMessage } from './protocol';

type PostFn = (msg: ResponseMessage) => void;

/**
 * 路由 Webview 訊息到對應 Service，回傳結果或錯誤。
 * 每個 request 都帶 requestId，用於 webview 端配對 Promise。
 */
export class MessageRouter {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly plugin: PluginService,
    private readonly mcp: McpService,
    private readonly translation: TranslationService,
    private readonly settings: SettingsFileService,
    private readonly hookExplanation: HookExplanationService,
    private readonly extensionInfo: ExtensionInfoService,
    private readonly cacheDir: string,
    private readonly skill: SkillService,
  ) {}

  /** 處理來自 webview 的訊息 */
  async handle(message: RequestMessage, post: PostFn): Promise<void> {
    // sidebar 導航訊息不需 response
    if (message.type === 'sidebar.openCategory') {
      return;
    }

    const { requestId } = message;

    try {
      const data = await this.dispatch(message);
      post({ type: 'response', requestId, data });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[MessageRouter] ${message.type} failed:`, msg);
      post({ type: 'error', requestId, error: msg });
    }
  }

  /** 依 message type 分派到對應 service method */
  private async dispatch(message: RequestMessage): Promise<unknown> {
    switch (message.type) {
      // Marketplace
      case 'marketplace.list':
        return this.marketplace.list();
      case 'marketplace.preview':
        return this.marketplace.preview(message.source);
      case 'marketplace.add':
        return this.marketplace.add(message.source);
      case 'marketplace.remove':
        return this.marketplace.remove(message.name);
      case 'marketplace.update':
        return this.marketplace.update(message.name);
      case 'marketplace.toggleAutoUpdate':
        return this.marketplace.toggleAutoUpdate(message.name);
      case 'marketplace.export':
        return this.marketplace.exportScript();
      case 'marketplace.import':
        return this.marketplace.importScript();

      // Plugin
      case 'plugin.listInstalled':
        return this.plugin.listInstalled();
      case 'plugin.listAvailable':
        return this.plugin.listAvailable();
      case 'plugin.install':
        return this.plugin.install(message.plugin, message.scope);
      case 'plugin.uninstall':
        return this.plugin.uninstall(message.plugin, message.scope);
      case 'plugin.enable':
        return this.plugin.enable(message.plugin, message.scope);
      case 'plugin.disable':
        return this.plugin.disable(message.plugin, message.scope);
      case 'plugin.disableAll':
        return this.plugin.disableAll();
      case 'plugin.update':
        return this.plugin.update(message.plugin, message.scope);
      case 'plugin.export':
        return this.plugin.exportScript();
      case 'plugin.import':
        return this.plugin.importScript();
      case 'plugin.translate':
        return this.translation.translate(message.texts, message.targetLang, message.email);

      // MCP（即時從設定檔讀取，polling 背景更新狀態）
      case 'mcp.list':
        return this.mcp.listFromFiles();
      case 'mcp.add':
        return this.mcp.add(message.params);
      case 'mcp.remove':
        return this.mcp.remove(message.name, message.scope);
      case 'mcp.getDetail':
        return this.mcp.getDetail(message.name);
      case 'mcp.resetProjectChoices':
        return this.mcp.resetProjectChoices();
      case 'mcp.refreshStatus':
        return this.mcp.refreshStatus();
      case 'mcp.restartPolling':
        this.mcp.restartPolling();
        return;

      // Workspace
      case 'workspace.getFolders':
        return (vscode.workspace.workspaceFolders ?? []).map((f) => ({
          name: f.name,
          path: f.uri.fsPath,
        }));

      // Utility
      case 'openExternal':
        await vscode.env.openExternal(vscode.Uri.parse(message.url));
        return;

      // UI 偏好持久化（檔案）
      case 'preferences.read':
        return this.settings.readPreferences();
      case 'preferences.write':
        return this.settings.writePreference(message.key, message.value);

      // Settings（Claude Code settings.json）
      case 'settings.get':
        return this.settings.getSettings(message.scope);
      case 'settings.set':
        return this.settings.setSetting(message.scope, message.key, message.value);
      case 'settings.delete':
        return this.settings.deleteSetting(message.scope, message.key);
      case 'hooks.checkFilePaths':
        return message.paths.filter((p) => {
          const expanded = this.expandTildePath(p);
          return (p.startsWith('/') || p.startsWith('~/')) && fs.existsSync(expanded);
        });

      case 'hooks.explain':
        return this.hookExplanation.explain(message.hookContent, message.eventType, message.locale, message.filePath, message.refresh);

      case 'hooks.loadCachedExplanations':
        return this.hookExplanation.loadCached(message.items);

      case 'hooks.cleanExpiredExplanations':
        this.hookExplanation.cleanExpired().catch((e: unknown) =>
          console.error('[MessageRouter] cleanExpired failed:', e),
        );
        return;

      case 'hooks.openFile': {
        const resolved = this.expandTildePath(message.path);
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(resolved));
        return;
      }

      case 'extension.getInfo':
        return this.extensionInfo.getInfo();

      case 'extension.revealPath': {
        const resolved = this.expandTildePath(message.path);
        if (!fs.existsSync(resolved)) {
          throw new Error(`Path does not exist: ${resolved}`);
        }
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(resolved));
        return;
      }

      case 'extension.clearCache': {
        await rmAsync(this.cacheDir, { recursive: true, force: true });
        await mkdirAsync(this.cacheDir, { recursive: true });
        this.translation.invalidateCache();
        this.hookExplanation.invalidateCache();
        return { cleared: true, path: this.cacheDir };
      }

      // Skill
      case 'skill.list':
        return this.skill.list(message.scope);
      case 'skill.add':
        return this.skill.add(message.source, message.scope);
      case 'skill.remove':
        return this.skill.remove(message.name, message.scope);
      case 'skill.find':
        return this.skill.find(message.query);
      case 'skill.check':
        return this.skill.check();
      case 'skill.update':
        return this.skill.update();
      case 'skill.getDetail':
        return this.skill.getDetail(message.path);
      case 'skill.registry':
        return this.skill.fetchRegistry(message.sort, message.query);
      case 'skill.openFile': {
        const resolved = this.expandTildePath(message.path);
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(resolved));
        return;
      }

      case 'settings.openInEditor': {
        const filePath = this.settings.getSettingsPath(message.scope);
        const uri = vscode.Uri.file(filePath);
        try {
          await vscode.workspace.fs.stat(uri);
        } catch {
          // 檔案不存在 → 先確保父目錄存在，再建立含 $schema + hooks 的初始檔案
          const parentUri = vscode.Uri.file(path.dirname(filePath));
          await vscode.workspace.fs.createDirectory(parentUri);
          const initial = JSON.stringify({
            $schema: 'https://json.schemastore.org/claude-code-settings.json',
            hooks: {},
          }, null, 2) + '\n';
          await vscode.workspace.fs.writeFile(uri, Buffer.from(initial, 'utf-8'));
        }
        await vscode.window.showTextDocument(uri);
        return;
      }

      default:
        throw new Error(`Unknown message type: ${(message as { type: string }).type}`);
    }
  }

  private expandTildePath(p: string): string {
    return p.startsWith('~/') ? os.homedir() + p.slice(1) : p;
  }
}
