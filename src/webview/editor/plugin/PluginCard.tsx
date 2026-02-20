import React, { useState } from 'react';
import type {
  MergedPlugin,
  PluginContents,
  PluginContentItem,
  PluginScope,
} from '../../../shared/types';
import { getInstalledScopes, hasPluginUpdate } from './filterUtils';
import { formatDate } from '../../utils/formatDate';
import { sendRequest } from '../../vscode';

interface PluginCardProps {
  plugin: MergedPlugin;
  workspaceName?: string;
  /** marketplace 的 source URL（git repo URL 或 GitHub shorthand） */
  marketplaceUrl?: string;
  /** original → translated description map */
  translations?: Record<string, string>;
  /** 翻譯狀態：translating = 進行中，queued = 排隊中 */
  translateStatus?: 'translating' | 'queued';
  /** 正在安裝/停用中的 scope set */
  loadingScopes?: ReadonlySet<PluginScope>;
  onToggle: (scope: PluginScope, enable: boolean) => void;
  onUpdate: (scopes: PluginScope[]) => void;
}

/**
 * Plugin 卡片。
 * 每個 scope 一個 checkbox：勾 = enable，取消勾 = disable。
 * 可展開顯示內含的 commands/skills/agents/MCP servers/hooks。
 */
export function PluginCard({
  plugin,
  workspaceName,
  marketplaceUrl,
  translations,
  translateStatus,
  loadingScopes,
  onToggle,
  onUpdate,
}: PluginCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const pluginUrl = buildPluginGithubUrl(marketplaceUrl, plugin.sourceDir);

  const hasWorkspace = !!workspaceName;
  const hasContents = pluginHasContents(plugin.contents);
  const hasUpdate = hasPluginUpdate(plugin);

  const { lastUpdated } = plugin;

  const handleCardClick = (e: React.MouseEvent) => {
    // 不攔截互動元素的 click
    const target = e.target as HTMLElement;
    if (target.closest('input, button, label')) return;
    if (hasContents) setExpanded((v) => !v);
  };

  return (
    <div
      className={`card${hasContents ? ' card--expandable' : ''}`}
      onClick={handleCardClick}
      tabIndex={0}
      role="group"
      aria-label={plugin.name}
    >
      <div className="card-header">
        <div>
          <span className="card-name">{plugin.name}</span>
          {plugin.marketplaceName && (
            <span className="card-marketplace">@{plugin.marketplaceName}</span>
          )}
        </div>
        <div className="card-header-right">
          {lastUpdated && (
            <span className="card-updated">Updated: {formatDate(lastUpdated)}</span>
          )}
          {hasUpdate && (
            <button
              type="button"
              className="badge-update"
              onClick={(e) => { e.stopPropagation(); onUpdate(getInstalledScopes(plugin)); }}
              disabled={!!loadingScopes?.size}
            >
              {loadingScopes?.size ? <span className="scope-spinner" /> : 'Update available'}
            </button>
          )}
          {pluginUrl && (
            <button className="btn btn-secondary btn-sm" onClick={() => {
              sendRequest({ type: 'openExternal', url: pluginUrl });
            }}>
              GitHub
            </button>
          )}
          {translateStatus === 'translating' && <span className="translate-spinner" />}
          {translateStatus === 'queued' && <span className="translate-queued" />}
        </div>
      </div>

      {plugin.description && (
        <div className="card-description">
          {translations?.[plugin.description] ?? plugin.description}
        </div>
      )}

      <div className="scope-chips-row">
        {hasContents
          ? <span className={`card-expand-arrow${expanded ? ' card-expand-arrow--open' : ''}`} />
          : <span className="card-expand-arrow-spacer" />}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
        <div className="scope-chips" onClick={(e) => e.stopPropagation()}>
        <ScopeToggle
          label="User"
          scope="user"
          enabled={plugin.userInstall?.enabled ?? false}
          loading={loadingScopes?.has('user') ?? false}
          disabled={!!loadingScopes?.size}
          onToggle={(on) => onToggle('user', on)}
        />
        {hasWorkspace && (
          <ScopeToggle
            label="Project"
            scope="project"
            enabled={plugin.projectInstalls[0]?.enabled ?? false}
            loading={loadingScopes?.has('project') ?? false}
            disabled={!!loadingScopes?.size}
            onToggle={(on) => onToggle('project', on)}
          />
        )}
        {hasWorkspace && (
          <ScopeToggle
            label="Local"
            scope="local"
            enabled={plugin.localInstall?.enabled ?? false}
            loading={loadingScopes?.has('local') ?? false}
            disabled={!!loadingScopes?.size}
            onToggle={(on) => onToggle('local', on)}
          />
        )}
        </div>
      </div>

      {hasContents && (
        <div className={`plugin-contents${expanded ? '' : ' plugin-contents--collapsed'}`}>
          <div className="section-body-inner">
            <PluginContentsView contents={plugin.contents!} translations={translations} />
          </div>
        </div>
      )}
    </div>
  );
}

/** 檢查 plugin 是否有任何內容可展示 */
function pluginHasContents(c?: PluginContents): boolean {
  if (!c) return false;
  return c.commands.length > 0
    || c.skills.length > 0
    || c.agents.length > 0
    || c.mcpServers.length > 0
    || c.hooks;
}

/** 展開後的 contents 列表 */
function PluginContentsView({
  contents,
  translations,
}: {
  contents: PluginContents;
  translations?: Record<string, string>;
}): React.ReactElement {
  return (
    <div className="plugin-contents-grid">
      {contents.commands.length > 0 && (
        <ContentSection label="Commands" items={contents.commands} translations={translations} />
      )}
      {contents.skills.length > 0 && (
        <ContentSection label="Skills" items={contents.skills} translations={translations} />
      )}
      {contents.agents.length > 0 && (
        <ContentSection label="Agents" items={contents.agents} translations={translations} />
      )}
      {contents.mcpServers.length > 0 && (
        <div className="content-section">
          <div className="content-section-label">MCP Servers</div>
          {contents.mcpServers.map((name) => (
            <div key={name} className="content-item">
              <span className="content-item-name">{name}</span>
            </div>
          ))}
        </div>
      )}
      {contents.hooks && (
        <div className="content-section">
          <div className="content-section-label">Hooks</div>
          <div className="content-item">
            <span className="content-item-name">Lifecycle hooks configured</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** 單一類型的 content section（commands/skills/agents） */
function ContentSection({
  label,
  items,
  translations,
}: {
  label: string;
  items: PluginContentItem[];
  translations?: Record<string, string>;
}): React.ReactElement {
  return (
    <div className="content-section">
      <div className="content-section-label">{label}</div>
      {items.map((item) => (
        <div key={item.name} className="content-item">
          <span className="content-item-name">{item.name}</span>
          {item.description && (
            <span className="content-item-desc">
              {translations?.[item.description] ?? item.description}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * 組合 marketplace URL 和 plugin sourceDir 為可瀏覽的 GitHub URL。
 * 回傳 null 表示無法產生有效的 GitHub URL（如 directory 類型的 marketplace）。
 */
export function buildPluginGithubUrl(
  marketplaceUrl: string | undefined,
  sourceDir: string | undefined,
): string | null {
  if (!marketplaceUrl) return null;

  let baseUrl: string;
  if (marketplaceUrl.startsWith('https://')) {
    baseUrl = marketplaceUrl.replace(/\.git$/, '');
  } else if (!marketplaceUrl.startsWith('/') && marketplaceUrl.includes('/')) {
    // GitHub shorthand: "owner/repo"
    baseUrl = `https://github.com/${marketplaceUrl}`;
  } else {
    return null;
  }

  if (sourceDir && sourceDir !== '.' && sourceDir !== './') {
    const cleanPath = sourceDir.replace(/^\.\//, '');
    return `${baseUrl}/tree/main/${cleanPath}`;
  }

  return baseUrl;
}

/** Scope checkbox：勾 = enabled，沒勾 = disabled 或未安裝。loading 時顯示 spinner 取代 checkbox。 */
function ScopeToggle({
  label,
  scope,
  enabled,
  loading,
  disabled,
  onToggle,
}: {
  label: string;
  scope: string;
  enabled: boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggle: (enable: boolean) => void;
}): React.ReactElement {
  return (
    <label className={`scope-chip-toggle${disabled ? ' scope-chip-toggle--disabled' : ''}`}>
      {loading
        ? <span className="scope-spinner" />
        : (
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={() => onToggle(!enabled)}
          />
        )}
      <span className={`scope-badge scope-badge--${scope}`}>
        {label}
      </span>
    </label>
  );
}
