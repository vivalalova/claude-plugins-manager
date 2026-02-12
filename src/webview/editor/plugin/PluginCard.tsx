import React, { useState } from 'react';
import type {
  MergedPlugin,
  PluginContents,
  PluginContentItem,
  PluginScope,
} from '../../../shared/types';
import { formatDate } from '../../utils/formatDate';

interface PluginCardProps {
  plugin: MergedPlugin;
  workspaceName?: string;
  onToggle: (scope: PluginScope, enable: boolean) => void;
  onUpdate: () => void;
}

/**
 * Plugin 卡片。
 * 每個 scope 一個 checkbox：勾 = enable，取消勾 = disable。
 * 可展開顯示內含的 commands/skills/agents/MCP servers/hooks。
 */
export function PluginCard({
  plugin,
  workspaceName,
  onToggle,
  onUpdate,
}: PluginCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const isInstalled = !!(
    plugin.userInstall
    || plugin.projectInstalls.length > 0
    || plugin.localInstall
  );
  const hasWorkspace = !!workspaceName;
  const hasContents = pluginHasContents(plugin.contents);

  const lastUpdated = [
    plugin.userInstall?.lastUpdated,
    ...plugin.projectInstalls.map((p) => p.lastUpdated),
    plugin.localInstall?.lastUpdated,
  ]
    .filter(Boolean)
    .sort()
    .pop();

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
          {isInstalled && (
            <button className="btn btn-secondary btn-sm" onClick={onUpdate}>
              Update
            </button>
          )}
        </div>
      </div>

      {plugin.description && (
        <div className="card-description">{plugin.description}</div>
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
          onToggle={(on) => onToggle('user', on)}
        />
        {hasWorkspace && (
          <ScopeToggle
            label="Project"
            scope="project"
            enabled={plugin.projectInstalls[0]?.enabled ?? false}
            onToggle={(on) => onToggle('project', on)}
          />
        )}
        {hasWorkspace && (
          <ScopeToggle
            label="Local"
            scope="local"
            enabled={plugin.localInstall?.enabled ?? false}
            onToggle={(on) => onToggle('local', on)}
          />
        )}
        </div>
      </div>

      {hasContents && (
        <div className={`plugin-contents${expanded ? '' : ' plugin-contents--collapsed'}`}>
          <div className="section-body-inner">
            <PluginContentsView contents={plugin.contents!} />
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
function PluginContentsView({ contents }: { contents: PluginContents }): React.ReactElement {
  return (
    <div className="plugin-contents-grid">
      {contents.commands.length > 0 && (
        <ContentSection label="Commands" items={contents.commands} />
      )}
      {contents.skills.length > 0 && (
        <ContentSection label="Skills" items={contents.skills} />
      )}
      {contents.agents.length > 0 && (
        <ContentSection label="Agents" items={contents.agents} />
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
}: {
  label: string;
  items: PluginContentItem[];
}): React.ReactElement {
  return (
    <div className="content-section">
      <div className="content-section-label">{label}</div>
      {items.map((item) => (
        <div key={item.name} className="content-item">
          <span className="content-item-name">{item.name}</span>
          {item.description && (
            <span className="content-item-desc">{item.description}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Scope checkbox：勾 = enabled，沒勾 = disabled 或未安裝 */
function ScopeToggle({
  label,
  scope,
  enabled,
  onToggle,
}: {
  label: string;
  scope: string;
  enabled: boolean;
  onToggle: (enable: boolean) => void;
}): React.ReactElement {
  return (
    <label className="scope-chip-toggle">
      <input
        type="checkbox"
        checked={enabled}
        onChange={() => onToggle(!enabled)}
      />
      <span className={`scope-badge scope-badge--${scope}`}>
        {label}
      </span>
    </label>
  );
}
