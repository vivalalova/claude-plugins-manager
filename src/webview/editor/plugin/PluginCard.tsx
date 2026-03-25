import React, { useState } from 'react';
import type {
  MergedPlugin,
  PluginContents,
  PluginContentItem,
  PluginScope,
} from '../../../shared/types';
import { getInstalledScopes, hasPluginUpdate, isPluginEnabled } from './filterUtils';
import { sendRequest } from '../../vscode';
import { useI18n } from '../../i18n/I18nContext';

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
  /** 是否已隱藏 */
  hidden?: boolean;
  onToggle: (pluginId: string, scope: PluginScope, enable: boolean) => void;
  onUpdate: (pluginId: string, scopes: PluginScope[]) => void;
  onToggleHidden?: (pluginId: string) => void;
  /** 點擊 content item 時的回呼（查看詳情） */
  onViewContent?: (item: PluginContentItem) => void;
  /** 安裝但不啟用（external plugin 用） */
  onInstallOnly?: (pluginId: string) => void;
  /** 正在執行 install-only */
  installOnlyLoading?: boolean;
}

/**
 * Plugin 卡片。
 * 每個 scope 一個 checkbox：勾 = enable，取消勾 = disable。
 * 可展開顯示內含的 commands/skills/agents/MCP servers/hooks。
 */
export const PluginCard = React.memo(function PluginCard({
  plugin,
  workspaceName,
  marketplaceUrl,
  translations,
  translateStatus,
  loadingScopes,
  hidden,
  onToggle,
  onUpdate,
  onToggleHidden,
  onViewContent,
  onInstallOnly,
  installOnlyLoading,
}: PluginCardProps): React.ReactElement {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const pluginUrl = buildPluginGithubUrl(marketplaceUrl, plugin.sourceDir, plugin.sourceUrl);

  const hasWorkspace = !!workspaceName;
  const hasContents = pluginHasContents(plugin.contents);
  const isExternal = !hasContents && !!pluginUrl;
  const canExpand = hasContents || isExternal;
  const hasUpdate = isPluginEnabled(plugin) && hasPluginUpdate(plugin);
  const scopeControlsDisabled = !!loadingScopes?.size;
  const projectEnabled = plugin.projectInstalls.some((install) => install.enabled);

  const handleCardClick = (e: React.MouseEvent) => {
    // 不攔截互動元素的 click
    const target = e.target as HTMLElement;
    if (target.closest('input, button, label')) return;
    if (canExpand) setExpanded((v) => !v);
  };
  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, label')) return;
    if (!canExpand) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    setExpanded((v) => !v);
  };

  return (
    <div
      className={`card${canExpand ? ' card--expandable' : ''}${hidden ? ' card--hidden' : ''}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      role="group"
      aria-label={plugin.name}
      aria-expanded={canExpand ? expanded : undefined}
    >
      <div className="card-header">
        <div>
          <span className="card-name">{plugin.name}</span>
        </div>
        <div className="card-header-right">
          {hasUpdate && (
            <button
              type="button"
              className="badge-update"
              onClick={(e) => { e.stopPropagation(); onUpdate(plugin.id, getInstalledScopes(plugin)); }}
              disabled={!!loadingScopes?.size}
            >
              {loadingScopes?.size ? <span className="scope-spinner" /> : t('plugin.card.updateAvailable')}
            </button>
          )}
          {pluginUrl && (
            <button className="btn btn-secondary btn-sm" onClick={() => {
              sendRequest({ type: 'openExternal', url: pluginUrl });
            }}>
              {t('plugin.card.github')}
            </button>
          )}
          {onToggleHidden && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={(e) => { e.stopPropagation(); onToggleHidden(plugin.id); }}
            >
              {hidden ? t('plugin.card.unhide') : t('plugin.card.hide')}
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
        {canExpand
          ? <span className={`card-expand-arrow${expanded ? ' card-expand-arrow--open' : ''}`} />
          : <span className="card-expand-arrow-spacer" />}
        <div
          className="scope-chips"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
        <ScopeToggle
          label={t('bulk.scopeUser')}
          scope="user"
          enabled={plugin.userInstall?.enabled ?? false}
          loading={loadingScopes?.has('user') ?? false}
          disabled={scopeControlsDisabled}
          onToggle={(on) => onToggle(plugin.id, 'user', on)}
        />
        <ScopeToggle
          label={t('bulk.scopeProject')}
          scope="project"
          enabled={projectEnabled}
          loading={loadingScopes?.has('project') ?? false}
          disabled={scopeControlsDisabled || !hasWorkspace}
          onToggle={(on) => onToggle(plugin.id, 'project', on)}
        />
        <ScopeToggle
          label={t('bulk.scopeLocal')}
          scope="local"
          enabled={plugin.localInstall?.enabled ?? false}
          loading={loadingScopes?.has('local') ?? false}
          disabled={scopeControlsDisabled || !hasWorkspace}
          onToggle={(on) => onToggle(plugin.id, 'local', on)}
        />
        </div>
      </div>

      {canExpand && (
        <div className={`plugin-contents${expanded ? '' : ' plugin-contents--collapsed'}`}>
          <div className="section-body-inner">
            {hasContents ? (
              <PluginContentsView contents={plugin.contents!} translations={translations} onViewItem={onViewContent} />
            ) : (
              <div className="content-external-hint">
                <span>{t('plugin.content.external')}</span>
                {onInstallOnly && (
                  <button
                    className="btn btn-sm"
                    disabled={installOnlyLoading}
                    onClick={(e) => { e.stopPropagation(); onInstallOnly(plugin.id); }}
                  >
                    {installOnlyLoading ? <span className="scope-spinner" /> : t('plugin.content.installOnly')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

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
  onViewItem,
}: {
  contents: PluginContents;
  translations?: Record<string, string>;
  onViewItem?: (item: PluginContentItem) => void;
}): React.ReactElement {
  return (
    <div className="plugin-contents-grid">
      {contents.commands.length > 0 && (
        <ContentSection label="Commands" items={contents.commands} translations={translations} onViewItem={onViewItem} />
      )}
      {contents.skills.length > 0 && (
        <ContentSection label="Skills" items={contents.skills} translations={translations} onViewItem={onViewItem} />
      )}
      {contents.agents.length > 0 && (
        <ContentSection label="Agents" items={contents.agents} translations={translations} onViewItem={onViewItem} />
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
  onViewItem,
}: {
  label: string;
  items: PluginContentItem[];
  translations?: Record<string, string>;
  onViewItem?: (item: PluginContentItem) => void;
}): React.ReactElement {
  return (
    <div className="content-section">
      <div className="content-section-label">{label}</div>
      {items.map((item) => (
        <div
          key={item.name}
          className={`content-item${onViewItem ? ' content-item--clickable' : ''}`}
          onClick={onViewItem ? (e) => { e.stopPropagation(); onViewItem(item); } : undefined}
          onKeyDown={onViewItem ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onViewItem(item);
            }
          } : undefined}
          tabIndex={onViewItem ? 0 : undefined}
          role={onViewItem ? 'button' : undefined}
        >
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
  sourceUrl: string | undefined,
): string | null {
  if (sourceUrl) return sourceUrl;
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
